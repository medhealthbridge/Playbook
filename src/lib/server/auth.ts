import "server-only";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";
import { getPool } from "./db";
import { actionEmail, emailConfigured, sendEmail } from "./email";
import { socialProviders } from "./social";

/** Bump when the Terms or Privacy Policy text changes. */
export const POLICY_VERSION = "2026-11";

const adminEmails = () =>
  (process.env.PLATFORM_ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

export const auth = betterAuth({
  appName: "Playbook",
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: getPool(),
  // Apple posts the sign-in result back from its own domain.
  trustedOrigins: [process.env.BETTER_AUTH_URL, "https://playbook.databridgesol.space", "https://appleid.apple.com"].filter(Boolean) as string[],
  socialProviders: socialProviders(),
  account: {
    // A Google or Apple sign-in with the same, provider-verified email joins the existing account.
    // Facebook doesn't confirm that the email is verified, so it is not trusted for linking.
    accountLinking: { enabled: true, trustedProviders: ["google", "apple"] },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    // Verification is enforced once an email provider is configured.
    requireEmailVerification: emailConfigured(),
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      const m = actionEmail("Reset your password", "Someone (hopefully you) asked to reset your Playbook password. This link expires in 1 hour.", "Choose a new password", url);
      await sendEmail({ to: user.email, subject: "Reset your Playbook password", ...m });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      const m = actionEmail("Confirm your email", `Hi ${user.name}, confirm your email to start booking courts, tables and pitches on Playbook.`, "Confirm email", url);
      await sendEmail({ to: user.email, subject: "Confirm your Playbook email", ...m });
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  rateLimit: { enabled: true, window: 60, max: 30 },
  databaseHooks: {
    user: {
      create: {
        // Emails listed in PLATFORM_ADMIN_EMAILS become platform admins on sign-up.
        // Admin by email only for email sign-up (which confirms the address once email is configured)
        // or a provider that vouches for the email; never on an unverified social email.
        before: async (user, ctx) => {
          const viaEmailForm = ctx?.path === "/sign-up/email";
          const isAdmin = adminEmails().includes(user.email.toLowerCase()) && (viaEmailForm || user.emailVerified === true);
          return { data: { ...user, role: isAdmin ? "admin" : "user" } };
        },
        // The sign-up form can't be submitted without both boxes ticked; keep the record of what was agreed to.
        after: async (user) => {
          await getPool()
            .query("INSERT INTO user_consent (user_id, document, version) VALUES ($1,'terms',$2), ($1,'privacy',$2)", [user.id, POLICY_VERSION])
            .catch((e) => console.error("consent record failed", e));
        },
      },
    },
  },
  plugins: [admin({ defaultRole: "user", adminRoles: ["admin"] }), nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
