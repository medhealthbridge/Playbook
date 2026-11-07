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

// Open play queue
import { afterGame, nextGroup, publicName, teams } from "../src/lib/openplay/queue.ts";
{
  const P = (id: string, skill: "beginner" | "intermediate" | "advanced", t: number) => ({ id, skill, queueAt: t });
  const q = [P("a", "beginner", 1), P("b", "advanced", 2), P("c", "beginner", 3), P("d", "advanced", 4), P("e", "beginner", 5), P("f", "beginner", 6)];
  test("next group takes the four longest-waiting players", () => assert.deepEqual(nextGroup(q)!.map((p) => p.id), ["a", "b", "c", "d"]));
  test("no group with fewer than four waiting", () => assert.equal(nextGroup(q.slice(0, 3)), null));
  test("skill matching groups the head player's level", () => assert.deepEqual(nextGroup(q, 4, true)!.map((p) => p.id), ["a", "c", "e", "f"]));
  test("skill matching falls back to earliest others", () => assert.deepEqual(nextGroup(q.slice(0, 5), 4, true)!.map((p) => p.id), ["a", "b", "c", "e"]));
  test("teams spread arrival order", () => assert.deepEqual(teams(q.slice(0, 4)), [["a", "d"], ["b", "c"]]));
  test("all-off sends everyone back", () => assert.deepEqual(afterGame("all_off", ["a", "d"], ["b", "c"], "a", 1), { toQueue: ["a", "d", "b", "c"], stay: [] }));
  test("winners stay, losers queue", () => assert.deepEqual(afterGame("winners_stay", ["a", "d"], ["b", "c"], "b", 1), { toQueue: ["a", "d"], stay: ["b", "c"] }));
  test("winners rotate off at the streak cap", () => assert.deepEqual(afterGame("winners_stay", ["a", "d"], ["b", "c"], "b", 2), { toQueue: ["a", "d", "b", "c"], stay: [] }));
  test("public names hide surnames", () => { assert.equal(publicName("Juan Dela Cruz"), "Juan C."); assert.equal(publicName("Migs"), "Migs"); });
  console.log(`${passed} checks passed in total.`);
}
