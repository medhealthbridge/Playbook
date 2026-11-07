// DEMO STATE — a single in-browser "database" shared by the booking flow,
// the player area and the venue admin, so records stay synchronised.
// Pure functions (state in -> state out) so they can be unit-tested.
import { EVENTS, MAINTENANCE_SEED, VENUES, resourceById, venueById } from "../../content/venues.ts";
import type {
  Booking,
  ClipKind,
  MaintenanceBlock,
  PlayerPlanId,
  Recording,
  RecordingSource,
  SportId,
  VenuePlanId,
} from "../booking/types.ts";
import { HOLD_MINUTES, cancellationRefund, isBlocking, priceFor, windowStatus } from "../booking/rules.ts";
import { addDays, manilaToday } from "../booking/time.ts";
import type { HoldRequest } from "../adapters/interfaces.ts";

export const DEMO_PLAYER_ID = "demo-player";
export const DEMO_PLAYER_NAME = "You (demo player)";

export interface Notification {
  id: string;
  at: number;
  text: string;
  read: boolean;
  bookingId?: string;
}

export interface DemoState {
  v: 1;
  seededFor: string;
  playerPlan: PlayerPlanId;
  venuePlans: Record<string, VenuePlanId>;
  bookings: Booking[];
  maintenance: MaintenanceBlock[];
  recordings: Recording[];
  notifications: Notification[];
  eventRegistrations: { eventId: string; at: number }[];
  processedPaymentEvents: string[];
}

export type DemoErrorCode = "slot_taken" | "invalid" | "maintenance" | "closed" | "past" | "not_found" | "conflict";

export class DemoError extends Error {
  code: DemoErrorCode;
  constructor(code: DemoErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

let counter = 0;
export function uid(prefix: string): string {
  counter += 1;
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}${counter.toString(36)}${rand}`;
}

function bookingRef(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "PB-";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

// Small deterministic PRNG so seeded schedules look the same on every load.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const OTHER_NAMES = ["J. Santos", "Team Bulldogs", "R. Dela Cruz", "Office league", "K. Reyes", "Walk-in", "M. Garcia"];

function makeBooking(p: {
  resourceId: string;
  sportId: SportId;
  date: string;
  startMin: number;
  endMin: number;
  ownerId: string;
  ownerName: string;
  equipmentIds?: string[];
  status?: Booking["status"];
  paid?: "full" | "deposit";
  now: number;
}): Booking {
  const r = resourceById(p.resourceId);
  const v = venueById(r.venueId);
  const price = priceFor(v, r, p.endMin - p.startMin, p.equipmentIds ?? []);
  const amountPaid = p.paid === "full" ? price.subtotal : price.dueNow;
  return {
    id: uid("bk"),
    ref: bookingRef(),
    venueId: v.id,
    resourceId: r.id,
    sportId: p.sportId,
    date: p.date,
    startMin: p.startMin,
    endMin: p.endMin,
    ownerId: p.ownerId,
    ownerName: p.ownerName,
    participants: [{ id: p.ownerId, name: p.ownerName, role: "owner", status: "accepted", recordingAccess: true }],
    equipmentIds: p.equipmentIds ?? [],
    price,
    status: p.status ?? "confirmed",
    payment: {
      status: price.balance > 0 && p.paid !== "full" ? "deposit_paid" : "paid",
      amountPaid,
      updatedAt: p.now,
    },
    createdAt: p.now,
  };
}

export function seedState(now = Date.now()): DemoState {
  const today = manilaToday(now);
  const bookings: Booking[] = [];
  const recordings: Recording[] = [];
  const mine = (resourceId: string, sportId: SportId, dayOffset: number, startH: number, hours: number) => {
    const b = makeBooking({
      resourceId,
      sportId,
      date: addDays(today, dayOffset),
      startMin: startH * 60,
      endMin: (startH + hours) * 60,
      ownerId: DEMO_PLAYER_ID,
      ownerName: DEMO_PLAYER_NAME,
      paid: "full",
      now,
    });
    bookings.push(b);
    return b;
  };
  const rec = (b: Booking, status: Recording["status"], source: RecordingSource, clips: [string, ClipKind, number, number][] = []) => {
    recordings.push({
      id: uid("rec"),
      bookingId: b.id,
      source,
      status,
      retainUntil: addDays(b.date, 30),
      failureReason: status === "failed" ? "Uploaded file was incomplete (demo)." : undefined,
      clips: clips.map(([title, kind, s, e]) => ({ id: uid("clip"), title, kind, startSec: s, endSec: e, published: true })),
    });
  };

  // --- Demo player's history: one example of every video state.
  const p1 = mine("kalye-a", "basketball", -2, 19, 2);
  p1.participants.push(
    { id: "p-migs", name: "Migs", role: "invitee", status: "accepted", recordingAccess: true },
    { id: "p-ana", name: "Ana", role: "invitee", status: "invited", recordingAccess: false },
  );
  rec(p1, "ready", "cctv_export", [
    ["Block at the rim", "basketball", 1260, 1266],
    ["Corner three to close Q2", "basketball", 2405, 2418],
    ["Fast-break layup", "basketball", 4102, 4110],
  ]);
  const pb = mine("rally-pb1", "pickleball", -1, 19, 1);
  rec(pb, "ready", "camera_upload", [
    ["Doubles rally at the net", "rally", 1520, 1525],
    ["Twelve-dink kitchen rally", "rally", 2210, 2231],
  ]);
  rec(mine("rally-pd1", "padel", -6, 18, 1), "ready", "camera_upload", [["Lob-and-smash finish", "rally", 1880, 1888]]);
  rec(mine("rally-bd1", "badminton", -3, 18, 1), "processing", "camera_upload");
  rec(mine("rally-pb2", "pickleball", -1, 9, 1), "awaiting_upload", "cctv_export");
  rec(mine("rally-fs1", "futsal", -5, 20, 1), "failed", "cctv_export");
  rec(mine("kalye-a", "volleyball", -40, 17, 2), "expired", "cctv_export");
  mine("cue-t1", "billiards", -4, 15, 2); // venue on Manage plan -> no video
  // Upcoming confirmed booking (deposit paid)
  const up = makeBooking({
    resourceId: "kalye-a", sportId: "basketball", date: addDays(today, 2), startMin: 18 * 60, endMin: 20 * 60,
    ownerId: DEMO_PLAYER_ID, ownerName: DEMO_PLAYER_NAME, equipmentIds: ["ball-bb"], paid: "deposit", now,
  });
  up.participants.push({ id: "p-migs", name: "Migs", role: "invitee", status: "accepted", recordingAccess: false });
  bookings.push(up);

  const maintenance: MaintenanceBlock[] = MAINTENANCE_SEED.map(({ dayOffset, ...m }) => ({
    ...m,
    date: addDays(today, dayOffset),
  }));

  // --- Other customers' bookings for the next 7 days (deterministic).
  for (const v of VENUES) {
    for (const r of v.resources) {
      for (let d = -2; d <= 6; d++) {
        const date = addDays(today, d);
        const rnd = mulberry32(hash(r.id + d));
        const count = 3 + Math.floor(rnd() * 3);
        for (let i = 0; i < count; i++) {
          const dur = r.minDurationMin + (rnd() > 0.6 ? r.incrementMin : 0);
          const open = parseInt(v.open) * 60;
          const close = parseInt(v.close) * 60;
          const slots = Math.floor((close - open - dur) / r.incrementMin);
          const start = open + Math.floor(rnd() * slots) * r.incrementMin;
          const ok =
            windowStatus({ venue: v, resource: r, date, durationMin: dur, bookings, maintenance, now: 0, startMin: start }) ===
            "available";
          if (!ok) continue;
          bookings.push(
            makeBooking({
              resourceId: r.id,
              sportId: r.sports[Math.floor(rnd() * r.sports.length)],
              date,
              startMin: start,
              endMin: start + dur,
              ownerId: `cust-${Math.floor(rnd() * 1000)}`,
              ownerName: OTHER_NAMES[Math.floor(rnd() * OTHER_NAMES.length)],
              paid: rnd() > 0.5 ? "full" : "deposit",
              now,
            }),
          );
        }
      }
    }
  }

  return {
    v: 1,
    seededFor: today,
    playerPlan: "play",
    venuePlans: { kalye: "capture", cue: "manage", rally: "club" },
    bookings,
    maintenance,
    recordings,
    notifications: [
      { id: uid("n"), at: now - 1_800_000, text: "Your clip “Doubles rally at the net” is ready.", read: false, bookingId: pb.id },
      { id: uid("n"), at: now - 3_600_000, text: "Your clip “Block at the rim” is ready.", read: false, bookingId: p1.id },
    ],
    eventRegistrations: [],
    processedPaymentEvents: [],
  };
}

// ------------------------------------------------------------------ actions

const clone = (s: DemoState): DemoState => structuredClone(s);
const find = (s: DemoState, id: string) => {
  const b = s.bookings.find((x) => x.id === id);
  if (!b) throw new DemoError("not_found", "Booking not found.");
  return b;
};

export function createHold(state: DemoState, req: HoldRequest, now: number, owner = { id: DEMO_PLAYER_ID, name: DEMO_PLAYER_NAME }) {
  const s = clone(state);
  const venue = venueById(req.venueId);
  const resource = resourceById(req.resourceId);
  if (resource.venueId !== venue.id || !resource.sports.includes(req.sportId)) {
    throw new DemoError("invalid", "That court or table doesn't support this sport.");
  }
  const status = windowStatus({
    venue, resource, date: req.date, durationMin: req.durationMin, bookings: s.bookings, maintenance: s.maintenance, now, startMin: req.startMin,
  });
  if (status === "booked") throw new DemoError("slot_taken", "Someone just booked this time. Please pick another slot.");
  if (status === "maintenance") throw new DemoError("maintenance", "This time is blocked for maintenance.");
  if (status === "past") throw new DemoError("past", "That start time has already passed.");
  if (status === "closed") throw new DemoError("closed", "That time is outside opening hours or booking rules.");
  const b = makeBooking({
    resourceId: resource.id, sportId: req.sportId, date: req.date, startMin: req.startMin, endMin: req.startMin + req.durationMin,
    ownerId: owner.id, ownerName: owner.name, equipmentIds: req.equipmentIds, status: "held", now,
  });
  b.payment = { status: "unpaid", amountPaid: 0, updatedAt: now };
  b.holdExpiresAt = now + HOLD_MINUTES * 60_000;
  s.bookings.push(b);
  return { state: s, booking: b };
}

/** Demo helper: another customer grabs a slot (used to demonstrate "slot taken"). */
export function simulateCompetitor(state: DemoState, req: HoldRequest, now: number) {
  const { state: s, booking } = createHold(state, req, now, { id: "cust-rival", name: "Another player" });
  booking.status = "confirmed";
  booking.holdExpiresAt = undefined;
  booking.payment = { status: "paid", amountPaid: booking.price.subtotal, updatedAt: now };
  return s;
}

/**
 * Payment webhook semantics (idempotent by eventId). The browser reaching a
 * "success" page never confirms anything — only this event does.
 */
export function applyPaymentEvent(
  state: DemoState,
  evt: { bookingId: string; eventId: string; outcome: "succeeded" | "failed" | "pending" },
  now: number,
) {
  if (state.processedPaymentEvents.includes(evt.eventId)) return state;
  const s = clone(state);
  s.processedPaymentEvents.push(evt.eventId);
  const b = find(s, evt.bookingId);
  const venue = venueById(b.venueId);
  const resource = resourceById(b.resourceId);
  b.payment.updatedAt = now;

  if (evt.outcome === "pending") {
    if (b.status === "held") b.payment.status = "pending";
    return s;
  }
  if (evt.outcome === "failed") {
    if (b.status === "held") b.payment.status = "failed";
    return s;
  }
  // succeeded
  b.payment.amountPaid = b.price.dueNow;
  const holdValid = b.status === "held" && (b.holdExpiresAt ?? 0) > now;
  const stillFree =
    b.status !== "cancelled" &&
    windowStatus({
      venue, resource, date: b.date, durationMin: b.endMin - b.startMin, bookings: s.bookings, maintenance: s.maintenance,
      now, startMin: b.startMin, ignoreBookingId: b.id,
    }) === "available";
  if (holdValid || ((b.status === "held" || b.status === "expired") && stillFree)) {
    b.status = "confirmed";
    b.holdExpiresAt = undefined;
    b.payment.status = b.price.balance > 0 ? "deposit_paid" : "paid";
    s.notifications.unshift({ id: uid("n"), at: now, text: `Booking ${b.ref} confirmed.`, read: false, bookingId: b.id });
  } else {
    // Late payment for a slot someone else now holds: never double-book.
    b.status = b.status === "cancelled" ? "cancelled" : "expired";
    b.payment.status = "refund_due";
    s.notifications.unshift({
      id: uid("n"), at: now, read: false, bookingId: b.id,
      text: `Payment for ${b.ref} arrived after the hold expired and the slot was taken. A refund is due.`,
    });
  }
  return s;
}

export function expireHolds(state: DemoState, now: number) {
  if (!state.bookings.some((b) => b.status === "held" && (b.holdExpiresAt ?? 0) <= now)) return state;
  const s = clone(state);
  for (const b of s.bookings) if (b.status === "held" && (b.holdExpiresAt ?? 0) <= now) b.status = "expired";
  return s;
}

export function cancelBooking(state: DemoState, id: string, by: "player" | "venue", now: number) {
  const s = clone(state);
  const b = find(s, id);
  if (b.status === "cancelled") return s;
  const venue = venueById(b.venueId);
  const policy =
    by === "venue"
      ? { refund: b.payment.amountPaid, note: "Cancelled by the venue — full refund of the online payment." }
      : cancellationRefund(b, venue, now);
  b.status = "cancelled";
  b.holdExpiresAt = undefined;
  if (policy.refund > 0) b.payment.status = "refunded";
  b.cancellation = { at: now, by, refund: policy.refund, note: policy.note };
  if (b.ownerId === DEMO_PLAYER_ID && by === "venue") {
    s.notifications.unshift({ id: uid("n"), at: now, read: false, bookingId: b.id, text: `The venue cancelled ${b.ref}. ${policy.note}` });
  }
  return s;
}

export function invite(state: DemoState, bookingId: string, name: string) {
  const s = clone(state);
  const b = find(s, bookingId);
  const clean = name.trim().slice(0, 40);
  if (!clean) throw new DemoError("invalid", "Enter a name to invite.");
  // Invitations NEVER grant recording access automatically.
  b.participants.push({ id: uid("p"), name: clean, role: "invitee", status: "invited", recordingAccess: false });
  return s;
}

export function acceptInvite(state: DemoState, bookingId: string, participantId: string) {
  const s = clone(state);
  const p = find(s, bookingId).participants.find((x) => x.id === participantId);
  if (p) p.status = "accepted";
  return s;
}

export function setRecordingAccess(state: DemoState, bookingId: string, participantId: string, allowed: boolean) {
  const s = clone(state);
  const p = find(s, bookingId).participants.find((x) => x.id === participantId);
  if (!p || p.role === "owner") return s;
  if (allowed && p.status !== "accepted") throw new DemoError("invalid", "They need to accept the invitation first.");
  p.recordingAccess = allowed;
  return s;
}

export function setPlayerPlan(state: DemoState, plan: PlayerPlanId) {
  return { ...state, playerPlan: plan }; // venue plans untouched
}

export function setVenuePlan(state: DemoState, venueId: string, plan: VenuePlanId) {
  return { ...state, venuePlans: { ...state.venuePlans, [venueId]: plan } }; // player plan untouched
}

export function addMaintenance(state: DemoState, block: Omit<MaintenanceBlock, "id">, now: number) {
  const s = clone(state);
  const clash = s.bookings.find(
    (b) => b.resourceId === block.resourceId && b.date === block.date && isBlocking(b, now) &&
      block.startMin < b.endMin && block.endMin > b.startMin,
  );
  if (clash) throw new DemoError("conflict", `Overlaps booking ${clash.ref}. Cancel or move it first.`);
  s.maintenance.push({ ...block, id: uid("mt") });
  return s;
}

export function removeMaintenance(state: DemoState, id: string) {
  return { ...state, maintenance: state.maintenance.filter((m) => m.id !== id) };
}

export function startUpload(state: DemoState, bookingId: string, source: RecordingSource) {
  const s = clone(state);
  const b = find(s, bookingId);
  let r = s.recordings.find((x) => x.bookingId === bookingId);
  if (!r) {
    r = { id: uid("rec"), bookingId, source, status: "processing", clips: [], retainUntil: addDays(b.date, 30) };
    s.recordings.push(r);
  } else {
    r.source = source;
    r.status = "processing";
    r.failureReason = undefined;
  }
  return s;
}

export function finishProcessing(state: DemoState, recordingId: string, outcome: "ready" | "failed") {
  const s = clone(state);
  const r = s.recordings.find((x) => x.id === recordingId);
  if (!r) return s;
  r.status = outcome;
  if (outcome === "failed") r.failureReason = "Simulated processing failure (demo).";
  return s;
}

const KIND_FOR: Partial<Record<SportId, ClipKind>> = {
  basketball: "basketball", billiards: "billiards", futsal: "futsal", volleyball: "volleyball",
};
export function clipKindFor(sport: SportId): ClipKind {
  return KIND_FOR[sport] ?? "rally";
}

export function addClip(state: DemoState, recordingId: string, clip: { title: string; startSec: number; endSec: number }) {
  const s = clone(state);
  const r = s.recordings.find((x) => x.id === recordingId);
  if (!r || r.status !== "ready") throw new DemoError("invalid", "Clips can only be cut from ready footage.");
  if (!(clip.endSec > clip.startSec)) throw new DemoError("invalid", "Clip end must be after its start.");
  if (clip.endSec - clip.startSec > 120) throw new DemoError("invalid", "Keep clips to 2 minutes or less.");
  const b = find(s, r.bookingId);
  r.clips.push({ id: uid("clip"), title: clip.title.trim() || "Highlight", kind: clipKindFor(b.sportId), startSec: clip.startSec, endSec: clip.endSec, published: false });
  return s;
}

export function publishClip(state: DemoState, recordingId: string, clipId: string, published: boolean, now: number) {
  const s = clone(state);
  const r = s.recordings.find((x) => x.id === recordingId);
  const c = r?.clips.find((x) => x.id === clipId);
  if (!r || !c) return s;
  c.published = published;
  const b = find(s, r.bookingId);
  if (published && b.participants.some((p) => p.id === DEMO_PLAYER_ID)) {
    s.notifications.unshift({ id: uid("n"), at: now, read: false, bookingId: b.id, text: `Your clip “${c.title}” is ready.` });
  }
  return s;
}

export function registerEvent(state: DemoState, eventId: string, now: number) {
  if (state.eventRegistrations.some((e) => e.eventId === eventId)) return state;
  if (!EVENTS.some((e) => e.id === eventId)) throw new DemoError("not_found", "Session not found.");
  return { ...state, eventRegistrations: [...state.eventRegistrations, { eventId, at: now }] };
}

export function markNotificationsRead(state: DemoState) {
  return { ...state, notifications: state.notifications.map((n) => ({ ...n, read: true })) };
}
