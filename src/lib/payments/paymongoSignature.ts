// PayMongo webhook signature check (pure, unit-tested).
// Header: "t=<unix>,te=<test sig>,li=<live sig>"; sig = HMAC-SHA256(`${t}.${rawBody}`, webhookSecret) hex.
import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyPaymongoSignature(header: string | null, rawBody: string, secret: string, livemode: boolean, now = Date.now(), toleranceSec = 300): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=").map((s) => s.trim()) as [string, string]));
  const t = Number(parts.t);
  const sig = livemode ? parts.li : parts.te;
  if (!t || !sig || !/^[0-9a-f]+$/i.test(sig)) return false;
  if (Math.abs(now / 1000 - t) > toleranceSec) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(sig, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
