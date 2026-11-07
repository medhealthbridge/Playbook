import { Suspense } from "react";
import type { Metadata } from "next";
import { ResetForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "New password — Playbook", robots: { index: false } };

export default function Page() {
  return (
    <main id="main">
      <Suspense fallback={<div className="auth-shell" />}>
        <ResetForm />
      </Suspense>
    </main>
  );
}
