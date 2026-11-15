// Player level from results (pure, unit-tested in tests/engine.test.ts).
// A new player starts at their self-declared level; every scored game moves
// the rating, and the level follows the rating.
import type { Skill } from "./queue.ts";

export const BASE_RATING: Record<Skill, number> = { beginner: 1000, intermediate: 1300, advanced: 1600 };
export const LEVEL_LABEL: Record<Skill, string> = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Expert" };

export const levelFor = (rating: number): Skill => (rating < 1150 ? "beginner" : rating < 1450 ? "intermediate" : "advanced");

/** Rating change for the winning side (the losing side gets the negative). Beating a stronger team moves more. */
export function ratingDelta(winnersAvg: number, losersAvg: number, k = 24): number {
  const expected = 1 / (1 + 10 ** ((losersAvg - winnersAvg) / 400));
  return Math.max(1, Math.round(k * (1 - expected)));
}
