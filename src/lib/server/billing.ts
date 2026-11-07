import "server-only";
import { addDays } from "@/lib/booking/time";
import { audit, q, q1 } from "./db";

export type PlanId = "manage" | "capture" | "club";
export const PLAN_IDS: PlanId[] = ["manage", "capture", "club"];
export type PlanPrices = Record<PlanId, number>;
export type BillingSettings = { manual_instructions: string; due_days: number };
export type PlatformPaymongo = { public_key: string; secret_enc: string; webhook_id: string; webhook_secret_enc: string; livemode: boolean; connected_at: string };

async function setting<T>(key: string, fallback: T): Promise<T> {
  const r = await q1<{ value: T }>("SELECT value FROM platform_setting WHERE key=$1", [key]);
  return (r?.value as T) ?? fallback;
}
export const planPrices = () => setting<PlanPrices>("plan_prices", { manage: 0, capture: 0, club: 0 });
export const billingSettings = () => setting<BillingSettings>("billing", { manual_instructions: "", due_days: 7 });
export const platformPaymongo = () => setting<PlatformPaymongo | null>("platform_paymongo", null);

export async function putSetting(key: string, value: unknown, actorId: string) {
  await q(
    "INSERT INTO platform_setting (key, value, updated_by, updated_at) VALUES ($1,$2,$3,now()) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_by=EXCLUDED.updated_by, updated_at=now()",
    [key, JSON.stringify(value), actorId],
  );
}

/** "YYYY-MM" -> first and last day. */
export function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return { start, end: addDays(next, -1) };
}

/** Subscription charged for a month: none while on trial or before the trial ends, else the plan's monthly price. */
export function subscriptionFor(plan: string, trialEndsAt: string | null, periodEnd: string, prices: PlanPrices) {
  if (plan === "trial" || !(PLAN_IDS as string[]).includes(plan)) return 0;
  if (trialEndsAt && new Date(trialEndsAt) > new Date(`${periodEnd}T23:59:59+08:00`)) return 0;
  return prices[plan as PlanId] ?? 0;
}

/** Usage so far for a venue in a month (booking fees on Playbook bookings). */
export async function feesFor(venueId: string, start: string, end: string) {
  return (await q1<{ n: number; fees: number }>(
    `SELECT count(*)::int AS n, coalesce(sum(platform_fee_cents),0)::int AS fees FROM booking
      WHERE venue_id=$1 AND platform_fee_cents > 0 AND status IN ('confirmed','completed','no_show')
        AND (confirmed_at AT TIME ZONE 'Asia/Manila')::date BETWEEN $2 AND $3`,
    [venueId, start, end],
  ))!;
}

/** Create invoices for every billable venue for a month. Idempotent per venue+month. */
export async function generateInvoices(month: string, actorId: string) {
  const { start, end } = monthRange(month);
  const [prices, billing] = await Promise.all([planPrices(), billingSettings()]);
  const venues = await q<{ id: string; plan: string; trial_ends_at: string | null; created_at: string }>(
    "SELECT id, plan, trial_ends_at, created_at FROM venue WHERE status IN ('active','suspended') AND approved_at IS NOT NULL AND (approved_at AT TIME ZONE 'Asia/Manila')::date <= $1",
    [end],
  );
  let created = 0;
  let skipped = 0;
  for (const v of venues) {
    const sub = subscriptionFor(v.plan, v.trial_ends_at, end, prices);
    const { n, fees } = await feesFor(v.id, start, end);
    const total = sub + fees;
    if (total <= 0) {
      skipped++;
      continue;
    }
    const number = `INV-${month.replace("-", "")}-${v.id.slice(0, 6).toUpperCase()}`;
    const row = await q1<{ id: string }>(
      `INSERT INTO invoice (number, venue_id, period_start, period_end, plan, subscription_cents, booking_count, booking_fee_cents, total_cents, due_date, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (venue_id, period_start) DO NOTHING RETURNING id`,
      [number, v.id, start, end, v.plan, sub, n, fees, total, addDays(end, 1 + (billing.due_days || 7)), actorId],
    );
    if (row) created++;
    else skipped++;
  }
  await audit(actorId, "invoices.generate", "platform", null, { month, created, skipped });
  return { created, skipped };
}

export async function markInvoicePaid(id: string, via: string, actorId: string | null, paymentId?: string) {
  const r = await q1<{ id: string }>(
    "UPDATE invoice SET status='paid', paid_at=now(), paid_via=$2, payment_id=coalesce($3, payment_id) WHERE id=$1 AND status='open' RETURNING id",
    [id, via, paymentId ?? null],
  );
  if (r) await audit(actorId, "invoice.paid", "invoice", id, { via });
  return !!r;
}
