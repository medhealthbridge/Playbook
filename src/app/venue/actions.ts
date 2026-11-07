"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { audit, q, q1, tx } from "@/lib/server/db";
import { METRO_AREAS, int, pesoToCents, slugify, str } from "@/lib/server/form";
import { requireUser, requireVenueRole, type VenueRole } from "@/lib/server/session";
import { SPORTS } from "@/content/sports";
import { BookingError, confirmBooking, venueById, venueResources } from "@/lib/server/bookings";
import { makeRef, priceCents } from "@/lib/booking/engine";
import { encrypt, decrypt } from "@/lib/server/crypto";
import { PaymongoError, createWebhook, disableWebhook, keyMode, verifySecretKey } from "@/lib/server/paymongo";

const SPORT_IDS = new Set(SPORTS.map((s) => s.id));
const KIND_FOR: Record<string, string> = { billiards: "table", "table-tennis": "table", futsal: "pitch" };
const back = (path: string, msg: { ok?: string; error?: string }) =>
  redirect(`${path}${path.includes("?") ? "&" : "?"}${msg.ok ? `ok=${encodeURIComponent(msg.ok)}` : `error=${encodeURIComponent(msg.error!)}`}`);

function readCourt(f: FormData, i: number) {
  const name = str(f, `court_name_${i}`, 60);
  const sport = str(f, `court_sport_${i}`, 30);
  const rate = pesoToCents(f, `court_rate_${i}`);
  if (!name) return null;
  return { name, sport, rate, indoor: str(f, `court_indoor_${i}`) !== "outdoor" };
}

export async function createVenue(formData: FormData) {
  const user = await requireUser("/venue/new");
  const name = str(formData, "name", 80);
  const area = str(formData, "area", 40);
  const address = str(formData, "address", 200);
  const phone = str(formData, "phone", 30);
  const businessName = str(formData, "business_name", 120);
  const regNo = str(formData, "business_reg_no", 60);
  const description = str(formData, "description", 600);
  const open = str(formData, "open_time", 5) || "07:00";
  const close = str(formData, "close_time", 5) || "22:00";
  const deposit = int(formData, "deposit_percent", 50);
  const cancelHours = int(formData, "free_cancel_hours", 24);
  const courts = [0, 1, 2, 3, 4, 5].map((i) => readCourt(formData, i)).filter((c): c is NonNullable<ReturnType<typeof readCourt>> => !!c);

  const err =
    name.length < 3 ? "Enter the venue name." :
    !METRO_AREAS.includes(area) ? "Choose the city." :
    address.length < 8 ? "Enter the full address." :
    !/^\+?[\d\s-]{7,}$/.test(phone) ? "Enter a contact number." :
    businessName.length < 3 ? "Enter the registered business name." :
    regNo.length < 4 ? "Enter the DTI or SEC registration number." :
    !/^\d{2}:\d{2}$/.test(open) || !/^\d{2}:\d{2}$/.test(close) || open >= close ? "Opening hours look wrong." :
    deposit < 0 || deposit > 100 ? "Deposit must be 0–100%." :
    courts.length === 0 ? "Add at least one court, table or pitch." :
    courts.some((c) => !SPORT_IDS.has(c.sport as never)) ? "Choose a sport for each court." :
    courts.some((c) => !Number.isFinite(c.rate) || c.rate <= 0) ? "Enter an hourly rate for each court." :
    !formData.get("agree") ? "Please accept the venue agreement." : null;
  if (err) back("/venue/new", { error: err });

  const base = slugify(`${name}-${area}`);
  const taken = await q<{ slug: string }>("SELECT slug FROM venue WHERE slug LIKE $1", [`${base}%`]);
  let slug = base;
  for (let n = 2; taken.some((t) => t.slug === slug); n++) slug = `${base}-${n}`;

  const venueId = await tx(async (run) => {
    const [v] = await run<{ id: string }>(
      `INSERT INTO venue (slug, name, area, address, phone, description, business_name, business_reg_no, open_time, close_time, deposit_percent, free_cancel_hours, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
      [slug, name, area, address, phone, description || null, businessName, regNo, open, close, deposit, cancelHours, user.id],
    );
    await run("INSERT INTO venue_member (venue_id, user_id, role) VALUES ($1, $2, 'owner')", [v.id, user.id]);
    let i = 0;
    for (const c of courts) {
      await run(
        `INSERT INTO resource (venue_id, name, kind, sports, indoor, hourly_rate_cents, sort) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [v.id, c.name, KIND_FOR[c.sport] ?? "court", [c.sport], c.indoor, c.rate, i++],
      );
    }
    return v.id;
  });
  await audit(user.id, "venue.create", "venue", venueId, { name, area });
  redirect(`/venue/${venueId}?ok=${encodeURIComponent("Venue submitted. We'll review it and email you once it's approved.")}`);
}

export async function addCourt(formData: FormData) {
  const venueId = str(formData, "venue_id", 60);
  const { user } = await requireVenueRole(venueId, "manager");
  const path = `/venue/${venueId}?tab=courts`;
  const c = readCourt(formData, 0);
  if (!c) back(path, { error: "Enter a name." });
  if (!SPORT_IDS.has(c!.sport as never)) back(path, { error: "Choose a sport." });
  if (!Number.isFinite(c!.rate) || c!.rate <= 0) back(path, { error: "Enter an hourly rate." });
  const r = await q1<{ id: string }>(
    `INSERT INTO resource (venue_id, name, kind, sports, indoor, hourly_rate_cents, sort)
     VALUES ($1,$2,$3,$4,$5,$6,(SELECT coalesce(max(sort),0)+1 FROM resource WHERE venue_id=$1)) RETURNING id`,
    [venueId, c!.name, KIND_FOR[c!.sport] ?? "court", [c!.sport], c!.indoor, c!.rate],
  );
  await audit(user.id, "resource.create", "resource", r!.id, { venueId, name: c!.name });
  revalidatePath(`/venue/${venueId}`);
  back(path, { ok: `${c!.name} added.` });
}

export async function updateCourt(formData: FormData) {
  const venueId = str(formData, "venue_id", 60);
  const id = str(formData, "id", 60);
  const { user } = await requireVenueRole(venueId, "manager");
  const path = `/venue/${venueId}?tab=courts`;
  const rate = pesoToCents(formData, "rate");
  const active = str(formData, "active") === "1";
  if (!Number.isFinite(rate) || rate <= 0) back(path, { error: "Enter a valid hourly rate." });
  await q("UPDATE resource SET hourly_rate_cents=$1, active=$2, updated_at=now() WHERE id=$3 AND venue_id=$4", [rate, active, id, venueId]);
  await audit(user.id, "resource.update", "resource", id, { rate, active });
  revalidatePath(`/venue/${venueId}`);
  back(path, { ok: "Court updated." });
}

export async function updateVenue(formData: FormData) {
  const venueId = str(formData, "venue_id", 60);
  const { user } = await requireVenueRole(venueId, "manager");
  const path = `/venue/${venueId}?tab=settings`;
  const open = str(formData, "open_time", 5);
  const close = str(formData, "close_time", 5);
  const deposit = int(formData, "deposit_percent", 50);
  const cancel = int(formData, "free_cancel_hours", 24);
  const phone = str(formData, "phone", 30);
  const description = str(formData, "description", 600);
  if (!/^\d{2}:\d{2}$/.test(open) || !/^\d{2}:\d{2}$/.test(close) || open >= close) back(path, { error: "Opening hours look wrong." });
  if (deposit < 0 || deposit > 100) back(path, { error: "Deposit must be 0–100%." });
  if (cancel < 0 || cancel > 168) back(path, { error: "Free cancellation must be 0–168 hours." });
  await q(
    "UPDATE venue SET open_time=$1, close_time=$2, deposit_percent=$3, free_cancel_hours=$4, phone=$5, description=$6, updated_at=now() WHERE id=$7",
    [open, close, deposit, cancel, phone, description || null, venueId],
  );
  await audit(user.id, "venue.update", "venue", venueId, { open, close, deposit, cancel });
  revalidatePath(`/venue/${venueId}`);
  back(path, { ok: "Settings saved." });
}

export async function addMember(formData: FormData) {
  const venueId = str(formData, "venue_id", 60);
  const { user, role: myRole } = await requireVenueRole(venueId, "manager");
  const path = `/venue/${venueId}?tab=staff`;
  const email = str(formData, "email", 120).toLowerCase();
  const role = str(formData, "role", 10) as VenueRole;
  if (!["manager", "staff"].includes(role)) back(path, { error: "Choose a role." });
  if (role === "manager" && myRole !== "owner") back(path, { error: "Only the owner can add managers." });
  const target = await q1<{ id: string; name: string }>('SELECT id, name FROM "user" WHERE lower(email) = $1', [email]);
  if (!target) back(path, { error: "No Playbook account uses that email. Ask them to sign up first, then add them." });
  await q(
    "INSERT INTO venue_member (venue_id, user_id, role) VALUES ($1,$2,$3) ON CONFLICT (venue_id, user_id) DO UPDATE SET role = EXCLUDED.role WHERE venue_member.role <> 'owner'",
    [venueId, target!.id, role],
  );
  await audit(user.id, "member.add", "venue", venueId, { userId: target!.id, role });
  revalidatePath(`/venue/${venueId}`);
  back(path, { ok: `${target!.name} added as ${role}.` });
}

export async function removeMember(formData: FormData) {
  const venueId = str(formData, "venue_id", 60);
  const userId = str(formData, "user_id", 60);
  const { user } = await requireVenueRole(venueId, "owner");
  const path = `/venue/${venueId}?tab=staff`;
  await q("DELETE FROM venue_member WHERE venue_id=$1 AND user_id=$2 AND role <> 'owner'", [venueId, userId]);
  await audit(user.id, "member.remove", "venue", venueId, { userId });
  revalidatePath(`/venue/${venueId}`);
  back(path, { ok: "Access removed." });
}

// ---------------------------------------------------------------- Phase 2: calendar

const cal = (venueId: string, date: string) => `/venue/${venueId}?tab=calendar&date=${date}`;
const hm = (s: string) => {
  const m = /^(\d{2}):(\d{2})$/.exec(s);
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
};

export async function walkIn(formData: FormData) {
  const venueId = str(formData, "venue_id", 60);
  const date = str(formData, "date", 10);
  const { user } = await requireVenueRole(venueId, "staff");
  const path = cal(venueId, date);
  const resourceId = str(formData, "resource_id", 60);
  const start = hm(str(formData, "start", 5));
  const dur = int(formData, "duration", 60);
  const name = str(formData, "customer_name", 80) || "Walk-in";
  const phone = str(formData, "customer_phone", 30);
  const paid = pesoToCents(formData, "paid");
  const r = (await venueResources(venueId)).find((x) => x.id === resourceId);
  if (!r) back(path, { error: "Choose a court." });
  if (!Number.isFinite(start) || dur < 15 || dur > 600) back(path, { error: "Check the start time and duration." });
  const price = priceCents(r!.hourly_rate_cents, dur);
  try {
    const row = await q1<{ id: string }>(
      `INSERT INTO booking (ref, venue_id, resource_id, customer_name, customer_phone, sport, date, start_min, end_min, status, source, price_cents, deposit_cents, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'held','walk_in',$10,0,$11) RETURNING id`,
      [makeRef(), venueId, r!.id, name, phone || null, r!.sports[0], date, start, start + dur, price, user.id],
    );
    await confirmBooking(row!.id, { method: Number.isFinite(paid) && paid > 0 ? "cash" : "at_venue", paidCents: Number.isFinite(paid) ? paid : 0, actorId: user.id });
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "23P01") back(path, { error: "That court is already booked at that time." });
    if (e instanceof BookingError) back(path, { error: e.message });
    throw e;
  }
  revalidatePath(`/venue/${venueId}`);
  back(path, { ok: `Walk-in added for ${name}.` });
}

async function staffBooking(formData: FormData) {
  const venueId = str(formData, "venue_id", 60);
  const id = str(formData, "id", 60);
  const { user } = await requireVenueRole(venueId, "staff");
  const b = await q1<{ id: string; date: string; status: string; price_cents: number; paid_cents: number }>(
    "SELECT id, to_char(date,'YYYY-MM-DD') AS date, status, price_cents, paid_cents FROM booking WHERE id=$1 AND venue_id=$2",
    [id, venueId],
  );
  if (!b) back(`/venue/${venueId}?tab=calendar`, { error: "Booking not found." });
  return { user, venueId, b: b! };
}

export async function checkIn(formData: FormData) {
  const { user, venueId, b } = await staffBooking(formData);
  const collected = pesoToCents(formData, "collected");
  if (b.status !== "confirmed") back(cal(venueId, b.date), { error: "Only confirmed bookings can be checked in." });
  const add = Number.isFinite(collected) ? collected : 0;
  await q(
    `UPDATE booking SET checked_in_at=coalesce(checked_in_at, now()), paid_cents=paid_cents+$2,
            payment_status = CASE WHEN paid_cents+$2 >= price_cents THEN 'paid' WHEN paid_cents+$2 > 0 THEN 'deposit_paid' ELSE payment_status END,
            updated_at=now() WHERE id=$1`,
    [b.id, add],
  );
  await audit(user.id, "booking.check_in", "booking", b.id, { collected: add });
  revalidatePath(`/venue/${venueId}`);
  back(cal(venueId, b.date), { ok: `Checked in${add ? `, collected ₱${(add / 100).toLocaleString("en-PH")}` : ""}.` });
}

export async function markNoShow(formData: FormData) {
  const { user, venueId, b } = await staffBooking(formData);
  if (b.status !== "confirmed") back(cal(venueId, b.date), { error: "Only confirmed bookings can be marked as no-show." });
  await q("UPDATE booking SET status='no_show', updated_at=now() WHERE id=$1", [b.id]);
  await audit(user.id, "booking.no_show", "booking", b.id);
  revalidatePath(`/venue/${venueId}`);
  back(cal(venueId, b.date), { ok: "Marked as no-show." });
}

export async function addBlock(formData: FormData) {
  const venueId = str(formData, "venue_id", 60);
  const date = str(formData, "date", 10);
  const { user } = await requireVenueRole(venueId, "manager");
  const path = cal(venueId, date);
  const resourceId = str(formData, "resource_id", 60);
  const s = hm(str(formData, "start", 5));
  const e = hm(str(formData, "end", 5));
  const reason = str(formData, "reason", 120) || "Maintenance";
  if (!(await venueResources(venueId, false)).some((r) => r.id === resourceId)) back(path, { error: "Choose a court." });
  if (!(s < e)) back(path, { error: "End must be after start." });
  const clash = await q1<{ n: number }>(
    "SELECT count(*)::int AS n FROM booking WHERE resource_id=$1 AND date=$2 AND status IN ('held','confirmed') AND start_min < $4 AND end_min > $3",
    [resourceId, date, s, e],
  );
  if (clash!.n > 0) back(path, { error: "There are bookings in that window. Move or cancel them first." });
  await q("INSERT INTO resource_block (resource_id, date, start_min, end_min, reason, created_by) VALUES ($1,$2,$3,$4,$5,$6)", [resourceId, date, s, e, reason, user.id]);
  await audit(user.id, "block.create", "resource", resourceId, { date, s, e, reason });
  revalidatePath(`/venue/${venueId}`);
  back(path, { ok: "Time blocked." });
}

export async function removeBlock(formData: FormData) {
  const venueId = str(formData, "venue_id", 60);
  const date = str(formData, "date", 10);
  const id = str(formData, "id", 60);
  const { user } = await requireVenueRole(venueId, "manager");
  await q("DELETE FROM resource_block b USING resource r WHERE b.id=$1 AND r.id=b.resource_id AND r.venue_id=$2", [id, venueId]);
  await audit(user.id, "block.remove", "venue", venueId, { id });
  revalidatePath(`/venue/${venueId}`);
  back(cal(venueId, date), { ok: "Block removed." });
}

// ---------------------------------------------------------------- Phase 2: payments
export async function connectPaymongo(formData: FormData) {
  const venueId = str(formData, "venue_id", 60);
  const { user } = await requireVenueRole(venueId, "owner");
  const path = `/venue/${venueId}?tab=payments`;
  const pk = str(formData, "public_key", 200);
  const sk = str(formData, "secret_key", 200);
  const pkMode = keyMode(pk);
  const skMode = keyMode(sk);
  if (!pk.startsWith("pk_") || !sk.startsWith("sk_") || !pkMode || pkMode !== skMode) back(path, { error: "Paste your PayMongo public key (pk_…) and secret key (sk_…) from the same mode (test or live)." });
  const base = process.env.BETTER_AUTH_URL || "https://playbook.databridgesol.space";
  try {
    await verifySecretKey(sk);
    const old = await q1<{ id: string | null; s: string | null }>("SELECT paymongo_webhook_id AS id, paymongo_secret_enc AS s FROM venue WHERE id=$1", [venueId]);
    if (old?.id && old.s) await disableWebhook(decrypt(old.s), old.id);
    const wh = await createWebhook(sk, `${base}/api/paymongo/webhook/${venueId}`);
    await q(
      `UPDATE venue SET paymongo_public_key=$2, paymongo_secret_enc=$3, paymongo_webhook_id=$4, paymongo_webhook_secret_enc=$5,
              paymongo_livemode=$6, paymongo_connected_at=now(), updated_at=now() WHERE id=$1`,
      [venueId, pk, encrypt(sk), wh.id, encrypt(wh.secretKey), skMode === "live"],
    );
  } catch (e) {
    if (e instanceof PaymongoError) back(path, { error: `PayMongo said: ${e.message}` });
    console.error("paymongo connect failed", e);
    back(path, { error: "Couldn't reach PayMongo. Please try again." });
  }
  await audit(user.id, "payments.connect", "venue", venueId, { mode: skMode });
  revalidatePath(`/venue/${venueId}`);
  back(path, { ok: `PayMongo connected (${skMode} mode). Players can now pay you online.` });
}

export async function disconnectPaymongo(formData: FormData) {
  const venueId = str(formData, "venue_id", 60);
  const { user } = await requireVenueRole(venueId, "owner");
  const old = await q1<{ id: string | null; s: string | null }>("SELECT paymongo_webhook_id AS id, paymongo_secret_enc AS s FROM venue WHERE id=$1", [venueId]);
  if (old?.id && old.s) await disableWebhook(decrypt(old.s), old.id).catch(() => {});
  await q(
    `UPDATE venue SET paymongo_public_key=NULL, paymongo_secret_enc=NULL, paymongo_webhook_id=NULL, paymongo_webhook_secret_enc=NULL,
            paymongo_livemode=NULL, paymongo_connected_at=NULL, updated_at=now() WHERE id=$1`,
    [venueId],
  );
  await audit(user.id, "payments.disconnect", "venue", venueId);
  revalidatePath(`/venue/${venueId}`);
  back(`/venue/${venueId}?tab=payments`, { ok: "PayMongo disconnected." });
}

export async function setPayAtVenue(formData: FormData) {
  const venueId = str(formData, "venue_id", 60);
  const { user } = await requireVenueRole(venueId, "manager");
  const allow = str(formData, "allow") === "1";
  const v = await venueById(venueId);
  if (!allow && !v?.paymongo_connected_at) back(`/venue/${venueId}?tab=payments`, { error: "Connect PayMongo before turning off pay-at-venue, or players can't book." });
  await q("UPDATE venue SET allow_pay_at_venue=$2, updated_at=now() WHERE id=$1", [venueId, allow]);
  await audit(user.id, "payments.pay_at_venue", "venue", venueId, { allow });
  revalidatePath(`/venue/${venueId}`);
  back(`/venue/${venueId}?tab=payments`, { ok: allow ? "Players can confirm now and pay at the venue." : "Players must pay online to confirm." });
}
