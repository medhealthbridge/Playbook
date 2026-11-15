"use client";
import { useEffect, useState } from "react";

export interface LiveVenue {
  slug: string; name: string; area: string; open: string; close: string; courts: number; fromCents: number;
  sports: string[]; payOnline: boolean; depositPercent: number;
}

let cache: Promise<LiveVenue[]> | null = null;
const load = () =>
  (cache ??= fetch("/api/venues/public")
    .then((r) => (r.ok ? r.json() : { venues: [] }))
    .then((d: { venues: LiveVenue[] }) => d.venues)
    .catch(() => []));

/** Venues that are live on Playbook right now. `null` while loading. */
export function useLiveVenues(): LiveVenue[] | null {
  const [venues, setVenues] = useState<LiveVenue[] | null>(null);
  useEffect(() => {
    let alive = true;
    void load().then((v) => alive && setVenues(v));
    return () => { alive = false; };
  }, []);
  return venues;
}
