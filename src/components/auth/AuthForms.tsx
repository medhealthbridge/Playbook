"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { authClient } from "@/lib/auth/client";

function safeNext(n: string | null) {
  return n && n.startsWith("/") && !n.startsWith("//") ? n : "/account";
}


export type SocialId = "google" | "facebook" | "apple";

const SOCIAL_ERRORS: Record<string, string> = {
  account_not_linked: "That email already has a Playbook account. Sign in with your password, then you can use this button next time.",
  email_not_found: "We couldn't get an email address from that account. Allow email access, or sign up with email instead.",
  access_denied: "Sign-in was cancelled.",
};

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path fill="currentColor" d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.8-4.7 4.54-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.5c-1.5 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.62 23.1 24 18.1 24 12.07z" />
    </svg>
  );
}
function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path fill="currentColor" d="M16.37 12.8c-.03-2.66 2.17-3.94 2.27-4-1.24-1.81-3.16-2.06-3.84-2.08-1.63-.17-3.19.96-4.02.96-.83 0-2.11-.94-3.47-.91-1.78.03-3.43 1.04-4.35 2.63-1.86 3.22-.48 7.98 1.33 10.6.89 1.28 1.94 2.71 3.32 2.66 1.33-.05 1.84-.86 3.45-.86 1.6 0 2.06.86 3.47.83 1.43-.02 2.34-1.3 3.22-2.59 1.01-1.48 1.43-2.92 1.45-3-.03-.01-2.79-1.07-2.83-4.24zM13.73 4.98c.73-.89 1.23-2.12 1.09-3.35-1.06.04-2.34.71-3.1 1.59-.68.78-1.28 2.04-1.12 3.24 1.18.09 2.39-.6 3.13-1.48z" />
    </svg>
  );
}

const SOCIAL: Record<SocialId, { label: string; Icon: () => ReactNode; cls: string }> = {
  google: { label: "Google", Icon: GoogleIcon, cls: "social-google" },
  facebook: { label: "Facebook", Icon: FacebookIcon, cls: "social-facebook" },
  apple: { label: "Apple", Icon: AppleIcon, cls: "social-apple" },
};

/** One-tap sign-in or sign-up with Google, Facebook or Apple. A new account is created on first use. */
function SocialButtons({ providers, next, mode, consented = true, onNeedConsent }: { providers: SocialId[]; next: string; mode: "login" | "signup"; consented?: boolean; onNeedConsent?: () => void }) {
  const [busy, setBusy] = useState<SocialId | null>(null);
  if (providers.length === 0) return null;
  const go = async (id: SocialId) => {
    if (!consented) return onNeedConsent?.();
    setBusy(id);
    const back = mode === "signup" ? "/signup" : "/login";
    await authClient.signIn.social({ provider: id, callbackURL: next, newUserCallbackURL: next, errorCallbackURL: `${back}?next=${encodeURIComponent(next)}` });
    setBusy(null);
  };
  return (
    <div className="social-block">
      <div className="social-list">
        {providers.map((id) => {
          const { label, Icon, cls } = SOCIAL[id];
          return (
            <button key={id} type="button" className={`social-btn ${cls}`} onClick={() => go(id)} disabled={!!busy} aria-disabled={!consented}>
              <Icon />
              <span>{busy === id ? "Opening…" : `Continue with ${label}`}</span>
            </button>
          );
        })}
      </div>
      {mode === "login" && <p className="hint social-legal">New here? Continuing creates your account and means you agree to the <Link href="/terms" target="_blank">Terms</Link> and <Link href="/privacy" target="_blank">Privacy Policy</Link>.</p>}
      <div className="social-or" role="separator"><span>or with email</span></div>
    </div>
  );
}

export function AuthCard({ title, sub, children, foot }: { title: string; sub?: string; children: ReactNode; foot?: ReactNode }) {
  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h1>{title}</h1>
        {sub && <p className="auth-sub">{sub}</p>}
        {children}
        {foot && <div className="auth-foot">{foot}</div>}
      </div>
    </div>
  );
}

function Status({ error, info }: { error?: string | null; info?: string | null }) {
  if (error) return <div className="alert alert-error" role="alert">{error}</div>;
  if (info) return <div className="alert alert-ok" role="status">{info}</div>;
  return null;
}

export function LoginForm({ providers = [] }: { providers?: SocialId[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const next = safeNext(params.get("next"));
  const [error, setError] = useState<string | null>(() => {
    const code = params.get("error");
    return code ? SOCIAL_ERRORS[code] ?? "That sign-in didn't go through. Please try again." : null;
  });
  const [busy, setBusy] = useState(false);
  const [unverified, setUnverified] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(params.get("verified") ? "Email confirmed. You can sign in now." : params.get("reset") ? "Password updated. Sign in with your new password." : null);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email")).trim();
    setBusy(true);
    setError(null);
    setInfo(null);
    const { error } = await authClient.signIn.email({ email, password: String(f.get("password")) });
    setBusy(false);
    if (error) {
      if (error.status === 403) {
        setUnverified(email);
        setError("Confirm your email first. Check your inbox for the link.");
      } else setError(error.message || "Wrong email or password.");
      return;
    }
    router.replace(next);
    router.refresh();
  };

  const resend = async () => {
    if (!unverified) return;
    await authClient.sendVerificationEmail({ email: unverified, callbackURL: "/login?verified=1" });
    setError(null);
    setInfo("We sent a new confirmation link.");
  };

  return (
    <AuthCard
      title="Sign in"
      sub="Book courts, manage your venue, or open your highlights."
      foot={<>New to Playbook? <Link href={`/signup${next !== "/account" ? `?next=${encodeURIComponent(next)}` : ""}`}>Create an account</Link></>}
    >
      <Status error={error} info={info} />
      {unverified && <button type="button" className="btn btn-xs btn-ghost" onClick={resend}>Resend confirmation email</button>}
      <SocialButtons providers={providers} next={next} mode="login" />
      <form onSubmit={submit} className="auth-form" noValidate>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" className="input" autoComplete="email" required />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" className="input" autoComplete="current-password" required />
        </div>
        <button className="btn" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        <Link className="auth-link" href="/forgot-password">Forgot password?</Link>
      </form>
    </AuthCard>
  );
}

export function SignupForm({ providers = [] }: { providers?: SocialId[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const next = safeNext(params.get("next"));
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [agreed, setAgreed] = useState(false);
  useEffect(() => {
    const code = params.get("error");
    if (code) setError(SOCIAL_ERRORS[code] ?? "That sign-up didn't go through. Please try again.");
  }, [params]);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get("name")).trim();
    const email = String(f.get("email")).trim();
    const password = String(f.get("password"));
    if (name.length < 2) return setError("Enter your name.");
    if (password.length < 8) return setError("Use at least 8 characters for your password.");
    if (password !== String(f.get("confirm"))) return setError("Passwords don't match.");
    if (!agreed) return setError("Please tick the box to agree to the Terms of Service and Privacy Policy.");
    setBusy(true);
    setError(null);
    const { data, error } = await authClient.signUp.email({ name, email, password, callbackURL: `/login?verified=1&next=${encodeURIComponent(next)}` });
    setBusy(false);
    if (error) return setError(error.message || "Couldn't create your account.");
    if (data?.token) {
      router.replace(next);
      router.refresh();
    } else setSent(email);
  };

  if (sent)
    return (
      <AuthCard title="Check your email" sub={`We sent a confirmation link to ${sent}. Open it to finish creating your account.`} foot={<Link href="/login">Back to sign in</Link>}>
        <p className="hint">Didn&apos;t get it? Check spam, or sign in to resend the link.</p>
      </AuthCard>
    );

  return (
    <AuthCard title="Create your account" sub="One account for booking as a player and for running a venue." foot={<>Already have an account? <Link href="/login">Sign in</Link></>}>
      <Status error={error} />
      {/* Consent comes first: it covers the one-tap buttons and the email form alike. */}
      <label className="check consent-box">
        <input type="checkbox" checked={agreed} onChange={(e) => { setAgreed(e.target.checked); if (e.target.checked) setError(null); }} />
        <span>I agree to the <Link href="/terms" target="_blank">Terms of Service</Link> and have read the <Link href="/privacy" target="_blank">Privacy Policy</Link>. Playbook and the venues I book with may use my name, contact details, bookings and game results to run my bookings.</span>
      </label>
      <SocialButtons providers={providers} next={next} mode="signup" consented={agreed} onNeedConsent={() => setError("Tick the box above to agree to the Terms and Privacy Policy first.")} />
      <form onSubmit={submit} className="auth-form" noValidate>
        <div className="field">
          <label htmlFor="name">Full name</label>
          <input id="name" name="name" className="input" autoComplete="name" required />
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" className="input" autoComplete="email" required />
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" className="input" autoComplete="new-password" minLength={8} required />
          </div>
          <div className="field">
            <label htmlFor="confirm">Confirm</label>
            <input id="confirm" name="confirm" type="password" className="input" autoComplete="new-password" required />
          </div>
        </div>
        <button className="btn" type="submit" disabled={busy}>{busy ? "Creating account…" : "Create account"}</button>
      </form>
    </AuthCard>
  );
}

export function ForgotForm() {
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    await authClient.requestPasswordReset({ email: String(new FormData(e.currentTarget).get("email")).trim(), redirectTo: "/reset-password" });
    setBusy(false);
    setDone(true);
  };
  return (
    <AuthCard title="Reset your password" sub="Enter your email and we'll send a reset link." foot={<Link href="/login">Back to sign in</Link>}>
      {done ? (
        <div className="alert alert-ok" role="status">If an account exists for that email, a reset link is on its way. It expires in 1 hour.</div>
      ) : (
        <form onSubmit={submit} className="auth-form">
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" className="input" autoComplete="email" required />
          </div>
          <button className="btn" type="submit" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</button>
        </form>
      )}
    </AuthCard>
  );
}

export function ResetForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token");
  const [error, setError] = useState<string | null>(params.get("error") ? "This reset link is invalid or has expired." : null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const password = String(f.get("password"));
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== String(f.get("confirm"))) return setError("Passwords don't match.");
    if (!token) return setError("This reset link is invalid or has expired.");
    setBusy(true);
    const { error } = await authClient.resetPassword({ newPassword: password, token });
    setBusy(false);
    if (error) return setError(error.message || "This reset link is invalid or has expired.");
    router.replace("/login?reset=1");
  };
  return (
    <AuthCard title="Choose a new password" foot={<Link href="/forgot-password">Request a new link</Link>}>
      <Status error={error} />
      <form onSubmit={submit} className="auth-form">
        <div className="field">
          <label htmlFor="password">New password</label>
          <input id="password" name="password" type="password" className="input" autoComplete="new-password" minLength={8} required />
        </div>
        <div className="field">
          <label htmlFor="confirm">Confirm new password</label>
          <input id="confirm" name="confirm" type="password" className="input" autoComplete="new-password" required />
        </div>
        <button className="btn" type="submit" disabled={busy || !token}>{busy ? "Saving…" : "Save password"}</button>
      </form>
    </AuthCard>
  );
}
