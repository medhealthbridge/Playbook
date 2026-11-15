"use client";
import type { ReactNode } from "react";
import { MobileBar } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { BookingLauncherProvider } from "@/lib/ui/BookingLauncher";
import { MotionProvider } from "@/lib/ui/MotionProvider";
import { ToastProvider } from "@/lib/ui/Toast";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <MotionProvider>
        <ToastProvider>
          <BookingLauncherProvider>
            <Nav />
            {children}
            <MobileBar />
          </BookingLauncherProvider>
        </ToastProvider>
    </MotionProvider>
  );
}
