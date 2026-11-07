import type { SportId } from "../lib/booking/types.ts";

export interface Sport {
  id: SportId;
  name: string;
  tagline: string;
  visual: string; // art direction note (also used as image alt text)
  resourceNoun: string; // "court", "table", "pitch"
  featured?: boolean;
}

// Order = display order. Pickleball leads: per the product owner it is the
// most-played sport at our target venues (the likeliest buyers). Basketball follows.
export const SPORTS: Sport[] = [
  {
    id: "pickleball",
    name: "Pickleball",
    tagline: "Your next doubles game starts here.",
    visual: "Paddle and perforated ball beside the non-volley kitchen line",
    resourceNoun: "court",
    featured: true,
  },
  {
    id: "basketball",
    name: "Basketball",
    tagline: "Get the squad on court.",
    visual: "Basketball resting on hardwood beside the free-throw lane and hoop",
    resourceNoun: "court",
  },
  {
    id: "billiards",
    name: "Billiards",
    tagline: "Line up your next session.",
    visual: "Felt table with cue, racked triangle of balls and an overhead light",
    resourceNoun: "table",
  },
  {
    id: "volleyball",
    name: "Volleyball",
    tagline: "Bring the team. Bring the energy.",
    visual: "Volleyball over the net — indoor hardwood and beach sand courts",
    resourceNoun: "court",
  },
  {
    id: "badminton",
    name: "Badminton",
    tagline: "Make time for your next rally.",
    visual: "Shuttlecock and racket over doubles court markings",
    resourceNoun: "court",
  },
  {
    id: "table-tennis",
    name: "Table Tennis",
    tagline: "Quick rallies. Big energy.",
    visual: "Table, net, paddle and ball",
    resourceNoun: "table",
  },
  {
    id: "futsal",
    name: "Futsal / Mini Football",
    tagline: "Small pitch. Big plays.",
    visual: "Compact goals and a futsal ball on the venue's pitch surface",
    resourceNoun: "pitch",
  },
  {
    id: "tennis",
    name: "Tennis",
    tagline: "Serve up your next match.",
    visual: "Racket and tennis ball inside the service boxes",
    resourceNoun: "court",
  },
  {
    id: "padel",
    name: "Padel",
    tagline: "Find your next game behind the glass.",
    visual: "Glass-walled padel court with a solid perforated padel racket",
    resourceNoun: "court",
  },
  {
    id: "sepak-takraw",
    name: "Sepak Takraw",
    tagline: "Take your game above the net.",
    visual: "Woven rattan-style ball above a low net on a badminton-sized court",
    resourceNoun: "court",
  },
];

export const sportById = (id: SportId) => SPORTS.find((s) => s.id === id)!;

/**
 * Photographic card images. Add a sport here once its file is in
 * public/assets/sports/ (see docs/SPORT_PHOTO_PROMPTS.md). Sports without a
 * photo keep their illustrated court-diagram artwork.
 * `illustrative: true` = AI-generated or staged image, labelled as such on the
 * card so it is never mistaken for real venue photography.
 */
export interface SportPhoto {
  src: string;
  alt: string;
  illustrative: boolean;
  /** CSS object-position */
  position?: string;
  /** Zoom anchored at the bottom edge: lifts a low subject clear of the card text */
  zoom?: number;
}

const photo = (id: SportId, alt: string, zoom = 1, position = "center"): SportPhoto => ({
  src: `/assets/sports/${id}.jpg`,
  alt,
  illustrative: true, // AI-generated images (see docs/SPORT_PHOTO_PROMPTS.md)
  zoom,
  position,
});

export const SPORT_PHOTOS: Partial<Record<SportId, SportPhoto>> = {
  basketball: photo("basketball", "Basketball on glossy hardwood beneath a glass-backboard hoop"),
  billiards: photo("billiards", "Racked pool balls and a cue on green cloth under a pendant lamp", 1.15),
  volleyball: photo("volleyball", "Volleyball on an indoor court beside the net post", 1.3, "40% center"),
  badminton: photo("badminton", "Feather shuttlecock and racket on a green court mat", 1.2),
  pickleball: photo("pickleball", "Pickleball paddle and perforated ball at the kitchen line", 1.25),
  "table-tennis": photo("table-tennis", "Red paddle and white ball on a blue table tennis table", 1.2),
  futsal: photo("futsal", "Futsal ball on turf in front of a small goal", 1.1),
  tennis: photo("tennis", "Tennis racket and ball on a blue hard court", 1.2),
  padel: photo("padel", "Perforated padel racket and ball in front of the glass wall"),
  "sepak-takraw": photo("sepak-takraw", "Woven sepak takraw ball on an indoor court", 1.1),
};
