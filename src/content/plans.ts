// Proposed, editable plan names and benefits. Prices/quotas are NOT final.
// Set `price` to a string like "₱199 / month" once pricing is decided.
import type { PlayerPlanId, VenuePlanId } from "../lib/booking/types.ts";

export const PRICE_TBA = "Pricing to be announced";

export interface PlayerPlan {
  id: PlayerPlanId;
  name: string;
  summary: string;
  price: string | null;
  benefits: string[];
  entitlements: { viewHighlights: boolean; download: boolean; savedClips: string };
}

export interface VenuePlan {
  id: VenuePlanId;
  name: string;
  summary: string;
  price: string | null;
  benefits: string[];
  entitlements: { videoPublishing: boolean; multiLocation: boolean; staffRoles: boolean; reporting: boolean };
}

export const PLAYER_PLANS: PlayerPlan[] = [
  {
    id: "play",
    name: "Play",
    summary: "Everything you need to book and organise games.",
    price: null,
    benefits: ["Booking access", "Booking history", "Invitations", "Reminders"],
    entitlements: { viewHighlights: false, download: false, savedClips: "—" },
  },
  {
    id: "replay",
    name: "Replay",
    summary: "Play, plus your published game recordings and highlights.",
    price: null,
    benefits: [
      "Everything in Play",
      "Eligible published recordings",
      "Highlight access within configured limits",
    ],
    entitlements: { viewHighlights: true, download: false, savedClips: "Configured limit" },
  },
  {
    id: "replay-plus",
    name: "Replay Plus",
    summary: "Replay, plus downloads and more saved clips.",
    price: null,
    benefits: [
      "Everything in Replay",
      "Clip downloads",
      "Larger saved-clip allowance within configured limits",
    ],
    entitlements: { viewHighlights: true, download: true, savedClips: "Larger configured limit" },
  },
];

export const VENUE_PLANS: VenuePlan[] = [
  {
    id: "manage",
    name: "Manage",
    summary: "Run schedules, bookings and payments.",
    price: null,
    benefits: ["Resource schedules", "Booking operations", "Maintenance blocks", "Payment tracking"],
    entitlements: { videoPublishing: false, multiLocation: false, staffRoles: false, reporting: false },
  },
  {
    id: "capture",
    name: "Capture",
    summary: "Manage, plus recordings and clip publishing.",
    price: null,
    benefits: [
      "Everything in Manage",
      "Authorised recording uploads / imports",
      "Clip publication",
      "Video-delivery tools",
    ],
    entitlements: { videoPublishing: true, multiLocation: false, staffRoles: false, reporting: false },
  },
  {
    id: "club",
    name: "Club",
    summary: "Capture, plus multiple locations and staff roles.",
    price: null,
    benefits: [
      "Everything in Capture",
      "Multiple locations",
      "Staff roles",
      "Consolidated reporting",
      "Higher configured storage limits",
    ],
    entitlements: { videoPublishing: true, multiLocation: true, staffRoles: true, reporting: true },
  },
];

export const playerPlanById = (id: PlayerPlanId) => PLAYER_PLANS.find((p) => p.id === id)!;
export const venuePlanById = (id: VenuePlanId) => VENUE_PLANS.find((p) => p.id === id)!;
