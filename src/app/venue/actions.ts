"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { audit, q, q1, tx } from "@/lib/server/db";
import { METRO_AREAS, int, pesoToCents, slugify, str } from "@/lib/server/form";
import { requireUser, requireVenueRole, type VenueRole } from "@/lib/server/session";
import { SPORTS } from "@/content/sports";

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
