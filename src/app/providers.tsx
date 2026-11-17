"use client";
import { useEffect, type ReactNode } from "react";
import { MobileBar } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { BookingLauncherProvider } from "@/lib/ui/BookingLauncher";
import { MotionProvider } from "@/lib/ui/MotionProvider";
import { ToastProvider } from "@/lib/ui/Toast";

/** Registers the static-file cache (public/sw.js) in production, after the page has loaded. */
function useStaticCache() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const register = () => navigator.serviceWorker.register("/sw.js").catch(() => {});
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);
}

export function Providers({ children }: { children: ReactNode }) {
  useStaticCache();
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
