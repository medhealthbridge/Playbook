import type { ClipKind, SportId } from "../lib/booking/types.ts";

/**
 * Demo highlight clips shown in the Highlights section (and the featured
 * REPLAY gallery screen). The videos are AI-generated (Higgsfield, Kling 3.0;
 * prompts in docs/HIGGSFIELD_VIDEO_PROMPTS.md) and are always captioned as
 * demo clips, never presented as real venue footage.
 * Titles describe what actually happens in each clip.
 * Order = display order: pickleball leads (launch priority for target venues).
 */
export interface Highlight {
  id: string;
  sport: SportId;
  title: string;
  meta: string;
  /** real clip length in seconds */
  seconds: number;
  /** fallback animation if the video is missing or fails to load */
  kind: ClipKind;
  video?: string;
  poster?: string;
}

const v = (name: string) => ({
  video: `/assets/video/highlight-${name}.mp4`,
  poster: `/assets/video/highlight-${name}-poster.jpg`,
});

export const HIGHLIGHTS: Highlight[] = [
  {
    id: "pickleball",
    sport: "pickleball",
    title: "Doubles rally at the net",
    meta: "Pickleball Court 1 · Rally Point",
    seconds: 5,
    kind: "rally",
    ...v("pickleball"),
  },
  {
    id: "basketball",
    sport: "basketball",
    title: "Block at the rim",
    meta: "Court A · Kalye Court Hub",
    seconds: 5.5,
    kind: "basketball",
    ...v("basketball"),
  },
  {
    id: "padel",
    sport: "padel",
    title: "Lob-and-smash finish",
    meta: "Padel Court 1 · Rally Point",
    seconds: 8,
    kind: "rally",
    ...v("padel"),
  },
  {
    id: "billiards",
    sport: "billiards",
    title: "Cut shot to the corner",
    meta: "Table 1 · Cue & Co.",
    seconds: 3.9,
    kind: "billiards",
    ...v("billiards"),
  },
];

/** m:ss, rounded down (how players and stores show clip length). */
export const clipTime = (s: number) => {
  const t = Math.max(0, Math.floor(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};
