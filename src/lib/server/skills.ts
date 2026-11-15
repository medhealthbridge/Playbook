import "server-only";
import { BASE_RATING, levelFor, ratingDelta } from "@/lib/openplay/rating";
import type { Skill } from "@/lib/openplay/queue";
import { q, q1 } from "./db";

export type SkillRow = { user_id: string; sport: string; level: Skill; rating: number; games: number; wins: number; losses: number };
type Run = <R = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<R[]>;

export const skillsFor = (userId: string) => q<SkillRow>("SELECT user_id, sport, level, rating, games, wins, losses FROM player_skill WHERE user_id=$1 ORDER BY sport", [userId]);
export const skillFor = (userId: string, sport: string) => q1<SkillRow>("SELECT user_id, sport, level, rating, games, wins, losses FROM player_skill WHERE user_id=$1 AND sport=$2", [userId, sport]);

/** Create the profile entry at the declared level if the player has none for this sport. Returns the level in force. */
export async function ensureSkill(userId: string, sport: string, declared: Skill): Promise<Skill> {
  const r = await q1<{ level: Skill }>(
    `INSERT INTO player_skill (user_id, sport, level, rating) VALUES ($1,$2,$3,$4)
     ON CONFLICT (user_id, sport) DO UPDATE SET updated_at = player_skill.updated_at RETURNING level`,
    [userId, sport, declared, BASE_RATING[declared]],
  );
  return r!.level;
}

/** Set a level outright (player before any game, or venue staff override). Rating restarts at that level's base. */
export async function setLevel(userId: string, sport: string, level: Skill) {
  await q(
    `INSERT INTO player_skill (user_id, sport, level, rating) VALUES ($1,$2,$3,$4)
     ON CONFLICT (user_id, sport) DO UPDATE SET level=EXCLUDED.level, rating=EXCLUDED.rating, updated_at=now()`,
    [userId, sport, level, BASE_RATING[level]],
  );
}

/** Apply a scored game to every player with an account: win/loss counts, rating, and the level that follows from it. */
export async function applyResult(run: Run, sport: string, winners: { userId: string | null; skill: Skill }[], losers: { userId: string | null; skill: Skill }[]) {
  const ids = [...winners, ...losers].map((p) => p.userId).filter((x): x is string => !!x);
  if (ids.length === 0) return;
  const rows = await run<{ user_id: string; rating: number }>("SELECT user_id, rating FROM player_skill WHERE sport=$1 AND user_id = ANY($2)", [sport, ids]);
  const rating = (p: { userId: string | null; skill: Skill }) => rows.find((r) => r.user_id === p.userId)?.rating ?? BASE_RATING[p.skill];
  const avg = (t: { userId: string | null; skill: Skill }[]) => t.reduce((s, p) => s + rating(p), 0) / Math.max(1, t.length);
  const d = ratingDelta(avg(winners), avg(losers));
  for (const [team, sign] of [[winners, 1], [losers, -1]] as const) {
    for (const p of team) {
      if (!p.userId) continue;
      const next = Math.max(700, rating(p) + sign * d);
      await run(
        `INSERT INTO player_skill (user_id, sport, level, rating, games, wins, losses) VALUES ($1,$2,$3,$4,1,$5,$6)
         ON CONFLICT (user_id, sport) DO UPDATE SET rating=EXCLUDED.rating, level=EXCLUDED.level, games=player_skill.games+1,
           wins=player_skill.wins+EXCLUDED.wins, losses=player_skill.losses+EXCLUDED.losses, updated_at=now()`,
        [p.userId, sport, levelFor(next), next, sign === 1 ? 1 : 0, sign === 1 ? 0 : 1],
      );
    }
  }
}
