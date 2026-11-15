import "server-only";
import { q } from "./db";

export type RentalItem = { id: string; venue_id: string; name: string; price_cents: number; active: boolean };
export type RentalLine = { item_id: string; name: string; qty: number; unit_cents: number };
type Run = <R = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<R[]>;

export const venueRentals = (venueId: string, activeOnly = true) =>
  q<RentalItem>(`SELECT id, venue_id, name, price_cents, active FROM rental_item WHERE venue_id=$1 ${activeOnly ? "AND active" : ""} ORDER BY created_at LIMIT 50`, [venueId]);

/** Read `rent_<itemId>` quantities from a form. Prices always come from the venue's own items, never from the form. */
export async function readRentalLines(formData: FormData, venueId: string): Promise<RentalLine[]> {
  const items = await venueRentals(venueId);
  const lines: RentalLine[] = [];
  for (const it of items) {
    const qty = Math.floor(Number(formData.get(`rent_${it.id}`) ?? 0));
    if (Number.isFinite(qty) && qty > 0) lines.push({ item_id: it.id, name: it.name, qty: Math.min(qty, 20), unit_cents: it.price_cents });
  }
  return lines;
}
export const rentalTotal = (lines: RentalLine[]) => lines.reduce((s, l) => s + l.qty * l.unit_cents, 0);

export async function replaceRentalLines(run: Run, venueId: string, target: { bookingId?: string; playerId?: string }, lines: RentalLine[]) {
  if (target.bookingId) await run("DELETE FROM rental_line WHERE booking_id=$1", [target.bookingId]);
  if (target.playerId) await run("DELETE FROM rental_line WHERE open_play_player_id=$1", [target.playerId]);
  for (const l of lines) {
    await run("INSERT INTO rental_line (venue_id, item_id, name, qty, unit_cents, booking_id, open_play_player_id) VALUES ($1,$2,$3,$4,$5,$6,$7)",
      [venueId, l.item_id, l.name, l.qty, l.unit_cents, target.bookingId ?? null, target.playerId ?? null]);
  }
}
export const rentalLinesFor = (target: { bookingId?: string; playerId?: string }) =>
  q<{ name: string; qty: number; unit_cents: number }>(
    `SELECT name, qty, unit_cents FROM rental_line WHERE ${target.bookingId ? "booking_id" : "open_play_player_id"}=$1 ORDER BY id`,
    [target.bookingId ?? target.playerId],
  );
