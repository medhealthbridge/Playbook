"use client";
// One "book a slot" entry point for every CTA (nav, hero, sport cards, mobile
// bar, final CTA): it takes the visitor to the live venue list.
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import type { SportId } from "../booking/types.ts";

export interface BookingPrefill {
  sportId?: SportId;
}

interface Ctx {
  open: (prefill?: BookingPrefill) => void;
}

const BookingCtx = createContext<Ctx | null>(null);

export function BookingLauncherProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const open = useCallback((p: BookingPrefill = {}) => router.push(p.sportId ? `/venues?sport=${p.sportId}` : "/venues"), [router]);
  const value = useMemo(() => ({ open }), [open]);
  return <BookingCtx.Provider value={value}>{children}</BookingCtx.Provider>;
}

export function useBooking() {
  const c = useContext(BookingCtx);
  if (!c) throw new Error("useBooking must be used inside <BookingLauncherProvider>");
  return c;
}
