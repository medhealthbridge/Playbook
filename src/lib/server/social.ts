import "server-only";
import { createPrivateKey, sign } from "node:crypto";

// Social sign-in (Google, Facebook, Apple). A provider is switched on only when
// its keys are set in the environment, so the buttons appear automatically.
// Callback URL to register with each provider: <site>/api/auth/callback/<google|facebook|apple>

export type SocialId = "google" | "facebook" | "apple";

const env = (k: string) => process.env[k]?.trim() || "";
const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64url");

/**
 * Apple's "client secret" is a short-lived JWT signed with the .p8 key from the
 * Apple Developer account. We sign a fresh one at start-up (valid 150 days; Apple's cap is 6 months).
 */
function appleClientSecret(): string {
  const key = env("APPLE_PRIVATE_KEY").replace(/\\n/g, "\n");
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "ES256", kid: env("APPLE_KEY_ID") }));
  const payload = b64url(JSON.stringify({ iss: env("APPLE_TEAM_ID"), iat: now, exp: now + 150 * 86400, aud: "https://appleid.apple.com", sub: env("APPLE_CLIENT_ID") }));
  const sig = sign("sha256", Buffer.from(`${header}.${payload}`), { key: createPrivateKey(key), dsaEncoding: "ieee-p1363" });
  return `${header}.${payload}.${b64url(sig)}`;
}

export function enabledSocial(): SocialId[] {
  const out: SocialId[] = [];
  if (env("GOOGLE_CLIENT_ID") && env("GOOGLE_CLIENT_SECRET")) out.push("google");
  if (env("FACEBOOK_CLIENT_ID") && env("FACEBOOK_CLIENT_SECRET")) out.push("facebook");
  if (env("APPLE_CLIENT_ID") && env("APPLE_TEAM_ID") && env("APPLE_KEY_ID") && env("APPLE_PRIVATE_KEY")) out.push("apple");
  return out;
}

/** Better Auth `socialProviders` config for the providers that have keys. */
export function socialProviders() {
  const on = enabledSocial();
  const cfg: Record<string, unknown> = {};
  if (on.includes("google")) cfg.google = { clientId: env("GOOGLE_CLIENT_ID"), clientSecret: env("GOOGLE_CLIENT_SECRET"), prompt: "select_account" };
  if (on.includes("facebook")) cfg.facebook = { clientId: env("FACEBOOK_CLIENT_ID"), clientSecret: env("FACEBOOK_CLIENT_SECRET") };
  if (on.includes("apple")) {
    try {
      cfg.apple = { clientId: env("APPLE_CLIENT_ID"), clientSecret: appleClientSecret() };
    } catch (e) {
      console.error("Apple sign-in disabled: could not sign the client secret", (e as Error).message);
    }
  }
  return cfg;
}
