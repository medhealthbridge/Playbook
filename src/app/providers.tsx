"use client";
import type { ReactNode } from "react";
import { BookingDialog } from "@/components/booking/BookingDialog";
import { MobileBar } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { DemoProvider } from "@/lib/demo/DemoProvider";
import { BookingLauncherProvider } from "@/lib/ui/BookingLauncher";
import { MotionProvider } from "@/lib/ui/MotionProvider";
import { ToastProvider } from "@/lib/ui/Toast";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <MotionProvider>
      <DemoProvider>
        <ToastProvider>
          <BookingLauncherProvider>
            <Nav />
            {children}
            <MobileBar />
            <BookingDialog />
          </BookingLauncherProvider>
        </ToastProvider>
      </DemoProvider>
    </MotionProvider>
  );
}
