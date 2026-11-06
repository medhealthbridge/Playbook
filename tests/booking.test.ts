// Run: npm test  (Node 22+ strips TypeScript types natively)
import assert from "node:assert/strict";
import { resourceById, venueById } from "../src/content/venues.ts";
import { displayStatus, listSlots, videoAccess, windowStatus } from "../src/lib/booking/rules.ts";
import { addDays, manilaToday, toEpoch } from "../src/lib/booking/time.ts";
import {
  DEMO_PLAYER_ID,
  DemoError,
  acceptInvite,
  addMaintenance,
  applyPaymentEvent,
  cancelBooking,
  createHold,
  expireHolds,
  invite,
  seedState,
  setPlayerPlan,
  setRecordingAccess,
  setVenuePlan,
  simulateCompetitor,
  type DemoState,
} from "../src/lib/demo/state.ts";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}`);
    throw e;
  }
}

// Fixed "now": today 08:00 Manila
const now = toEpoch(manilaToday(), 8 * 60);
const day = addDays(manilaToday(now), 5); // far enough out to be clear of seeded player bookings
const empty = (): DemoState => ({ ...seedState(now), bookings: [], maintenance: [] });
const req = (over: Partial<Parameters<typeof createHold>[1]> = {}) => ({
  venueId: "kalye", resourceId: "kalye-a", sportId: "basketball" as const, date: day, startMin: 10 * 60, durationMin: 60, equipmentIds: [], ...over,
});
const throwsCode = (fn: () => unknown, code: string) =>
  assert.throws(fn, (e: unknown) => e instanceof DemoError && e.code === code);

console.log("Booking rules");

test("hold succeeds on a free slot", () => {
  const { booking } = createHold(empty(), req(), now);
  assert.equal(booking.status, "held");
  assert.equal(booking.payment.status, "unpaid");
});

test("overlap rejected on same resource across sports (basketball vs volleyball on Court A)", () => {
  const { state } = createHold(empty(), req(), now);
  throwsCode(() => createHold(state, req({ sportId: "volleyball" }), now), "slot_taken");
});

test("setup buffer enforced between bookings", () => {
  const { state } = createHold(empty(), req(), now); // 10:00-11:00, buffer 15
  // 11:00 start violates the 15-minute buffer
  throwsCode(() => createHold(state, req({ startMin: 11 * 60 }), now), "slot_taken");
  // 12:00 is fine
  createHold(state, req({ startMin: 12 * 60 }), now);
});

test("different resource is independent", () => {
  const { state } = createHold(empty(), req(), now);
  createHold(state, req({ resourceId: "kalye-b" }), now);
});

test("opening hours + increments respected", () => {
  throwsCode(() => createHold(empty(), req({ startMin: 5 * 60 }), now), "closed");
  throwsCode(() => createHold(empty(), req({ startMin: 22 * 60 + 30, durationMin: 60 }), now), "closed");
  throwsCode(() => createHold(empty(), req({ startMin: 10 * 60 + 30 }), now), "closed");
});

test("maintenance blocks respected", () => {
  const s = addMaintenance(empty(), { resourceId: "kalye-a", date: day, startMin: 9 * 60, endMin: 11 * 60, reason: "x" }, now);
  throwsCode(() => createHold(s, req(), now), "maintenance");
});

test("past slots rejected", () => {
  throwsCode(() => createHold(empty(), req({ date: manilaToday(now), startMin: 7 * 60 }), now), "past");
});

test("listSlots marks the taken window as booked", () => {
  const { state } = createHold(empty(), req(), now);
  const slots = listSlots({ venue: venueById("kalye"), resource: resourceById("kalye-a"), date: day, durationMin: 60, bookings: state.bookings, maintenance: [], now });
  assert.equal(slots.find((s) => s.startMin === 600)!.reason, "booked");
  assert.equal(slots.find((s) => s.startMin === 720)!.reason, "available");
});

console.log("Payments");

test("failed / pending payment never shows Confirmed", () => {
  const { state, booking } = createHold(empty(), req(), now);
  const f = applyPaymentEvent(state, { bookingId: booking.id, eventId: "e1", outcome: "failed" }, now);
  assert.equal(displayStatus(f.bookings[0], now), "Payment failed");
  const p = applyPaymentEvent(state, { bookingId: booking.id, eventId: "e2", outcome: "pending" }, now);
  assert.equal(displayStatus(p.bookings[0], now), "Awaiting payment");
});

test("success confirms; payment status separate (deposit_paid)", () => {
  const { state, booking } = createHold(empty(), req(), now);
  const s = applyPaymentEvent(state, { bookingId: booking.id, eventId: "e1", outcome: "succeeded" }, now);
  assert.equal(s.bookings[0].status, "confirmed");
  assert.equal(s.bookings[0].payment.status, "deposit_paid"); // Kalye takes a 50% deposit
});

test("payment events are idempotent", () => {
  const { state, booking } = createHold(empty(), req(), now);
  const s1 = applyPaymentEvent(state, { bookingId: booking.id, eventId: "e1", outcome: "succeeded" }, now);
  const s2 = applyPaymentEvent(s1, { bookingId: booking.id, eventId: "e1", outcome: "succeeded" }, now);
  assert.equal(s1, s2);
  assert.equal(s2.notifications.filter((n) => n.text.includes(booking.ref)).length, 1);
});

test("late payment after the slot was taken → refund due, no double booking", () => {
  const { state, booking } = createHold(empty(), req(), now);
  const later = now + 11 * 60_000;
  const expired = expireHolds(state, later);
  assert.equal(expired.bookings[0].status, "expired");
  const taken = simulateCompetitor(expired, req({ sportId: "volleyball" }), later);
  const s = applyPaymentEvent(taken, { bookingId: booking.id, eventId: "late", outcome: "succeeded" }, later);
  const mine = s.bookings.find((b) => b.id === booking.id)!;
  assert.equal(mine.status, "expired");
  assert.equal(mine.payment.status, "refund_due");
  const confirmed = s.bookings.filter((b) => b.status === "confirmed" && b.resourceId === "kalye-a" && b.date === day);
  assert.equal(confirmed.length, 1);
});

test("late payment with slot still free → confirmed", () => {
  const { state, booking } = createHold(empty(), req(), now);
  const later = now + 11 * 60_000;
  const s = applyPaymentEvent(expireHolds(state, later), { bookingId: booking.id, eventId: "late", outcome: "succeeded" }, later);
  assert.equal(s.bookings[0].status, "confirmed");
});

test("expired hold frees the slot", () => {
  const { state } = createHold(empty(), req(), now);
  createHold(state, req(), now + 11 * 60_000);
});

test("cancellation follows sample policy", () => {
  const { state, booking } = createHold(empty(), req(), now);
  const paid = applyPaymentEvent(state, { bookingId: booking.id, eventId: "e", outcome: "succeeded" }, now);
  const c = cancelBooking(paid, booking.id, "player", now).bookings[0];
  assert.equal(c.status, "cancelled");
  assert.equal(c.cancellation!.refund, c.payment.amountPaid); // > 24h away
  const close = toEpoch(day, 9 * 60); // 1h before start
  const c2 = cancelBooking(paid, booking.id, "player", close).bookings[0];
  assert.equal(c2.cancellation!.refund, 0);
});

console.log("Video entitlements");

const seeded = seedState(now);
const readyBooking = seeded.bookings.find((b) => seeded.recordings.find((r) => r.bookingId === b.id && r.status === "ready") && b.resourceId === "kalye-a")!;
const access = (s: DemoState, viewerId = DEMO_PLAYER_ID) => {
  const b = s.bookings.find((x) => x.id === readyBooking.id)!;
  return videoAccess({
    booking: b, resource: resourceById(b.resourceId), venuePlan: s.venuePlans[b.venueId],
    recording: s.recordings.find((r) => r.bookingId === b.id), viewerId, playerPlan: s.playerPlan,
  });
};

test("Play plan → restricted by plan (footage exists)", () => {
  const a = access(seeded);
  assert.equal(a.ok, false);
  assert.equal(!a.ok && a.code, "restricted_by_plan");
});

test("Replay plan → can view, cannot download; Replay Plus → can download", () => {
  const a = access(setPlayerPlan(seeded, "replay"));
  assert.deepEqual(a, { ok: true, canDownload: false });
  const b = access(setPlayerPlan(seeded, "replay-plus"));
  assert.deepEqual(b, { ok: true, canDownload: true });
});

test("venue without video plan → venue_no_video even with Replay Plus", () => {
  const s = setVenuePlan(setPlayerPlan(seeded, "replay-plus"), "kalye", "manage");
  const a = access(s);
  assert.equal(!a.ok && a.code, "venue_no_video");
});

test("player and venue plans are independent", () => {
  const s = setPlayerPlan(seeded, "replay-plus");
  assert.deepEqual(s.venuePlans, seeded.venuePlans);
  const v = setVenuePlan(seeded, "kalye", "club");
  assert.equal(v.playerPlan, seeded.playerPlan);
});

test("missing footage reported as missing, not as a plan restriction", () => {
  const s = setPlayerPlan(seeded, "play");
  for (const r of s.recordings) {
    const b = s.bookings.find((x) => x.id === r.bookingId)!;
    if (r.status === "ready") continue;
    const a = videoAccess({ booking: b, resource: resourceById(b.resourceId), venuePlan: s.venuePlans[b.venueId], recording: r, viewerId: DEMO_PLAYER_ID, playerPlan: "play" });
    assert.ok(!a.ok && a.code !== "restricted_by_plan", `recording ${r.status} misreported`);
  }
});

test("invitation alone does not expose recordings", () => {
  let s = setPlayerPlan(seeded, "replay-plus");
  s = invite(s, readyBooking.id, "Carlo");
  const carlo = s.bookings.find((b) => b.id === readyBooking.id)!.participants.find((p) => p.name === "Carlo")!;
  assert.equal(carlo.recordingAccess, false);
  assert.equal((access(s, carlo.id) as { code?: string }).code, "not_participant");
  s = acceptInvite(s, readyBooking.id, carlo.id);
  assert.equal((access(s, carlo.id) as { code?: string }).code, "not_participant");
  s = setRecordingAccess(s, readyBooking.id, carlo.id, true);
  assert.equal(access(s, carlo.id).ok, true);
});

test("seeded data has no overlapping blocking bookings", () => {
  for (const b of seeded.bookings) {
    const r = resourceById(b.resourceId);
    const st = windowStatus({
      venue: venueById(b.venueId), resource: r, date: b.date, durationMin: b.endMin - b.startMin,
      bookings: seeded.bookings, maintenance: [], now: 0, startMin: b.startMin, ignoreBookingId: b.id,
    });
    assert.notEqual(st, "booked", `overlap at ${b.resourceId} ${b.date} ${b.startMin}`);
  }
});

console.log(`\n${passed} checks passed.`);
