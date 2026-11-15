import "server-only";
import { addDays } from "@/lib/booking/time";
import { weekRange, type CutRule } from "@/lib/booking/engine";
import { audit, q, q1 } from "./db";
import { actionEmail, sendEmail } from "./email";

export type CutSettings = { open_play: CutRule; court: CutRule; staff_bookings: boolean };
export type BillingSettings = { manual_instructions: string; due_days: number; auto_pause?: boolean };
export type PlatformPaymongo = { public_key: string; secret_enc: string; webhook_id: string; webhook_secret_enc: string; livemode: boolean; connected_at: string };

export const DEFAULT_CUT: CutSettings = {
  open_play: { mode: "fixed", value: 3000, min_cents: 0 },
  court: { mode: "percent", value: 20, min_cents: 0 },
  staff_bookings: true,
};

async function setting<T>(key: string, fallback: T): Promise<T> {
  const r = await q1<{ value: T }>("SELECT value FROM platform_setting WHERE key=$1", [key]);
  return (r?.value as T) ?? fallback;
}
export const cutSettings = async (): Promise<CutSettings> => ({ ...DEFAULT_CUT, ...(await setting<Partial<CutSettings>>("cut", {})) });
export const billingSettings = async (): Promise<Required<BillingSettings>> => ({ manual_instructions: "", due_days: 7, auto_pause: true, ...(await setting<Partial<BillingSettings>>("billing", {})) });
export const platformPaymongo = () => setting<PlatformPaymongo | null>("platform_paymongo", null);

export async function putSetting(key: string, value: unknown, actorId: string) {
  await q(
    "INSERT INTO platform_setting (key, value, updated_by, updated_at) VALUES ($1,$2,$3,now()) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_by=EXCLUDED.updated_by, updated_at=now()",
    [key, JSON.stringify(value), actorId],
  );
}

/** Playbook's cut for a period: court bookings by play date, open play by check-in date. Voided and cancelled entries carry no cut. */
export async function usageFor(venueId: string, start: string, end: string) {
  const [court, play] = await Promise.all([
    q1<{ n: number; fees: number }>(
      `SELECT count(*)::int AS n, coalesce(sum(platform_fee_cents),0)::int AS fees FROM booking
        WHERE venue_id=$1 AND platform_fee_cents > 0 AND status IN ('confirmed','completed','no_show') AND date BETWEEN $2 AND $3`,
      [venueId, start, end],
    ),
    q1<{ n: number; fees: number }>(
      `SELECT count(*)::int AS n, coalesce(sum(p.platform_fee_cents),0)::int AS fees FROM open_play_player p JOIN open_play_session s ON s.id=p.session_id
        WHERE s.venue_id=$1 AND p.platform_fee_cents > 0 AND (p.checked_in_at AT TIME ZONE 'Asia/Manila')::date BETWEEN $2 AND $3`,
      [venueId, start, end],
    ),
  ]);
  return { courtCount: court!.n, courtFees: court!.fees, playCount: play!.n, playFees: play!.fees, total: court!.fees + play!.fees };
}

/** True when the venue has a statement past its due date and auto-pause is on: no new bookings or check-ins until it is paid. */
export async function venuePaused(venueId: string): Promise<boolean> {
  const b = await billingSettings();
  if (!b.auto_pause) return false;
  const r = await q1<{ n: number }>(
    "SELECT count(*)::int AS n FROM invoice WHERE venue_id=$1 AND status='open' AND due_date < (now() AT TIME ZONE 'Asia/Manila')::date",
    [venueId],
  );
  return (r?.n ?? 0) > 0;
}

/** Create statements for every venue for the Monday-Sunday week containing `date`. Idempotent per venue+week. */
export async function generateInvoices(date: string, actorId: string | null) {
  const { start, end } = weekRange(date);
  const billing = await billingSettings();
  const venues = await q<{ id: string }>(
    "SELECT id FROM venue WHERE status IN ('active','suspended') AND approved_at IS NOT NULL AND (approved_at AT TIME ZONE 'Asia/Manila')::date <= $1",
    [end],
  );
  let created = 0;
  let skipped = 0;
  for (const v of venues) {
    const u = await usageFor(v.id, start, end);
    if (u.total <= 0) {
      skipped++;
      continue;
    }
    const number = `ST-${start.replaceAll("-", "")}-${v.id.slice(0, 6).toUpperCase()}`;
    const row = await q1<{ id: string }>(
      `INSERT INTO invoice (number, venue_id, period_start, period_end, plan, subscription_cents, booking_count, booking_fee_cents, open_play_count, open_play_fee_cents, total_cents, due_date, created_by)
       VALUES ($1,$2,$3,$4,'free',0,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (venue_id, period_start) DO NOTHING RETURNING id`,
      [number, v.id, start, end, u.courtCount, u.courtFees, u.playCount, u.playFees, u.total, addDays(end, 1 + (billing.due_days ?? 7)), actorId],
    );
    if (row) {
      created++;
      await emailInvoice(row.id).catch((e) => console.error("statement email failed", e));
    } else skipped++;
  }
  await audit(actorId, "invoices.generate", "platform", null, { start, end, created, skipped });
  return { start, end, created, skipped };
}

export async function markInvoicePaid(id: string, via: string, actorId: string | null, paymentId?: string) {
  const r = await q1<{ id: string }>(
    "UPDATE invoice SET status='paid', paid_at=now(), paid_via=$2, payment_id=coalesce($3, payment_id) WHERE id=$1 AND status='open' RETURNING id",
    [id, via, paymentId ?? null],
  );
  if (r) await audit(actorId, "invoice.paid", "invoice", id, { via });
  return !!r;
}

/** Email the venue owner(s) that an invoice is ready. */
export async function emailInvoice(invoiceId: string) {
  const inv = await q1<{ number: string; total_cents: number; due: string; venue_id: string; venue: string }>(
    "SELECT i.number, i.total_cents, to_char(i.due_date,'Mon DD, YYYY') AS due, v.id AS venue_id, v.name AS venue FROM invoice i JOIN venue v ON v.id=i.venue_id WHERE i.id=$1",
    [invoiceId],
  );
  if (!inv) return;
  const owners = await q<{ email: string }>(`SELECT u.email FROM venue_member m JOIN "user" u ON u.id=m.user_id WHERE m.venue_id=$1 AND m.role='owner'`, [inv.venue_id]);
  const base = process.env.BETTER_AUTH_URL || "https://playbook.databridgesol.space";
  const amount = `₱${(inv.total_cents / 100).toLocaleString("en-PH")}`;
  for (const o of owners) {
    const m = actionEmail(`Statement ${inv.number}`, `Your weekly Playbook statement for ${inv.venue} is ready: ${amount}, due ${inv.due}. New bookings and check-ins pause if it is unpaid after the due date.`, "View and pay statement", `${base}/venue/${inv.venue_id}/invoice/${invoiceId}`);
    await sendEmail({ to: o.email, subject: `Playbook statement ${inv.number} · ${amount}`, ...m });
  }
}
