// Run: npm test
import assert from "node:assert/strict";
import { availableStarts, canCancel, depositCents, durationChoices, makeRef, platformFeeCents, priceCents, refundCents } from "../src/lib/booking/engine.ts";
import { toEpoch } from "../src/lib/booking/time.ts";

let passed = 0;
const test = (name: string, fn: () => void) => {
  try { fn(); passed++; console.log(`  ✓ ${name}`); } catch (e) { console.error(`  ✗ ${name}`); throw e; }
};
const D = "2030-05-10";
const early = toEpoch(D, 0) - 86_400_000; // the day before

test("slots respect hours, duration and increments", () => {
  const s = availableStarts({ openMin: 420, closeMin: 600, incrementMin: 30, durationMin: 60, bufferMin: 0, busy: [], date: D, now: early });
  assert.deepEqual(s, [420, 450, 480, 510, 540]);
});
test("busy intervals block overlapping starts only", () => {
  const s = availableStarts({ openMin: 420, closeMin: 600, incrementMin: 30, durationMin: 60, bufferMin: 0, busy: [[480, 540]], date: D, now: early });
  assert.deepEqual(s, [420, 540]);
});
test("buffer keeps a gap around bookings", () => {
  const s = availableStarts({ openMin: 420, closeMin: 660, incrementMin: 30, durationMin: 60, bufferMin: 15, busy: [[480, 540]], date: D, now: early });
  assert.deepEqual(s, [570, 600]);
});
test("past and too-soon starts are hidden", () => {
  const now = toEpoch(D, 500); // 8:20
  const s = availableStarts({ openMin: 420, closeMin: 660, incrementMin: 30, durationMin: 60, bufferMin: 0, busy: [], date: D, now });
  assert.deepEqual(s, [540, 570, 600]);
});
test("durations", () => assert.deepEqual(durationChoices(60, 120, 30), [60, 90, 120]));
test("price, deposit and platform fee", () => {
  assert.equal(priceCents(50000, 90), 75000);
  assert.equal(depositCents(75000, 30), 22500);
  assert.equal(platformFeeCents(75000, { percent: 3, min_cents: 1000, max_cents: 5000 }), 2250);
  assert.equal(platformFeeCents(20000, { percent: 3, min_cents: 1000, max_cents: 5000 }), 1000);
  assert.equal(platformFeeCents(500000, { percent: 3, min_cents: 1000, max_cents: 5000 }), 5000);
  assert.equal(platformFeeCents(0, { percent: 3, min_cents: 1000, max_cents: 5000 }), 0);
});
test("refund: full before the free-cancel window, none after", () => {
  assert.equal(refundCents(30000, D, 600, 24, toEpoch(D, 600) - 25 * 3_600_000), 30000);
  assert.equal(refundCents(30000, D, 600, 24, toEpoch(D, 600) - 23 * 3_600_000), 0);
});
test("cancel only future held/confirmed bookings", () => {
  assert.equal(canCancel("confirmed", D, 600, toEpoch(D, 500)), true);
  assert.equal(canCancel("confirmed", D, 600, toEpoch(D, 700)), false);
  assert.equal(canCancel("cancelled", D, 600, toEpoch(D, 500)), false);
});
test("refs look like PB-XXXXXX without ambiguous characters", () => {
  for (let i = 0; i < 200; i++) assert.match(makeRef(), /^PB-[2-9A-HJ-NP-Z]{6}$/);
});
console.log(`\n${passed} engine checks passed.`);

// PayMongo webhook signatures
import { createHmac } from "node:crypto";
import { verifyPaymongoSignature } from "../src/lib/payments/paymongoSignature.ts";
{
  const body = '{"data":{"id":"evt_1"}}';
  const secret = "whsk_test_abc";
  const t = 1_800_000_000;
  const sig = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  test("valid test-mode signature passes", () => assert.equal(verifyPaymongoSignature(`t=${t},te=${sig},li=`, body, secret, false, t * 1000), true));
  test("tampered body fails", () => assert.equal(verifyPaymongoSignature(`t=${t},te=${sig},li=`, body + " ", secret, false, t * 1000), false));
  test("live mode needs the li signature", () => assert.equal(verifyPaymongoSignature(`t=${t},te=${sig},li=`, body, secret, true, t * 1000), false));
  test("old timestamps are rejected", () => assert.equal(verifyPaymongoSignature(`t=${t},te=${sig},li=`, body, secret, false, (t + 3600) * 1000), false));
  console.log(`${passed} checks passed in total.`);
}
