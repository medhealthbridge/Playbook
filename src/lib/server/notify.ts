import "server-only";
import { formatDate, formatRange } from "@/lib/booking/time";
import { actionEmail, sendEmail } from "./email";
import type { BookingRow, VenueRow } from "./bookings";

const base = () => process.env.BETTER_AUTH_URL || "https://playbook.databridgesol.space";
const php = (c: number) => `₱${(c / 100).toLocaleString("en-PH")}`;

export async function emailBookingConfirmed(b: BookingRow, v: VenueRow, court: string) {
  if (!b.customer_email) return;
  const balance = b.price_cents - b.paid_cents;
  const body = `${v.name} · ${court}\n${formatDate(b.date)}, ${formatRange(b.start_min, b.end_min)}\nRef ${b.ref} · Total ${php(b.price_cents)}${b.paid_cents ? ` · Paid ${php(b.paid_cents)}` : ""}${balance > 0 ? ` · Pay ${php(balance)} at the venue` : ""}.`;
  const m = actionEmail("You're booked", body, "View booking", `${base()}/bookings/${b.id}`);
  await sendEmail({ to: b.customer_email, subject: `Booked: ${v.name}, ${formatDate(b.date)}`, ...m }).catch((e) => console.error("email failed", e));
}

export async function emailBookingCancelled(b: BookingRow, v: VenueRow, refundCents: number) {
  if (!b.customer_email) return;
  const body = `Your booking ${b.ref} at ${v.name} on ${formatDate(b.date)} was cancelled.${refundCents > 0 ? ` A refund of ${php(refundCents)} is being processed.` : ""}`;
  const m = actionEmail("Booking cancelled", body, "View booking", `${base()}/bookings/${b.id}`);
  await sendEmail({ to: b.customer_email, subject: `Cancelled: ${v.name}, ${formatDate(b.date)}`, ...m }).catch((e) => console.error("email failed", e));
}
