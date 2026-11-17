import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/AuthForms";
import { enabledSocial } from "@/lib/server/social";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Sign in — Playbook", robots: { index: false } };

export default function Page() {
  return (
    <main id="main">
      <Suspense fallback={<div className="auth-shell" />}>
        <LoginForm providers={enabledSocial()} />
      </Suspense>
    </main>
  );
}
