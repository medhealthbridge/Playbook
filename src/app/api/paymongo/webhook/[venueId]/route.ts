import { NextResponse } from "next/server";
import { verifyPaymongoSignature } from "@/lib/payments/paymongoSignature";
import { BookingError, bookingByCheckout, bookingById, confirmBooking, venueById } from "@/lib/server/bookings";
import { decrypt } from "@/lib/server/crypto";
import { q, q1 } from "@/lib/server/db";
import { emailBookingConfirmed } from "@/lib/server/notify";

export const dynamic = "force-dynamic";

type Event = {
  data: {
    id: string;
    attributes: {
      type: string;
      livemode: boolean;
      data: { id: string; attributes: { metadata?: Record<string, string>; payments?: { id: string; attributes: { amount: number; status: string } }[]; amount?: number } };
    };
  };
};

// One webhook URL per venue, registered on the venue's own PayMongo account.
export async function POST(req: Request, { params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;
  const raw = await req.text();
  const v = await q1<{ s: string | null; live: boolean | null }>("SELECT paymongo_webhook_secret_enc AS s, paymongo_livemode AS live FROM venue WHERE id=$1", [venueId]);
  if (!v?.s) return NextResponse.json({ error: "unknown venue" }, { status: 404 });
  if (!verifyPaymongoSignature(req.headers.get("paymongo-signature"), raw, decrypt(v.s), !!v.live)) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }
  const evt = JSON.parse(raw) as Event;
  const type = evt.data.attributes.type;
  const obj = evt.data.attributes.data;

  // Idempotency: each event is processed once.
  const fresh = await q1<{ id: string }>(
    "INSERT INTO payment_event (id, venue_id, type, payload) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING RETURNING id",
    [evt.data.id, venueId, type, raw],
  );
  if (!fresh) return NextResponse.json({ ok: true, duplicate: true });

  if (type === "checkout_session.payment.paid") {
    const b = (obj.attributes.metadata?.booking_id && (await bookingById(obj.attributes.metadata.booking_id))) || (await bookingByCheckout(obj.id));
    if (!b || b.venue_id !== venueId) return NextResponse.json({ ok: true, ignored: "no booking" });
    const paid = (obj.attributes.payments ?? []).filter((p) => p.attributes.status === "paid");
    const paidCents = paid.reduce((s, p) => s + p.attributes.amount, 0);
    await q("UPDATE payment_event SET booking_id=$2 WHERE id=$1", [evt.data.id, b.id]);
    try {
      const wasHeld = b.status !== "confirmed";
      const done = await confirmBooking(b.id, { method: "online", paidCents, paymentId: paid[0]?.id });
      if (wasHeld) {
        const venue = (await venueById(venueId))!;
        const court = await q1<{ name: string }>("SELECT name FROM resource WHERE id=$1", [b.resource_id]);
        await emailBookingConfirmed(done, venue, court?.name ?? "Court");
      }
    } catch (e) {
      // Paid but the slot was taken after the hold expired: flag for a refund by the venue.
      const code = (e as { code?: string }).code;
      if (code === "23P01" || e instanceof BookingError) {
        await q("UPDATE booking SET notes = concat_ws(E'\\n', notes, $2), paid_cents=$3, payment_status='paid', updated_at=now() WHERE id=$1",
          [b.id, "Payment received after the hold expired and the slot was taken. Refund the player in PayMongo.", paidCents]);
      } else throw e;
    }
  }
  return NextResponse.json({ ok: true });
}
