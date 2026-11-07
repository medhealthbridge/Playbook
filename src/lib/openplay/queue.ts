// Open play rotation (pure, unit-tested in tests/engine.test.ts).
// Players wait in a queue ordered by when they (re)joined it. When a court is
// free, the next four go on. "all_off": everyone returns to the back of the
// queue after a game. "winners_stay": winners stay on (up to `maxStreak`
// games in a row) and the next two waiting players challenge them.

export type Skill = "beginner" | "intermediate" | "advanced";
export interface QPlayer {
  id: string;
  skill: Skill;
  queueAt: number; // ms; earlier = sooner
}

/** Pick the next group of `size` from the waiting queue. With skill matching, prefer players of the first player's level. */
export function nextGroup(waiting: QPlayer[], size = 4, skillMatch = false): QPlayer[] | null {
  const q = [...waiting].sort((a, b) => a.queueAt - b.queueAt);
  if (q.length < size) return null;
  if (!skillMatch) return q.slice(0, size);
  const head = q[0];
  const same = q.filter((p) => p.skill === head.skill);
  if (same.length >= size) return same.slice(0, size);
  // Not enough at that level: fill with the earliest others so nobody waits forever.
  const rest = q.filter((p) => p.skill !== head.skill);
  return [...same, ...rest].slice(0, size).sort((a, b) => a.queueAt - b.queueAt);
}

/** Split four players into two teams: 1st+4th vs 2nd+3rd in queue order (spreads early arrivals). */
export function teams(group: QPlayer[]): [string[], string[]] {
  const g = [...group].sort((a, b) => a.queueAt - b.queueAt);
  return [[g[0].id, g[3].id], [g[1].id, g[2].id]];
}

export interface GameEnd {
  /** players who go back to the queue */
  toQueue: string[];
  /** players who stay on court for the next game (winners_stay) */
  stay: string[];
}

/** Who leaves the court after a game. `streak` = winners' consecutive wins including this one. */
export function afterGame(mode: "all_off" | "winners_stay", teamA: string[], teamB: string[], winner: "a" | "b" | null, streak: number, maxStreak = 2): GameEnd {
  if (mode === "all_off" || !winner || streak >= maxStreak) return { toQueue: [...teamA, ...teamB], stay: [] };
  const [w, l] = winner === "a" ? [teamA, teamB] : [teamB, teamA];
  return { toQueue: l, stay: w };
}

const CODE = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export function joinCode(rand: () => number = Math.random) {
  let s = "";
  for (let i = 0; i < 5; i++) s += CODE[Math.floor(rand() * CODE.length)];
  return s;
}

/** "Juan Dela Cruz" -> "Juan D." for public screens. */
export function publicName(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0] || "Player";
}
