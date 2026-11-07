// Pure booking rules for the real (database-backed) booking flow.
// No I/O here, so it is unit-tested in tests/engine.test.ts.
import { manilaParts, toEpoch } from "./time.ts";

export const HOLD_MIN = 10;

export interface FeeRule {
  percent: number;
  min_cents: number;
  max_cents: number;
}

export interface SlotInput {
  openMin: number;
  closeMin: number;
  incrementMin: number;
  durationMin: number;
  bufferMin: number;
  /** busy intervals [start, end) in minutes (active bookings and blocks) */
  busy: [number, number][];
  /** the day's date and the current time, to hide past and too-soon starts */
  date: string;
  now: number;
  /** minimum minutes between now and the start */
  leadMin?: number;
}

/** Start times (minutes from midnight) at which a booking of durationMin fits. */
export function availableStarts(i: SlotInput): number[] {
  const out: number[] = [];
  const lead = i.leadMin ?? 15;
  for (let s = i.openMin; s + i.durationMin <= i.closeMin; s += i.incrementMin) {
    const e = s + i.durationMin;
    if (toEpoch(i.date, s) < i.now + lead * 60_000) continue;
    const clash = i.busy.some(([bs, be]) => s < be + i.bufferMin && bs < e + i.bufferMin);
    if (!clash) out.push(s);
  }
  return out;
}

export function durationChoices(minMin: number, maxMin: number, incrementMin: number): number[] {
  const out: number[] = [];
  for (let d = minMin; d <= maxMin; d += incrementMin) out.push(d);
  return out;
}

export const priceCents = (hourlyRateCents: number, durationMin: number) => Math.round((hourlyRateCents * durationMin) / 60);
export const depositCents = (price: number, percent: number) => Math.round((price * percent) / 100);
export const platformFeeCents = (price: number, rule: FeeRule) =>
  price <= 0 ? 0 : Math.min(rule.max_cents, Math.max(rule.min_cents, Math.round((price * rule.percent) / 100)));

/** Refund owed on cancellation: everything paid if before the free-cancellation window, else nothing. */
export function refundCents(paid: number, date: string, startMin: number, freeCancelHours: number, now: number): number {
  const cutoff = toEpoch(date, startMin) - freeCancelHours * 3_600_000;
  return now <= cutoff ? paid : 0;
}

export function canCancel(status: string, date: string, startMin: number, now: number) {
  return (status === "held" || status === "confirmed") && toEpoch(date, startMin) > now;
}

const REF_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export function makeRef(rand: () => number = Math.random): string {
  let s = "PB-";
  for (let i = 0; i < 6; i++) s += REF_ALPHABET[Math.floor(rand() * REF_ALPHABET.length)];
  return s;
}

/** Minutes since midnight for "HH:MM" or "HH:MM:SS". */
export const hmToMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

export const manilaNowMinutes = (now = Date.now()) => manilaParts(now).minutes;
