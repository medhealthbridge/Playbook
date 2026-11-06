"use client";
// Global "open the booking flow" API so every CTA (nav, hero, sport cards,
// mobile bar, final CTA) opens the same dialog with optional prefill.
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { SportId } from "../booking/types.ts";

export interface BookingPrefill {
  sportId?: SportId;
  venueId?: string;
  resourceId?: string;
  date?: string;
  query?: string;
}

interface Ctx {
  open: (prefill?: BookingPrefill) => void;
  close: () => void;
  isOpen: boolean;
  prefill: BookingPrefill;
  /** Changes on every open so the dialog can reset its internal state. */
  session: number;
}

const BookingCtx = createContext<Ctx | null>(null);

export function BookingLauncherProvider({ children }: { children: ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const [prefill, setPrefill] = useState<BookingPrefill>({});
  const [session, setSession] = useState(0);
  const open = useCallback((p: BookingPrefill = {}) => {
    setPrefill(p);
    setSession((n) => n + 1);
    setOpen(true);
  }, []);
  const close = useCallback(() => setOpen(false), []);
  const value = useMemo(() => ({ open, close, isOpen, prefill, session }), [open, close, isOpen, prefill, session]);
  return <BookingCtx.Provider value={value}>{children}</BookingCtx.Provider>;
}

export function useBooking() {
  const c = useContext(BookingCtx);
  if (!c) throw new Error("useBooking must be used inside <BookingLauncherProvider>");
  return c;
}
