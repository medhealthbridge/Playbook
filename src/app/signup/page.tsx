import { Suspense } from "react";
import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/AuthForms";
import { enabledSocial } from "@/lib/server/social";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Create account — Playbook", robots: { index: false } };

export default function Page() {
  return (
    <main id="main">
      <Suspense fallback={<div className="auth-shell" />}>
        <SignupForm providers={enabledSocial()} />
      </Suspense>
    </main>
  );
}
