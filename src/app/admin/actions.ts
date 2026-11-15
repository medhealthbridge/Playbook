"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { audit, q, q1 } from "@/lib/server/db";
import { actionEmail, sendEmail } from "@/lib/server/email";
import { int, str } from "@/lib/server/form";
import { requireAdmin } from "@/lib/server/session";
import { generateInvoices, markInvoicePaid, platformPaymongo, putSetting } from "@/lib/server/billing";
import type { CutRule } from "@/lib/booking/engine";
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
    await q(
      `UPDATE venue SET status='active', status_reason=NULL, approved_by=$2, approved_at=now(),
              updated_at=now() WHERE id=$1`,
      [id, admin.id],
    );
    await notifyOwners(id, `${v!.name} is live on Playbook`, "Your venue is approved", `${v!.name} is now live. Listing is free: Playbook keeps a small cut per player or court booking, billed weekly.`);
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

function readRule(formData: FormData, key: string): CutRule | null {
  const mode = str(formData, `${key}_mode`, 10) === "percent" ? "percent" : "fixed";
  const raw = Number.parseFloat(str(formData, `${key}_value`, 12));
  const min = Math.round(Number.parseFloat(str(formData, `${key}_min`, 12) || "0") * 100);
  if (!(raw >= 0) || !(min >= 0)) return null;
  if (mode === "percent") return raw <= 100 ? { mode, value: raw, min_cents: min } : null;
  return { mode, value: Math.round(raw * 100), min_cents: 0 };
}

/** Playbook's cut: fully admin-controlled, nothing fixed in code. Applies to check-ins and bookings made after saving. */
export async function saveSettings(formData: FormData) {
  const admin = await requireAdmin();
  const openPlay = readRule(formData, "op");
  const court = readRule(formData, "court");
  if (!openPlay || !court) back("settings", { error: "Check the cut values: amounts must be zero or more, percentages 0–100." });
  const cut = { open_play: openPlay!, court: court!, staff_bookings: str(formData, "staff_bookings") === "1" };
  await putSetting("cut", cut, admin.id);
  await audit(admin.id, "settings.update", "platform", null, { cut });
  revalidatePath("/admin");
  back("settings", { ok: "Cut saved. It applies to new check-ins and new bookings from now on." });
}

// ---------------------------------------------------------------- statements

export async function runInvoices(formData: FormData) {
  const admin = await requireAdmin();
  const date = str(formData, "date", 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) back("billing", { error: "Pick a date in the week to bill." });
  const r = await generateInvoices(date, admin.id);
  revalidatePath("/admin");
  redirect(`/admin?tab=billing&ok=${encodeURIComponent(`Week ${r.start} to ${r.end}: ${r.created} statement(s) created, ${r.skipped} skipped (nothing owed or already created).`)}`);
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
  back("billing", { ok: action === "paid" ? "Statement marked as paid. The venue is unpaused if nothing else is overdue." : "Statement voided." });
}

export async function saveBilling(formData: FormData) {
  const admin = await requireAdmin();
  const dueDays = int(formData, "due_days", 7);
  if (dueDays < 0 || dueDays > 60) back("settings", { error: "Days to pay must be 0–60." });
  const billing = { manual_instructions: str(formData, "manual_instructions", 600), due_days: dueDays, auto_pause: str(formData, "auto_pause") === "1" };
  await putSetting("billing", billing, admin.id);
  await audit(admin.id, "billing.settings", "platform", null, { dueDays, auto_pause: billing.auto_pause });
  revalidatePath("/admin");
  back("settings", { ok: "Statement settings saved." });
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
