"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  BookingError, bookingById, cancelBookingRow, confirmBooking, createHold, venueById, venueBySlug, venueResources,
} from "@/lib/server/bookings";
import { decrypt } from "@/lib/server/crypto";
import { audit, q, q1, tx } from "@/lib/server/db";
import { depositCents } from "@/lib/booking/engine";
import { readRentalLines, rentalTotal, replaceRentalLines } from "@/lib/server/rentals";
import { int, str } from "@/lib/server/form";
import { emailBookingCancelled, emailBookingConfirmed } from "@/lib/server/notify";
import { createCheckout, refund } from "@/lib/server/paymongo";
import { getSession, isPlatformAdmin, venueRole } from "@/lib/server/session";

const base = () => process.env.BETTER_AUTH_URL || "https://playbook.databridgesol.space";
const err = (path: string, message: string) => redirect(`${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(message)}`);

async function courtName(id: string) {
  return (await q1<{ name: string }>("SELECT name FROM resource WHERE id=$1", [id]))?.name ?? "Court";
}

export async function holdBooking(formData: FormData) {
  const slug = str(formData, "slug", 80);
  const resourceId = str(formData, "resource_id", 60);
  const date = str(formData, "date", 10);
  const dur = int(formData, "duration", 60);
  const start = int(formData, "start", -1);
  const sport = str(formData, "sport", 30);
  const back = `/venues/${slug}?court=${resourceId}&date=${date}&dur=${dur}&sport=${sport}`;
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(back)}`);
  const venue = await venueBySlug(slug);
  if (!venue) err("/venues", "Venue not found.");
  const resource = (await venueResources(venue!.id)).find((r) => r.id === resourceId);
  if (!resource) err(back, "Choose a court.");
  let id: string;
  try {
    id = await createHold({ venue: venue!, resource: resource!, date, startMin: start, durationMin: dur, sport, user: session!.user, phone: str(formData, "phone", 30) });
  } catch (e) {
    if (e instanceof BookingError) err(back, e.message);
    throw e;
  }
  redirect(`/bookings/${id!}`);
}

async function loadForPlayer(formData: FormData) {
  const id = str(formData, "id", 60);
  const session = await getSession();
  if (!session) redirect(`/login?next=/bookings/${id}`);
  const b = await bookingById(id);
  if (!b || b.user_id !== session!.user.id) err("/account", "Booking not found.");
  const v = (await venueById(b!.venue_id))!;
  return { b: b!, v, user: session!.user };
}

export async function confirmAtVenue(formData: FormData) {
  const { b, v, user } = await loadForPlayer(formData);
  if (!v.allow_pay_at_venue) err(`/bookings/${b.id}`, "This venue requires online payment.");
  try {
    const done = await confirmBooking(b.id, { method: "at_venue", actorId: user.id });
    await emailBookingConfirmed(done, v, await courtName(b.resource_id));
  } catch (e) {
    if (e instanceof BookingError) err(`/bookings/${b.id}`, e.message);
    throw e;
  }
  revalidatePath(`/bookings/${b.id}`);
  redirect(`/bookings/${b.id}?ok=${encodeURIComponent("Confirmed. See you on court!")}`);
}

export async function payOnline(formData: FormData) {
  const { b, v } = await loadForPlayer(formData);
  if (b.status !== "held") err(`/bookings/${b.id}`, "This booking isn't waiting for payment.");
  const enc = await q1<{ s: string | null }>("SELECT paymongo_secret_enc AS s FROM venue WHERE id=$1", [v.id]);
  if (!enc?.s) err(`/bookings/${b.id}`, "This venue hasn't set up online payments yet.");
  const amount = b.deposit_cents > 0 ? b.deposit_cents : b.price_cents;
  let url: string;
  try {
    const c = await createCheckout(decrypt(enc!.s!), {
      amountCents: amount,
      name: `${b.deposit_cents > 0 && b.deposit_cents < b.price_cents ? "Deposit · " : ""}${v.name} · ${await courtName(b.resource_id)}`,
      description: `Booking ${b.ref} on ${b.date}`,
      reference: b.ref,
      successUrl: `${base()}/bookings/${b.id}?paid=1`,
      cancelUrl: `${base()}/bookings/${b.id}`,
      customer: { name: b.customer_name, email: b.customer_email ?? "", phone: b.customer_phone },
      metadata: { booking_id: b.id, venue_id: v.id },
    });
    await q("UPDATE booking SET checkout_session_id=$2, hold_expires_at = greatest(hold_expires_at, now() + interval '15 minutes'), updated_at=now() WHERE id=$1", [b.id, c.id]);
    url = c.url;
  } catch (e) {
    console.error("checkout failed", e);
    err(`/bookings/${b.id}`, "Couldn't start the payment. Please try again.");
  }
  redirect(url!);
}

/** Player cancels their own booking; venue staff/admins cancel any booking at their venue. */
export async function cancelBooking(formData: FormData) {
  const id = str(formData, "id", 60);
  const reason = str(formData, "reason", 200) || "Cancelled by player";
  const session = await getSession();
  if (!session) redirect(`/login?next=/bookings/${id}`);
  const user = session!.user;
  const b = await bookingById(id);
  if (!b) err("/account", "Booking not found.");
  const role = isPlatformAdmin(user) ? "owner" : await venueRole(user.id, b!.venue_id);
  const isOwner = b!.user_id === user.id;
  if (!isOwner && !role) err("/account", "Booking not found.");
  const byVenue = !isOwner || (!!role && str(formData, "as") === "venue");
  const v = (await venueById(b!.venue_id))!;
  let refundCents = 0;
  try {
    refundCents = await cancelBookingRow(b!, v, user.id, byVenue ? reason || "Cancelled by venue" : reason, byVenue);
  } catch (e) {
    if (e instanceof BookingError) err(`/bookings/${id}`, e.message);
    throw e;
  }
  if (refundCents > 0 && b!.pay_method === "online" && b!.payment_id) {
    const enc = await q1<{ s: string | null }>("SELECT paymongo_secret_enc AS s FROM venue WHERE id=$1", [v.id]);
    if (enc?.s) {
      await refund(decrypt(enc.s), b!.payment_id, refundCents, `Playbook ${b!.ref}`).catch(async (e) => {
        console.error("refund failed", e);
        await q("UPDATE booking SET notes = concat_ws(E'\\n', notes, $2) WHERE id=$1", [id, `Refund of ${refundCents / 100} PHP failed to process automatically; refund manually in PayMongo.`]);
      });
    }
  }
  await emailBookingCancelled(b!, v, refundCents);
  revalidatePath(`/bookings/${id}`);
  const back = str(formData, "back", 200);
  const msg = `Cancelled.${refundCents > 0 ? ` Refund: ₱${(refundCents / 100).toLocaleString("en-PH")}.` : ""}`;
  redirect(`${back.startsWith("/venue/") ? back : `/bookings/${id}`}${back.includes("?") ? "&" : "?"}ok=${encodeURIComponent(msg)}`);
}

/** Step before paying: how many people are coming, and any rentals. Prices come from the venue's own rental list. */
export async function updateBookingExtras(formData: FormData) {
  const { b, v, user } = await loadForPlayer(formData);
  const path = `/bookings/${b.id}`;
  if (b.status !== "held") err(path, "Extras can only be changed before the booking is confirmed.");
  const party = int(formData, "party_size", 0);
  if (party < 1 || party > 60) err(path, "Enter how many people are playing (1 to 60).");
  const lines = await readRentalLines(formData, v.id);
  const rental = rentalTotal(lines);
  const court = b.price_cents - b.rental_cents;
  await tx(async (run) => {
    await replaceRentalLines(run, v.id, { bookingId: b.id }, lines);
    await run("UPDATE booking SET party_size=$2, rental_cents=$3, price_cents=$4, deposit_cents=$5, updated_at=now() WHERE id=$1 AND status='held'",
      [b.id, party, rental, court + rental, depositCents(court + rental, v.deposit_percent)]);
  });
  await audit(user.id, "booking.extras", "booking", b.id, { party, rental });
  revalidatePath(path);
  redirect(`${path}?ok=${encodeURIComponent("Saved. Now confirm your booking below.")}`);
}
