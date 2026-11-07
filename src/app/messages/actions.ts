"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { audit, q, q1 } from "@/lib/server/db";
import { actionEmail, sendEmail } from "@/lib/server/email";
import { str } from "@/lib/server/form";
import { getSession, isPlatformAdmin, requireVenueRole, venueRole } from "@/lib/server/session";

const base = () => process.env.BETTER_AUTH_URL || "https://playbook.databridgesol.space";
const to = (path: string, m: { ok?: string; error?: string }) =>
  redirect(`${path}${path.includes("?") ? "&" : "?"}${m.ok ? `ok=${encodeURIComponent(m.ok)}` : `error=${encodeURIComponent(m.error!)}`}`);

/** Player or venue staff writes on a booking's thread; the other side gets an email. */
export async function postBookingMessage(formData: FormData) {
  const id = str(formData, "booking_id", 60);
  const path = `/bookings/${id}`;
  const auth = await getSession();
  if (!auth) redirect(`/login?next=${encodeURIComponent(path)}`);
  const body = str(formData, "body", 2000);
  if (!body) to(path, { error: "Write a message first." });
  const b = await q1<{ id: string; ref: string; user_id: string | null; venue_id: string; customer_email: string | null; venue: string }>(
    "SELECT b.id, b.ref, b.user_id, b.venue_id, b.customer_email, v.name AS venue FROM booking b JOIN venue v ON v.id=b.venue_id WHERE b.id=$1",
    [id],
  );
  if (!b) redirect("/account");
  const isPlayer = b!.user_id === auth!.user.id;
  const staff = isPlatformAdmin(auth!.user) || !!(await venueRole(auth!.user.id, b!.venue_id));
  if (!isPlayer && !staff) redirect("/account");
  const side = isPlayer && str(formData, "as") !== "venue" ? "player" : "venue";
  await q("INSERT INTO booking_message (booking_id, author_id, author_side, body) VALUES ($1,$2,$3,$4)", [id, auth!.user.id, side, body]);
  const preview = body.length > 280 ? `${body.slice(0, 280)}…` : body;
  if (side === "player") {
    const staffEmails = await q<{ email: string }>(`SELECT u.email FROM venue_member m JOIN "user" u ON u.id=m.user_id WHERE m.venue_id=$1 AND m.role IN ('owner','manager')`, [b!.venue_id]);
    for (const s of staffEmails) {
      const m = actionEmail(`Message on booking ${b!.ref}`, `${auth!.user.name}: ${preview}`, "Reply", `${base()}${path}`);
      await sendEmail({ to: s.email, subject: `New message · ${b!.ref}`, ...m }).catch(() => {});
    }
  } else if (b!.customer_email) {
    const m = actionEmail(`${b!.venue} replied`, preview, "View conversation", `${base()}${path}`);
    await sendEmail({ to: b!.customer_email, subject: `Message from ${b!.venue} · ${b!.ref}`, ...m }).catch(() => {});
  }
  // Re-render the booking page in place (React resets the form after the action).
  revalidatePath(path);
}

export async function toggleFollow(formData: FormData) {
  const venueId = str(formData, "venue_id", 60);
  const slug = str(formData, "slug", 80);
  const path = `/venues/${slug}`;
  const auth = await getSession();
  if (!auth) redirect(`/login?next=${encodeURIComponent(path)}`);
  const existing = await q1<{ venue_id: string }>("SELECT venue_id FROM venue_follower WHERE venue_id=$1 AND user_id=$2", [venueId, auth!.user.id]);
  if (existing) await q("DELETE FROM venue_follower WHERE venue_id=$1 AND user_id=$2", [venueId, auth!.user.id]);
  else await q("INSERT INTO venue_follower (venue_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [venueId, auth!.user.id]);
  revalidatePath(path);
  to(path, { ok: existing ? "Unfollowed." : "Following. You'll get this venue's announcements." });
}

export async function postAnnouncement(formData: FormData) {
  const venueId = str(formData, "venue_id", 60);
  const { user } = await requireVenueRole(venueId, "manager");
  const path = `/venue/${venueId}?tab=announcements`;
  const title = str(formData, "title", 120);
  const body = str(formData, "body", 2000);
  if (title.length < 3 || body.length < 3) to(path, { error: "Add a title and a message." });
  const v = await q1<{ name: string; slug: string; status: string }>("SELECT name, slug, status FROM venue WHERE id=$1", [venueId]);
  const a = await q1<{ id: string }>("INSERT INTO venue_announcement (venue_id, title, body, created_by) VALUES ($1,$2,$3,$4) RETURNING id", [venueId, title, body, user.id]);
  let sent = 0;
  if (str(formData, "email") === "1" && v?.status === "active") {
    const followers = await q<{ email: string }>(`SELECT u.email FROM venue_follower f JOIN "user" u ON u.id=f.user_id WHERE f.venue_id=$1 AND f.email_ok LIMIT 2000`, [venueId]);
    for (const f of followers) {
      const m = actionEmail(`${v!.name}: ${title}`, body.length > 600 ? `${body.slice(0, 600)}…` : body, `Visit ${v!.name}`, `${base()}/venues/${v!.slug}`);
      await sendEmail({ to: f.email, subject: `${v!.name}: ${title}`, ...m }).then(() => sent++).catch(() => {});
    }
  }
  await audit(user.id, "announcement.post", "venue", venueId, { id: a!.id, emailed: sent });
  revalidatePath(path);
  to(path, { ok: `Posted.${sent ? ` Emailed to ${sent} follower${sent > 1 ? "s" : ""}.` : ""}` });
}

export async function deleteAnnouncement(formData: FormData) {
  const venueId = str(formData, "venue_id", 60);
  const { user } = await requireVenueRole(venueId, "manager");
  const removed = await q("DELETE FROM venue_announcement WHERE id=$1 AND venue_id=$2 RETURNING id", [str(formData, "id", 60), venueId]);
  if (removed.length === 0) to(`/venue/${venueId}?tab=announcements`, { error: "Announcement not found at this venue." });
  await audit(user.id, "announcement.delete", "venue", venueId);
  revalidatePath(`/venue/${venueId}`);
  to(`/venue/${venueId}?tab=announcements`, { ok: "Announcement removed." });
}
