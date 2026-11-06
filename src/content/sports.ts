import type { SportId } from "../lib/booking/types.ts";

export interface Sport {
  id: SportId;
  name: string;
  tagline: string;
  visual: string; // art direction note (also used as image alt text)
  resourceNoun: string; // "court", "table", "pitch"
  featured?: boolean;
}

// Order = display order. Basketball is the launch priority (not a market claim).
export const SPORTS: Sport[] = [
  {
    id: "basketball",
    name: "Basketball",
    tagline: "Get the squad on court.",
    visual: "Basketball resting on hardwood beside the free-throw lane and hoop",
    resourceNoun: "court",
    featured: true,
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
    id: "pickleball",
    name: "Pickleball",
    tagline: "Your next doubles game starts here.",
    visual: "Paddle and perforated ball beside the non-volley kitchen line",
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
