import "server-only";
import { addDays, manilaToday } from "@/lib/booking/time";
import {
  HOLD_MIN, availableStarts, canCancel, depositCents, durationChoices, hmToMin, makeRef, platformFeeCents, priceCents, refundCents, type FeeRule,
} from "@/lib/booking/engine";
import { audit, q, q1, tx } from "./db";

export type VenueRow = {
  id: string; slug: string; name: string; area: string; address: string; phone: string | null; description: string | null; status: string;
  open_time: string; close_time: string; deposit_percent: number; free_cancel_hours: number; allow_pay_at_venue: boolean;
  paymongo_public_key: string | null; paymongo_connected_at: string | null;
};
export type ResourceRow = {
  id: string; venue_id: string; name: string; kind: string; sports: string[]; indoor: boolean; surface: string | null; capacity: number;
  hourly_rate_cents: number; increment_min: number; min_duration_min: number; max_duration_min: number; buffer_min: number; active: boolean;
};
export type BookingRow = {
  id: string; ref: string; venue_id: string; resource_id: string; user_id: string | null; customer_name: string; customer_email: string | null;
  customer_phone: string | null; sport: string; date: string; start_min: number; end_min: number; status: string; hold_expires_at: string | null;
  source: string; price_cents: number; deposit_cents: number; paid_cents: number; payment_status: string; platform_fee_cents: number;
  pay_method: string | null; checkout_session_id: string | null; payment_id: string | null; refund_cents: number; notes: string | null;
  checked_in_at: string | null; cancelled_at: string | null; cancel_reason: string | null; created_at: string;
};

const VENUE_COLS = `id, slug, name, area, address, phone, description, status, to_char(open_time,'HH24:MI') AS open_time, to_char(close_time,'HH24:MI') AS close_time,
  deposit_percent, free_cancel_hours, allow_pay_at_venue, paymongo_public_key, paymongo_connected_at`;
const BOOKING_COLS = `id, ref, venue_id, resource_id, user_id, customer_name, customer_email, customer_phone, sport, to_char(date,'YYYY-MM-DD') AS date,
  start_min, end_min, status, hold_expires_at, source, price_cents, deposit_cents, paid_cents, payment_status, platform_fee_cents, pay_method,
  checkout_session_id, payment_id, refund_cents, notes, checked_in_at, cancelled_at, cancel_reason, created_at`;

export class BookingError extends Error {}

/** Release holds whose time ran out, so their slots open up again. */
export async function expireHolds() {
  await q(`UPDATE booking SET status='cancelled', cancel_reason='Hold expired', cancelled_at=now(), updated_at=now()
            WHERE status='held' AND hold_expires_at < now()`);
}

export async function feeRule(): Promise<FeeRule> {
  const r = await q1<{ value: FeeRule }>("SELECT value FROM platform_setting WHERE key='booking_fee'");
  return r?.value ?? { percent: 3, min_cents: 1000, max_cents: 5000 };
}

export const publicVenues = (sport?: string) =>
  q<VenueRow & { courts: number; from_cents: number; sports: string[] }>(
    `SELECT ${VENUE_COLS},
            (SELECT count(*)::int FROM resource r WHERE r.venue_id = venue.id AND r.active) AS courts,
            (SELECT min(r.hourly_rate_cents)::int FROM resource r WHERE r.venue_id = venue.id AND r.active) AS from_cents,
            (SELECT array_agg(DISTINCT s) FROM resource r, unnest(r.sports) s WHERE r.venue_id = venue.id AND r.active) AS sports
       FROM venue
      WHERE status = 'active'
        AND EXISTS (SELECT 1 FROM resource r WHERE r.venue_id = venue.id AND r.active AND ($1::text IS NULL OR $1 = ANY(r.sports)))
      ORDER BY name`,
    [sport ?? null],
  );

export const venueBySlug = (slug: string) => q1<VenueRow>(`SELECT ${VENUE_COLS} FROM venue WHERE slug = $1`, [slug]);
export const venueById = (id: string) => q1<VenueRow>(`SELECT ${VENUE_COLS} FROM venue WHERE id = $1`, [id]);
export const venueResources = (venueId: string, activeOnly = true) =>
  q<ResourceRow>(`SELECT * FROM resource WHERE venue_id = $1 ${activeOnly ? "AND active" : ""} ORDER BY sort, created_at`, [venueId]);
export const bookingById = (id: string) => q1<BookingRow>(`SELECT ${BOOKING_COLS} FROM booking WHERE id = $1`, [id]);
export const bookingByCheckout = (sessionId: string) => q1<BookingRow>(`SELECT ${BOOKING_COLS} FROM booking WHERE checkout_session_id = $1`, [sessionId]);
export const venueBookingsOn = (venueId: string, date: string) =>
  q<BookingRow>(`SELECT ${BOOKING_COLS} FROM booking WHERE venue_id = $1 AND date = $2 AND status <> 'cancelled' ORDER BY start_min`, [venueId, date]);
export const blocksOn = (venueId: string, date: string) =>
  q<{ id: string; resource_id: string; start_min: number; end_min: number; reason: string }>(
    `SELECT b.id, b.resource_id, b.start_min, b.end_min, b.reason FROM resource_block b JOIN resource r ON r.id=b.resource_id WHERE r.venue_id=$1 AND b.date=$2 ORDER BY b.start_min`,
    [venueId, date],
  );

/** Bookable start times for a resource on a date. */
export async function startsFor(venue: VenueRow, r: ResourceRow, date: string, durationMin: number, now = Date.now()) {
  const busy = await q<{ s: number; e: number }>(
    `SELECT start_min AS s, end_min AS e FROM booking WHERE resource_id=$1 AND date=$2 AND (status='confirmed' OR (status='held' AND hold_expires_at > now()))
     UNION ALL SELECT start_min, end_min FROM resource_block WHERE resource_id=$1 AND date=$2`,
    [r.id, date],
  );
  return availableStarts({
    openMin: hmToMin(venue.open_time), closeMin: hmToMin(venue.close_time), incrementMin: r.increment_min, durationMin, bufferMin: r.buffer_min,
    busy: busy.map((b) => [b.s, b.e]), date, now,
  });
}

export const bookingDates = (days = 14, now = Date.now()) => Array.from({ length: days }, (_, i) => addDays(manilaToday(now), i));
export const durationsFor = (r: ResourceRow) => durationChoices(r.min_duration_min, r.max_duration_min, r.increment_min);

/** Create a held booking (10 minutes) after re-checking everything server-side. */
export async function createHold(input: {
  venue: VenueRow; resource: ResourceRow; date: string; startMin: number; durationMin: number; sport: string;
  user: { id: string; name: string; email: string }; phone?: string; notes?: string;
}) {
  const { venue, resource: r, date, startMin, durationMin, sport, user } = input;
  if (venue.status !== "active") throw new BookingError("This venue isn't taking bookings right now.");
  if (!r.active || r.venue_id !== venue.id) throw new BookingError("That court isn't available.");
  if (!r.sports.includes(sport)) throw new BookingError("That sport isn't played on this court.");
  if (!durationsFor(r).includes(durationMin)) throw new BookingError("Choose a valid duration.");
  if (!bookingDates().includes(date)) throw new BookingError("Bookings open up to 14 days ahead.");
  await expireHolds();
  const starts = await startsFor(venue, r, date, durationMin);
  if (!starts.includes(startMin)) throw new BookingError("That time was just taken. Please pick another.");
  const price = priceCents(r.hourly_rate_cents, durationMin);
  const deposit = depositCents(price, venue.deposit_percent);
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const row = await q1<{ id: string }>(
        `INSERT INTO booking (ref, venue_id, resource_id, user_id, customer_name, customer_email, customer_phone, sport, date, start_min, end_min,
                              status, hold_expires_at, source, price_cents, deposit_cents, notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'held', now() + make_interval(mins => $12),'online',$13,$14,$15,$4) RETURNING id`,
        [makeRef(), venue.id, r.id, user.id, user.name, user.email, input.phone || null, sport, date, startMin, startMin + durationMin, HOLD_MIN, price, deposit, input.notes || null],
      );
      await audit(user.id, "booking.hold", "booking", row!.id, { venueId: venue.id });
      return row!.id;
    } catch (e: unknown) {
      const code = (e as { code?: string }).code;
      if (code === "23P01") throw new BookingError("That time was just taken. Please pick another.");
      if (code === "23505") continue; // ref collision, retry
      throw e;
    }
  }
  throw new BookingError("Couldn't create the booking. Please try again.");
}

/** Confirm a booking (pay at venue, or after an online payment). Idempotent. */
export async function confirmBooking(bookingId: string, payment: { method: "at_venue" | "online" | "cash"; paidCents?: number; paymentId?: string; actorId?: string | null }) {
  const fee = await feeRule();
  return tx(async (run) => {
    const [b] = await run<BookingRow>(`SELECT ${BOOKING_COLS} FROM booking WHERE id=$1 FOR UPDATE`, [bookingId]);
    if (!b) throw new BookingError("Booking not found.");
    if (b.status === "confirmed" || b.status === "completed") return b;
    if (b.status !== "held" && !(payment.method === "online" && b.status === "cancelled" && b.cancel_reason === "Hold expired")) {
      throw new BookingError("This booking can no longer be confirmed.");
    }
    if (b.status === "held" && b.hold_expires_at && new Date(b.hold_expires_at) < new Date() && payment.method !== "online") {
      throw new BookingError("Your 10-minute hold ran out. Please pick the time again.");
    }
    const paid = payment.paidCents ?? 0;
    const paymentStatus = paid <= 0 ? "unpaid" : paid >= b.price_cents ? "paid" : "deposit_paid";
    // An online payment that lands after the hold expired: reinstate only if the slot is still free (the exclusion constraint checks this).
    const [u] = await run<BookingRow>(
      `UPDATE booking SET status='confirmed', confirmed_at=now(), hold_expires_at=NULL, cancelled_at=NULL, cancel_reason=NULL,
              pay_method=$2, paid_cents=$3, payment_status=$4, payment_id=coalesce($5, payment_id), platform_fee_cents=$6, updated_at=now()
        WHERE id=$1 RETURNING ${BOOKING_COLS}`,
      // Platform fee applies to bookings made through Playbook, not walk-ins the venue enters itself.
      [bookingId, payment.method, paid, paymentStatus, payment.paymentId ?? null, b.source === "online" ? platformFeeCents(b.price_cents, fee) : 0],
    );
    await run("INSERT INTO audit_log (actor_id, action, target_type, target_id, meta) VALUES ($1,'booking.confirm','booking',$2,$3)", [payment.actorId ?? null, bookingId, JSON.stringify({ method: payment.method, paid })]);
    return u;
  });
}

export async function cancelBookingRow(b: BookingRow, venue: VenueRow, actorId: string, reason: string, byVenue = false) {
  if (!canCancel(b.status, b.date, b.start_min, Date.now())) throw new BookingError("This booking can't be cancelled.");
  const refund = byVenue ? b.paid_cents : refundCents(b.paid_cents, b.date, b.start_min, venue.free_cancel_hours, Date.now());
  await q(
    `UPDATE booking SET status='cancelled', cancelled_at=now(), cancel_reason=$2, refund_cents=$3,
            payment_status = CASE WHEN $3 > 0 AND $3 >= paid_cents THEN 'refunded' WHEN $3 > 0 THEN 'partially_refunded' ELSE payment_status END,
            platform_fee_cents = 0, updated_at=now() WHERE id=$1`,
    [b.id, reason, refund],
  );
  await audit(actorId, byVenue ? "booking.cancel_by_venue" : "booking.cancel", "booking", b.id, { refund, reason });
  return refund;
}
