import "server-only";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";
import { getPool } from "./db";
import { actionEmail, emailConfigured, sendEmail } from "./email";

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
  trustedOrigins: [process.env.BETTER_AUTH_URL, "https://playbook.databridgesol.space"].filter(Boolean) as string[],
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
        before: async (user) => ({
          data: { ...user, role: adminEmails().includes(user.email.toLowerCase()) ? "admin" : "user" },
        }),
      },
    },
  },
  plugins: [admin({ defaultRole: "user", adminRoles: ["admin"] }), nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
