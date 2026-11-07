import "server-only";
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

// Encrypts venue payment secrets at rest (AES-256-GCM).
// Key: PAYMONGO_ENC_KEY (32 bytes, base64url) if set, else derived from BETTER_AUTH_SECRET.
// Changing either secret makes stored venue keys unreadable (venues would reconnect).
function key(): Buffer {
  const explicit = process.env.PAYMONGO_ENC_KEY;
  if (explicit) {
    const k = Buffer.from(explicit, "base64url");
    if (k.length !== 32) throw new Error("PAYMONGO_ENC_KEY must be 32 bytes (base64url)");
    return k;
  }
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET is not set");
  return Buffer.from(hkdfSync("sha256", secret, "playbook", "venue-payment-secrets", 32));
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

export function decrypt(token: string): string {
  const [v, iv, tag, data] = token.split(".");
  if (v !== "v1") throw new Error("Unknown secret format");
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(data, "base64url")), d.final()]).toString("utf8");
}
