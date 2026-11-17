// Quality tiers for the 3D scroll story, so low-spec phones still scroll smoothly.
//
//   high    desktop: soft shadows, bloom, mirror floor, sharper pixels
//   medium  most phones and weaker laptops: no shadows, bloom or mirror; pixel ratio up to 1.25
//   low     low-memory / few-core phones, Data Saver: pixel ratio 1, fewer particles, no light shafts
//
// The starting tier comes from the device; a frame-rate watcher steps down if it still struggles,
// and remembers that for the next visit. `?quality=high|medium|low` forces a tier.

export type Quality = "high" | "medium" | "low";
const ORDER: Quality[] = ["low", "medium", "high"];
const KEY = "pb-quality";

interface NavExtras {
  deviceMemory?: number;
  connection?: { saveData?: boolean };
}

function stored(): Quality | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "high" || v === "medium" || v === "low" ? v : null;
  } catch {
    return null;
  }
}

export function lower(a: Quality, b: Quality): Quality {
  return ORDER[Math.min(ORDER.indexOf(a), ORDER.indexOf(b))];
}

/** Tier to start with on this device. */
export function initialQuality(): Quality {
  const forced = new URLSearchParams(window.location.search).get("quality");
  if (forced === "high" || forced === "medium" || forced === "low") return forced;
  const nav = navigator as Navigator & NavExtras;
  const mem = nav.deviceMemory ?? 8;
  const cores = navigator.hardwareConcurrency || 8;
  const touch = window.matchMedia("(max-width: 760px), (pointer: coarse)").matches;
  let q: Quality = touch ? "medium" : "high";
  if (nav.connection?.saveData || mem <= 3 || cores <= 4) q = "low";
  else if (!touch && (mem <= 4 || cores <= 6)) q = "medium";
  const remembered = stored();
  return remembered ? lower(q, remembered) : q;
}

/** Step down one tier (never below low) and remember it. */
export function downgrade(q: Quality): Quality {
  const next = ORDER[Math.max(0, ORDER.indexOf(q) - 1)];
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* private mode: just this visit */
  }
  return next;
}

/** What each tier switches on. */
export const TIER = {
  high: { dpr: [1, 1.5] as [number, number], shadows: true, bloom: true, mirror: true, shafts: true, dust: 1 },
  medium: { dpr: [1, 1.25] as [number, number], shadows: false, bloom: false, mirror: false, shafts: true, dust: 0.45 },
  low: { dpr: [1, 1] as [number, number], shadows: false, bloom: false, mirror: false, shafts: false, dust: 0.15 },
} satisfies Record<Quality, { dpr: [number, number]; shadows: boolean; bloom: boolean; mirror: boolean; shafts: boolean; dust: number }>;
