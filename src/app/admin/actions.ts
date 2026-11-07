"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { audit, q, q1 } from "@/lib/server/db";
import { actionEmail, sendEmail } from "@/lib/server/email";
import { int, str } from "@/lib/server/form";
import { requireAdmin } from "@/lib/server/session";
import { PLAN_IDS, generateInvoices, markInvoicePaid, platformPaymongo, putSetting } from "@/lib/server/billing";
import { decrypt, encrypt } from "@/lib/server/crypto";
import { PaymongoError, createWebhook, disableWebhook, keyMode, verifySecretKey } from "@/lib/server/paymongo";

const back = (tab: string, msg: { ok?: string; error?: string }) =>
  redirect(`/admin?tab=${tab}&${msg.ok ? `ok=${encodeURIComponent(msg.ok)}` : `error=${encodeURIComponent(msg.error!)}`}`);

async function notifyOwners(venueId: string, subject: string, heading: string, body: string) {
  const owners = await q<{ email: string }>(`SELECT u.email FROM venue_member m JOIN "user" u ON u.id=m.user_id WHERE m.venue_id=$1 AND m.role='owner'`, [venueId]);
  const base = process.env.BETTER_AUTH_URL || "https://playbook.databridgesol.space";
  for (const o of owners) {
    const m = actionEmail(heading, body, "Open your venue dashboard", `${base}/venue/${venueId}`);
    await sendEmail({ to: o.email, subject, ...m }).catch((e) => console.error("notify failed", e));
  }
}

export async function setVenueStatus(formData: FormData) {
  const admin = await requireAdmin();
  const id = str(formData, "id", 60);
  const action = str(formData, "action", 20);
  const reason = str(formData, "reason", 300);
  const v = await q1<{ name: string; status: string }>("SELECT name, status FROM venue WHERE id=$1", [id]);
  if (!v) back("venues", { error: "Venue not found." });
  if ((action === "reject" || action === "suspend") && reason.length < 5) back("venues", { error: "Give the owner a reason (at least 5 characters)." });

  if (action === "approve") {
    const days = Number((await q1<{ value: unknown }>("SELECT value FROM platform_setting WHERE key='trial_days'"))?.value ?? 30);
    await q(
      `UPDATE venue SET status='active', status_reason=NULL, approved_by=$2, approved_at=now(),
              trial_ends_at = CASE WHEN plan='trial' AND trial_ends_at IS NULL THEN now() + make_interval(days => $3) ELSE trial_ends_at END,
              updated_at=now() WHERE id=$1`,
      [id, admin.id, days],
    );
    await notifyOwners(id, `${v!.name} is live on Playbook`, "Your venue is approved", `${v!.name} is now live. Your ${days}-day free trial has started.`);
  } else if (action === "reject" || action === "suspend") {
    await q("UPDATE venue SET status=$2, status_reason=$3, updated_at=now() WHERE id=$1", [id, action === "reject" ? "rejected" : "suspended", reason]);
    await notifyOwners(id, `Update on ${v!.name}`, action === "reject" ? "Your venue wasn't approved" : "Your venue is suspended", reason);
  } else if (action === "reactivate") {
    await q("UPDATE venue SET status='active', status_reason=NULL, updated_at=now() WHERE id=$1", [id]);
    await notifyOwners(id, `${v!.name} is active again`, "Your venue is active again", "New bookings are open again.");
  } else back("venues", { error: "Unknown action." });

  await audit(admin.id, `venue.${action}`, "venue", id, reason ? { reason } : {});
  revalidatePath("/admin");
  back("venues", { ok: `${v!.name}: ${action} done.` });
}

export async function setUserRole(formData: FormData) {
  const admin = await requireAdmin();
  const id = str(formData, "id", 60);
  const role = str(formData, "role", 10);
  if (!["admin", "user"].includes(role)) back("users", { error: "Unknown role." });
  if (id === admin.id && role !== "admin") back("users", { error: "You can't remove your own admin access." });
  await q('UPDATE "user" SET role=$2, "updatedAt"=now() WHERE id=$1', [id, role]);
  await audit(admin.id, "user.role", "user", id, { role });
  revalidatePath("/admin");
  back("users", { ok: "Role updated." });
}

export async function setUserBan(formData: FormData) {
  const admin = await requireAdmin();
  const id = str(formData, "id", 60);
  const ban = str(formData, "ban") === "1";
  const reason = str(formData, "reason", 200);
  if (id === admin.id) back("users", { error: "You can't ban yourself." });
  await q('UPDATE "user" SET banned=$2, "banReason"=$3, "updatedAt"=now() WHERE id=$1', [id, ban, ban ? reason || "Violation of terms" : null]);
  if (ban) await q('DELETE FROM session WHERE "userId"=$1', [id]);
  await audit(admin.id, ban ? "user.ban" : "user.unban", "user", id, reason ? { reason } : {});
  revalidatePath("/admin");
  back("users", { ok: ban ? "User banned and signed out." : "User unbanned." });
}

export async function saveSettings(formData: FormData) {
  const admin = await requireAdmin();
  const percent = Number.parseFloat(str(formData, "fee_percent", 10));
  const min = Math.round(Number.parseFloat(str(formData, "fee_min", 10)) * 100);
  const max = Math.round(Number.parseFloat(str(formData, "fee_max", 10)) * 100);
  const trial = int(formData, "trial_days", 30);
  if (!(percent >= 0 && percent <= 30) || !(min >= 0) || !(max >= min)) back("settings", { error: "Check the fee values (0–30%, min ≤ max)." });
  if (trial < 0 || trial > 180) back("settings", { error: "Trial must be 0–180 days." });
  const fee = { type: "percent", percent, min_cents: min, max_cents: max };
  await q("INSERT INTO platform_setting (key, value, updated_by, updated_at) VALUES ('booking_fee',$1,$2,now()) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_by=EXCLUDED.updated_by, updated_at=now()", [JSON.stringify(fee), admin.id]);
  await q("INSERT INTO platform_setting (key, value, updated_by, updated_at) VALUES ('trial_days',$1,$2,now()) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_by=EXCLUDED.updated_by, updated_at=now()", [JSON.stringify(trial), admin.id]);
  await audit(admin.id, "settings.update", "platform", null, { fee, trial });
  revalidatePath("/admin");
  back("settings", { ok: "Settings saved. New values apply to new bookings and new venues." });
}

// ---------------------------------------------------------------- Phase 3: billing

export async function runInvoices(formData: FormData) {
  const admin = await requireAdmin();
  const month = str(formData, "month", 7);
  if (!/^\d{4}-\d{2}$/.test(month)) back("billing", { error: "Pick a month." });
  const r = await generateInvoices(month, admin.id);
  revalidatePath("/admin");
  redirect(`/admin?tab=billing&month=${month}&ok=${encodeURIComponent(`${r.created} invoice(s) created, ${r.skipped} skipped (nothing to bill or already invoiced).`)}`);
}

export async function setInvoiceStatus(formData: FormData) {
  const admin = await requireAdmin();
  const id = str(formData, "id", 60);
  const action = str(formData, "action", 10);
  const note = str(formData, "note", 200);
  if (action === "paid") {
    await markInvoicePaid(id, `manual${note ? `: ${note}` : ""}`, admin.id);
  } else if (action === "void") {
    await q("UPDATE invoice SET status='void', note=$2 WHERE id=$1 AND status='open'", [id, note || "Voided"]);
    await audit(admin.id, "invoice.void", "invoice", id, { note });
  } else back("billing", { error: "Unknown action." });
  revalidatePath("/admin");
  back("billing", { ok: action === "paid" ? "Invoice marked as paid." : "Invoice voided." });
}

export async function saveBilling(formData: FormData) {
  const admin = await requireAdmin();
  const prices = Object.fromEntries(PLAN_IDS.map((p) => [p, Math.round(Number.parseFloat(str(formData, `price_${p}`, 12) || "0") * 100)]));
  if (Object.values(prices).some((c) => !(c >= 0))) back("settings", { error: "Plan prices must be zero or more." });
  const dueDays = int(formData, "due_days", 7);
  if (dueDays < 0 || dueDays > 60) back("settings", { error: "Payment terms must be 0–60 days." });
  await putSetting("plan_prices", prices, admin.id);
  await putSetting("billing", { manual_instructions: str(formData, "manual_instructions", 600), due_days: dueDays }, admin.id);
  await audit(admin.id, "billing.settings", "platform", null, { prices, dueDays });
  revalidatePath("/admin");
  back("settings", { ok: "Billing settings saved." });
}

export async function connectPlatformPaymongo(formData: FormData) {
  const admin = await requireAdmin();
  const pk = str(formData, "public_key", 200);
  const sk = str(formData, "secret_key", 200);
  const mode = keyMode(sk);
  if (!pk.startsWith("pk_") || !sk.startsWith("sk_") || !mode || keyMode(pk) !== mode) back("settings", { error: "Paste your PayMongo public and secret keys from the same mode." });
  const base = process.env.BETTER_AUTH_URL || "https://playbook.databridgesol.space";
  try {
    await verifySecretKey(sk);
    const old = await platformPaymongo();
    if (old) await disableWebhook(decrypt(old.secret_enc), old.webhook_id);
    const wh = await createWebhook(sk, `${base}/api/paymongo/platform`);
    await putSetting("platform_paymongo", { public_key: pk, secret_enc: encrypt(sk), webhook_id: wh.id, webhook_secret_enc: encrypt(wh.secretKey), livemode: mode === "live", connected_at: new Date().toISOString() }, admin.id);
  } catch (e) {
    if (e instanceof PaymongoError) back("settings", { error: `PayMongo said: ${e.message}` });
    console.error("platform paymongo connect failed", e);
    back("settings", { error: "Couldn't reach PayMongo. Please try again." });
  }
  await audit(admin.id, "billing.paymongo_connect", "platform", null, { mode });
  revalidatePath("/admin");
  back("settings", { ok: `Your PayMongo account is connected (${mode} mode). Venues can pay invoices online.` });
}
