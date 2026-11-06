// Pure booking, pricing, cancellation and video-entitlement rules.
// Shared by the demo store, the UI and tests. In production these same rules
// must ALSO be enforced server-side (DB exclusion constraints + expiring holds).
import type {
  Booking,
  Clip,
  MaintenanceBlock,
  PlayerPlanId,
  PriceBreakdown,
  Recording,
  Resource,
  Venue,
  VenuePlanId,
} from "./types.ts";
import { PLAYER_PLANS, VENUE_PLANS } from "../../content/plans.ts";
import { manilaParts, parseHM, toEpoch } from "./time.ts";

export const HOLD_MINUTES = 10;

/** Does this booking currently occupy its resource? */
export function isBlocking(b: Booking, now: number): boolean {
  if (b.status === "confirmed") return true;
  if (b.status === "held") return (b.holdExpiresAt ?? 0) > now;
  return false;
}

export type SlotReason = "available" | "booked" | "maintenance" | "past" | "closed";

export interface Slot {
  startMin: number;
  endMin: number;
  reason: SlotReason;
}

interface AvailabilityInput {
  venue: Venue;
  resource: Resource;
  date: string;
  durationMin: number;
  bookings: Booking[];
  maintenance: MaintenanceBlock[];
  now: number;
  ignoreBookingId?: string;
}

/**
 * Why a [start, end) window on a resource can't be booked (or "available").
 * Buffers apply on both sides: a new booking must leave `bufferMin` free
 * before and after any existing booking on the SAME physical resource,
 * regardless of which sport either booking is for.
 */
export function windowStatus(input: AvailabilityInput & { startMin: number }): SlotReason {
  const { venue, resource, date, durationMin, bookings, maintenance, now, startMin, ignoreBookingId } = input;
  const endMin = startMin + durationMin;
  const open = parseHM(venue.open);
  const close = parseHM(venue.close);
  if (startMin < open || endMin > close) return "closed";
  if ((startMin - open) % resource.incrementMin !== 0) return "closed";
  if (durationMin < resource.minDurationMin || durationMin > resource.maxDurationMin) return "closed";
  if (toEpoch(date, startMin) <= now) return "past";

  for (const m of maintenance) {
    if (m.resourceId === resource.id && m.date === date && startMin < m.endMin && endMin > m.startMin) {
      return "maintenance";
    }
  }
  const buf = resource.bufferMin;
  for (const b of bookings) {
    if (b.id === ignoreBookingId) continue;
    if (b.resourceId !== resource.id || b.date !== date || !isBlocking(b, now)) continue;
    if (startMin < b.endMin + buf && endMin + buf > b.startMin) return "booked";
  }
  return "available";
}

/** Every candidate start time for a date/duration with its status. */
export function listSlots(input: AvailabilityInput): Slot[] {
  const open = parseHM(input.venue.open);
  const close = parseHM(input.venue.close);
  const slots: Slot[] = [];
  for (let s = open; s + input.durationMin <= close; s += input.resource.incrementMin) {
    slots.push({ startMin: s, endMin: s + input.durationMin, reason: windowStatus({ ...input, startMin: s }) });
  }
  return slots;
}

export function durationOptions(r: Resource): number[] {
  const out: number[] = [];
  const step = Math.max(30, r.incrementMin);
  for (let d = r.minDurationMin; d <= r.maxDurationMin; d += step) out.push(d);
  return out;
}

export function priceFor(venue: Venue, resource: Resource, durationMin: number, equipmentIds: string[]): PriceBreakdown {
  const rental = Math.round((resource.hourlyRate * durationMin) / 60);
  const equipment = venue.equipment
    .filter((e) => equipmentIds.includes(e.id))
    .map((e) => ({ id: e.id, label: e.label, price: e.price }));
  const subtotal = rental + equipment.reduce((a, e) => a + e.price, 0);
  const dueNow = venue.depositPercent > 0 ? Math.round((subtotal * venue.depositPercent) / 100) : subtotal;
  return { rental, equipment, subtotal, dueNow, balance: subtotal - dueNow, depositPercent: venue.depositPercent };
}

/** Refund owed if the player cancels now under the sample policy. */
export function cancellationRefund(b: Booking, venue: Venue, now: number): { refund: number; note: string } {
  const hoursBefore = (toEpoch(b.date, b.startMin) - now) / 3_600_000;
  const paid = b.payment.amountPaid;
  if (paid === 0) return { refund: 0, note: "Nothing was paid online, so there is nothing to refund." };
  if (hoursBefore >= venue.freeCancelHours) {
    return { refund: paid, note: `Cancelled more than ${venue.freeCancelHours} hours before start — full refund.` };
  }
  return { refund: 0, note: `Cancelled within ${venue.freeCancelHours} hours of start — online payment is non-refundable.` };
}

export function isPast(b: Booking, now: number): boolean {
  return toEpoch(b.date, b.endMin) <= now;
}

export type DisplayStatus =
  | "Confirmed"
  | "Awaiting payment"
  | "Payment failed"
  | "Hold expired"
  | "Cancelled"
  | "Completed"
  | "Refund due";

/** Human status — never shows "Confirmed" unless the booking is actually confirmed. */
export function displayStatus(b: Booking, now: number): DisplayStatus {
  if (b.payment.status === "refund_due") return "Refund due";
  if (b.status === "cancelled") return "Cancelled";
  if (b.status === "expired") return "Hold expired";
  if (b.status === "held") {
    if ((b.holdExpiresAt ?? 0) <= now) return "Hold expired";
    return b.payment.status === "failed" ? "Payment failed" : "Awaiting payment";
  }
  return isPast(b, now) ? "Completed" : "Confirmed";
}

// ---------------------------------------------------------------- video

export type VideoAccess =
  | { ok: true; canDownload: boolean }
  | {
      ok: false;
      code:
        | "venue_no_video"
        | "not_recorded"
        | "awaiting_upload"
        | "processing"
        | "failed"
        | "expired"
        | "not_published"
        | "not_participant"
        | "restricted_by_plan";
      message: string;
    };

interface AccessInput {
  booking: Booking;
  resource: Resource;
  venuePlan: VenuePlanId;
  recording: Recording | undefined;
  clip?: Clip;
  viewerId: string;
  playerPlan: PlayerPlanId;
}

/**
 * Access requires ALL of:
 * 1. venue has video publishing enabled (plan) and a camera covers the resource,
 * 2. footage exists, is ready, and the clip is published,
 * 3. viewer is an authorised participant (an invitation alone is not enough),
 * 4. viewer's membership includes highlights (download needs the download entitlement).
 * Order matters: missing footage is reported before plan restrictions so a
 * membership never appears to "create" footage that was never recorded.
 */
export function videoAccess(i: AccessInput): VideoAccess {
  const venuePlan = VENUE_PLANS.find((p) => p.id === i.venuePlan)!;
  if (!venuePlan.entitlements.videoPublishing || !i.resource.recordingCapable) {
    return { ok: false, code: "venue_no_video", message: "This venue doesn't publish recordings for this court or table." };
  }
  const r = i.recording;
  if (!r) return { ok: false, code: "not_recorded", message: "No footage was recorded for this booking." };
  if (r.status === "awaiting_upload")
    return { ok: false, code: "awaiting_upload", message: "The venue hasn't uploaded footage for this game yet." };
  if (r.status === "processing")
    return { ok: false, code: "processing", message: "Footage is processing. We'll notify you when clips are ready." };
  if (r.status === "failed")
    return { ok: false, code: "failed", message: "Processing failed. The venue has been asked to re-upload." };
  if (r.status === "expired")
    return { ok: false, code: "expired", message: "This footage passed the venue's retention period and was removed." };
  const clip = i.clip ?? r.clips.find((c) => c.published);
  if (!clip || !clip.published)
    return { ok: false, code: "not_published", message: "Footage is in, but the venue hasn't published clips yet." };

  const p = i.booking.participants.find((x) => x.id === i.viewerId);
  const authorised = i.booking.ownerId === i.viewerId || (p && p.status === "accepted" && p.recordingAccess);
  if (!authorised)
    return { ok: false, code: "not_participant", message: "Only authorised participants of this booking can view its recordings." };

  const plan = PLAYER_PLANS.find((x) => x.id === i.playerPlan)!;
  if (!plan.entitlements.viewHighlights)
    return { ok: false, code: "restricted_by_plan", message: "Your clip is ready — highlights are included in Replay and Replay Plus." };
  return { ok: true, canDownload: plan.entitlements.download };
}

export function nowInManila(now = Date.now()) {
  return manilaParts(now);
}
