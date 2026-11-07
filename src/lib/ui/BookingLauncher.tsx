"use client";
// Global "open the booking flow" API so every CTA (nav, hero, sport cards,
// mobile bar, final CTA) opens the same dialog with optional prefill.
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  /** True once real venues are live: booking CTAs go to /venues instead of the demo. */
  live: boolean;
  /** Always open the demo dialog (used by the demo pages). */
  openDemo: (prefill?: BookingPrefill) => void;
}

const BookingCtx = createContext<Ctx | null>(null);

export function BookingLauncherProvider({ children }: { children: ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const [prefill, setPrefill] = useState<BookingPrefill>({});
  const [session, setSession] = useState(0);
  const [live, setLive] = useState(false);
  const liveRef = useRef(false);
  const router = useRouter();
  useEffect(() => {
    let alive = true;
    fetch("/api/venues/live")
      .then((r) => (r.ok ? r.json() : { live: 0 }))
      .then((d: { live: number }) => {
        if (!alive) return;
        liveRef.current = d.live > 0;
        setLive(d.live > 0);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const openDemo = useCallback((p: BookingPrefill = {}) => {
    setPrefill(p);
    setSession((n) => n + 1);
    setOpen(true);
  }, []);
  const open = useCallback(
    (p: BookingPrefill = {}) => {
      // Demo venue ids and resource ids only exist in the demo; real booking uses /venues.
      if (liveRef.current && !p.venueId && !p.resourceId) {
        router.push(p.sportId ? `/venues?sport=${p.sportId}` : "/venues");
        return;
      }
      openDemo(p);
    },
    [router, openDemo],
  );
  const close = useCallback(() => setOpen(false), []);
  const value = useMemo(() => ({ open, close, isOpen, prefill, session, live, openDemo }), [open, close, isOpen, prefill, session, live, openDemo]);
  return <BookingCtx.Provider value={value}>{children}</BookingCtx.Provider>;
}

export function useBooking() {
  const c = useContext(BookingCtx);
  if (!c) throw new Error("useBooking must be used inside <BookingLauncherProvider>");
  return c;
}
