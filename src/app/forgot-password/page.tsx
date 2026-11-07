import { Suspense } from "react";
import type { Metadata } from "next";
import { ForgotForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "Reset password — Playbook", robots: { index: false } };

export default function Page() {
  return (
    <main id="main">
      <Suspense fallback={<div className="auth-shell" />}>
        <ForgotForm />
      </Suspense>
    </main>
  );
}
