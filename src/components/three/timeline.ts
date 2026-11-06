// Master scroll timeline shared by the HTML overlays (GSAP ScrollTrigger)
// and the WebGL camera rig. T runs 0 → 1 across the whole experience:
//   0.00–0.88  journey section (courtside → BOOK → PLAY → REPLAY)
//   0.88–1.00  final section (convergence into the wordmark)

export const JOURNEY_END = 0.88;

export const CHAPTERS = [
  { id: "book", q: "Q1", label: "BOOK", t: 0.16 },
  { id: "play", q: "Q2", label: "PLAY", t: 0.4 },
  { id: "replay", q: "Q3", label: "REPLAY", t: 0.7 },
  { id: "ft", q: "FT", label: "FINAL", t: 0.95 },
] as const;

/** Overlay panels: when each HTML panel is visible on the master timeline. */
export const PANELS = {
  hero: { in: -1, full: 0, out: 0.06, gone: 0.095 },
  book: { in: 0.185, full: 0.215, out: 0.3, gone: 0.33 },
  play: { in: 0.43, full: 0.46, out: 0.55, gone: 0.58 },
  replay: { in: 0.745, full: 0.775, out: 0.84, gone: 0.875 },
} as const;

type Listener = () => void;

/** Mutable, render-loop friendly state (no React re-renders per scroll tick). */
export const scrollState = {
  target: 0, // where scroll says we should be
  visible: true, // is any 3D section on screen
  pointerX: 0,
  pointerY: 0,
  listeners: new Set<Listener>(),
  setVisible(v: boolean) {
    if (v === this.visible) return;
    this.visible = v;
    this.listeners.forEach((l) => l());
  },
};

export function panelOpacity(t: number, p: { in: number; full: number; out: number; gone: number }) {
  if (t <= p.in || t >= p.gone) return 0;
  if (t < p.full) return (t - p.in) / (p.full - p.in);
  if (t <= p.out) return 1;
  return 1 - (t - p.out) / (p.gone - p.out);
}

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
