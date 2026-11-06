import { Suspense } from "react";
import type { Metadata } from "next";
import { DemoApp } from "@/components/demo/DemoApp";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Playbook demo — player & venue",
};

export default function DemoPage() {
  return (
    <>
      <main id="main">
        <Suspense fallback={<div className="app-shell" />}>
          <DemoApp />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
