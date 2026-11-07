import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { HoldTimer } from "@/components/portal/HoldTimer";
import { Flash, PortalHeader, peso, when } from "@/components/portal/Portal";
import { SPORTS } from "@/content/sports";
import { canCancel, refundCents } from "@/lib/booking/engine";
import { formatDate, formatRange } from "@/lib/booking/time";
import { bookingById, confirmBooking, expireHolds, venueById } from "@/lib/server/bookings";
import { decrypt } from "@/lib/server/crypto";
import { q1 } from "@/lib/server/db";
import { emailBookingConfirmed } from "@/lib/server/notify";
import { checkoutPayments } from "@/lib/server/paymongo";
import { getSession, isPlatformAdmin, venueRole } from "@/lib/server/session";
import { cancelBooking, confirmAtVenue, payOnline } from "../actions";

export const metadata: Metadata = { title: "Booking — Playbook", robots: { index: false } };
export const dynamic = "force-dynamic";

const STATUS: Record<string, [string, string]> = {
  held: ["Waiting for confirmation", "badge-warn"], confirmed: ["Confirmed", "badge-ok"], completed: ["Completed", "badge-ok"],
  cancelled: ["Cancelled", "badge-muted"], no_show: ["No-show", "badge-bad"],
};

export default async function BookingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const session = await getSession();
  if (!session) redirect(`/login?next=/bookings/${id}`);
  await expireHolds();
  let b = await bookingById(id);
  if (!b) notFound();
  const isPlayer = b.user_id === session.user.id;
  const staffRole = isPlatformAdmin(session.user) ? "owner" : await venueRole(session.user.id, b.venue_id);
  if (!isPlayer && !staffRole) notFound();
  const v = (await venueById(b.venue_id))!;

  // Returning from PayMongo: confirm right away if the payment went through (the webhook does the same).
  let paidNote: string | null = null;
  if (sp.paid && b.checkout_session_id && (b.status === "held" || b.status === "cancelled")) {
    const enc = await q1<{ s: string | null }>("SELECT paymongo_secret_enc AS s FROM venue WHERE id=$1", [v.id]);
    if (enc?.s) {
      try {
        const p = await checkoutPayments(decrypt(enc.s), b.checkout_session_id);
        if (p.paidCents > 0) {
          b = await confirmBooking(b.id, { method: "online", paidCents: p.paidCents, paymentId: p.paymentId ?? undefined });
          paidNote = "Payment received. You're booked!";
          const court = await q1<{ name: string }>("SELECT name FROM resource WHERE id=$1", [b.resource_id]);
          await emailBookingConfirmed(b, v, court?.name ?? "Court");
        } else paidNote = null;
      } catch (e) {
        console.error("payment check failed", e);
      }
    }
  }
  const court = await q1<{ name: string }>("SELECT name FROM resource WHERE id=$1", [b.resource_id]);
  const [label, cls] = STATUS[b.status] ?? [b.status, "badge-muted"];
  const sport = SPORTS.find((s) => s.id === b!.sport)?.name ?? b.sport;
  const online = !!v.paymongo_connected_at;
  const cancellable = canCancel(b.status, b.date, b.start_min, Date.now());
  const refundIfNow = refundCents(b.paid_cents, b.date, b.start_min, v.free_cancel_hours, Date.now());
  const balance = Math.max(0, b.price_cents - b.paid_cents);

  return (
    <main id="main" className="app-shell">
      <PortalHeader eyebrow={`Booking ${b.ref}`} title={v.name} actions={<span className={`badge ${cls}`}>{label}</span>} />
      <div className="app-body">
        <div className="container app-stack" style={{ maxWidth: 820 }}>
          <Flash ok={paidNote ?? sp.ok} error={sp.error} />
          {sp.paid && !paidNote && b.status === "held" && <div className="alert alert-info">We&apos;re waiting for PayMongo to confirm your payment. This page updates once it does; refresh in a moment.</div>}
          <section className="app-card">
            <dl className="kv">
              <dt>When</dt><dd>{formatDate(b.date)}, {formatRange(b.start_min, b.end_min)}</dd>
              <dt>Where</dt><dd>{court?.name} · {v.area}<br /><span className="hint">{v.address}</span></dd>
              <dt>Sport</dt><dd>{sport}</dd>
              <dt>Booked by</dt><dd>{b.customer_name}{b.customer_email ? ` · ${b.customer_email}` : ""}</dd>
              <dt>Total</dt><dd><strong>{peso(b.price_cents)}</strong>{b.paid_cents > 0 && <> · paid {peso(b.paid_cents)}</>}{b.status !== "cancelled" && balance > 0 && b.status === "confirmed" && <> · <strong>{peso(balance)}</strong> due at the venue</>}</dd>
              {b.status === "cancelled" && (<><dt>Cancelled</dt><dd>{when(b.cancelled_at)}{b.cancel_reason ? ` · ${b.cancel_reason}` : ""}{b.refund_cents > 0 ? ` · refund ${peso(b.refund_cents)}` : ""}</dd></>)}
              {b.checked_in_at && (<><dt>Checked in</dt><dd>{when(b.checked_in_at)}</dd></>)}
            </dl>
          </section>

          {b.status === "held" && isPlayer && (
            <section className="app-card">
              <div className="inline-form"><h2 style={{ marginRight: "auto" }}>Confirm your booking</h2>{b.hold_expires_at && <HoldTimer until={b.hold_expires_at} />}</div>
              <p className="hint">We&apos;re holding this time for you. Confirm before the timer runs out.</p>
              <div className="chip-row">
                {online && (
                  <form action={payOnline}>
                    <input type="hidden" name="id" value={b.id} />
                    <button className="btn" type="submit">Pay {b.deposit_cents > 0 && b.deposit_cents < b.price_cents ? `${peso(b.deposit_cents)} deposit` : peso(b.price_cents)} · GCash, Maya, card</button>
                  </form>
                )}
                {v.allow_pay_at_venue && (
                  <form action={confirmAtVenue}>
                    <input type="hidden" name="id" value={b.id} />
                    <button className={`btn ${online ? "btn-outline" : ""}`} type="submit">Confirm · pay {peso(b.price_cents)} at the venue</button>
                  </form>
                )}
                {!online && !v.allow_pay_at_venue && <p className="hint">This venue hasn&apos;t set up payments yet. Contact them at {v.phone}.</p>}
              </div>
            </section>
          )}

          {cancellable && (isPlayer || staffRole) && (
            <section className="app-card">
              <h3>Cancel booking</h3>
              <p className="hint">
                {isPlayer
                  ? b.paid_cents > 0
                    ? refundIfNow > 0 ? `Cancel now for a full refund of ${peso(refundIfNow)}.` : `Free cancellation ended ${v.free_cancel_hours} hours before the start, so no refund applies.`
                    : "Nothing has been paid, so there's no charge to cancel."
                  : "Cancelling as the venue refunds the full amount paid."}
              </p>
              <form action={cancelBooking} className="inline-form">
                <input type="hidden" name="id" value={b.id} />
                {!isPlayer && <input type="hidden" name="as" value="venue" />}
                <input className="input" name="reason" placeholder="Reason (optional)" aria-label="Reason" />
                <button className="btn btn-sm btn-danger" type="submit">Cancel booking</button>
              </form>
            </section>
          )}
          <p><Link href={isPlayer ? "/account" : `/venue/${b.venue_id}?tab=calendar&date=${b.date}`}>← Back</Link></p>
        </div>
      </div>
    </main>
  );
}
