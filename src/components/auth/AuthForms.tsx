"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { authClient } from "@/lib/auth/client";

function safeNext(n: string | null) {
  return n && n.startsWith("/") && !n.startsWith("//") ? n : "/account";
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

export function LoginForm() {
  const params = useSearchParams();
  const router = useRouter();
  const next = safeNext(params.get("next"));
  const [error, setError] = useState<string | null>(null);
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

export function SignupForm() {
  const params = useSearchParams();
  const router = useRouter();
  const next = safeNext(params.get("next"));
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get("name")).trim();
    const email = String(f.get("email")).trim();
    const password = String(f.get("password"));
    if (name.length < 2) return setError("Enter your name.");
    if (password.length < 8) return setError("Use at least 8 characters for your password.");
    if (password !== String(f.get("confirm"))) return setError("Passwords don't match.");
    if (!f.get("terms")) return setError("Please accept the Terms and Privacy Policy.");
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
        <label className="check">
          <input type="checkbox" name="terms" /> <span>I agree to the <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>.</span>
        </label>
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
