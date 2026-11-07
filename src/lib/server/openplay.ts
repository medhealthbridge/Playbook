import "server-only";
import { afterGame, joinCode, nextGroup, teams, type QPlayer, type Skill } from "@/lib/openplay/queue";
import { audit, q, q1, tx } from "./db";

export type Session = {
  id: string; venue_id: string; code: string; title: string; sport: string; date: string; start_min: number; end_min: number; court_ids: string[];
  fee_cents: number; max_players: number; mode: "all_off" | "winners_stay"; skill_match: boolean; status: string;
};
export type Player = {
  id: string; session_id: string; user_id: string | null; name: string; skill: Skill; status: string; queue_at: string | null;
  games_played: number; win_streak: number; paid_cents: number; checked_in_at: string | null;
};
export type Game = { id: string; session_id: string; resource_id: string; team_a: string[]; team_b: string[]; winner: string | null; status: string; started_at: string };

const SESSION_COLS = "id, venue_id, code, title, sport, to_char(date,'YYYY-MM-DD') AS date, start_min, end_min, court_ids, fee_cents, max_players, mode, skill_match, status";
export class OpenPlayError extends Error {}

export const sessionById = (id: string) => q1<Session>(`SELECT ${SESSION_COLS} FROM open_play_session WHERE id=$1`, [id]);
export const sessionByCode = (code: string) => q1<Session>(`SELECT ${SESSION_COLS} FROM open_play_session WHERE code=$1`, [code.toUpperCase()]);
export const venueSessions = (venueId: string) =>
  q<Session & { players: number }>(
    `SELECT ${SESSION_COLS}, (SELECT count(*)::int FROM open_play_player p WHERE p.session_id=s.id AND p.status <> 'left') AS players
       FROM open_play_session s WHERE venue_id=$1 AND date >= (now() AT TIME ZONE 'Asia/Manila')::date - 7 ORDER BY date, start_min`,
    [venueId],
  );
export const upcomingPublicSessions = (venueId: string) =>
  q<Session & { players: number }>(
    `SELECT ${SESSION_COLS}, (SELECT count(*)::int FROM open_play_player p WHERE p.session_id=s.id AND p.status <> 'left') AS players
       FROM open_play_session s WHERE venue_id=$1 AND status IN ('scheduled','live') AND date >= (now() AT TIME ZONE 'Asia/Manila')::date ORDER BY date, start_min LIMIT 10`,
    [venueId],
  );
export const sessionPlayers = (sessionId: string) =>
  q<Player>("SELECT * FROM open_play_player WHERE session_id=$1 ORDER BY queue_at NULLS LAST, created_at", [sessionId]);
export const liveGames = (sessionId: string) =>
  q<Game>("SELECT id, session_id, resource_id, team_a, team_b, winner, status, started_at FROM open_play_game WHERE session_id=$1 AND status='playing'", [sessionId]);
export const gamesPlayed = (sessionId: string) => q1<{ n: number }>("SELECT count(*)::int AS n FROM open_play_game WHERE session_id=$1 AND status='done'", [sessionId]);

export async function createSession(venueId: string, actorId: string, s: {
  title: string; date: string; startMin: number; endMin: number; courtIds: string[]; feeCents: number; maxPlayers: number; mode: "all_off" | "winners_stay"; skillMatch: boolean;
}) {
  return tx(async (run) => {
    const clash = await run<{ n: number }>(
      `SELECT count(*)::int AS n FROM booking WHERE resource_id = ANY($1) AND date=$2 AND status IN ('held','confirmed') AND start_min < $4 AND end_min > $3`,
      [s.courtIds, s.date, s.startMin, s.endMin],
    );
    if (clash[0].n > 0) throw new OpenPlayError("Some of those courts already have bookings in that time. Pick other courts or another time.");
    let id = "";
    for (let i = 0; i < 5 && !id; i++) {
      const r = await run<{ id: string }>(
        `INSERT INTO open_play_session (venue_id, code, title, date, start_min, end_min, court_ids, fee_cents, max_players, mode, skill_match, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (code) DO NOTHING RETURNING id`,
        [venueId, joinCode(), s.title, s.date, s.startMin, s.endMin, s.courtIds, s.feeCents, s.maxPlayers, s.mode, s.skillMatch, actorId],
      );
      id = r[0]?.id ?? "";
    }
    if (!id) throw new OpenPlayError("Couldn't create the session. Try again.");
    for (const c of s.courtIds) {
      await run("INSERT INTO resource_block (resource_id, date, start_min, end_min, reason, created_by, open_play_session_id) VALUES ($1,$2,$3,$4,$5,$6,$7)",
        [c, s.date, s.startMin, s.endMin, `Open play: ${s.title}`, actorId, id]);
    }
    await run("INSERT INTO audit_log (actor_id, action, target_type, target_id, meta) VALUES ($1,'openplay.create','open_play_session',$2,$3)", [actorId, id, JSON.stringify({ venueId, date: s.date })]);
    return id;
  });
}

export async function joinSession(session: Session, user: { id: string; name: string }, skill: Skill) {
  if (session.status === "ended" || session.status === "cancelled") throw new OpenPlayError("This session has ended.");
  const n = await q1<{ n: number }>("SELECT count(*)::int AS n FROM open_play_player WHERE session_id=$1 AND status <> 'left'", [session.id]);
  if (n!.n >= session.max_players) throw new OpenPlayError("This session is full.");
  await q(
    `INSERT INTO open_play_player (session_id, user_id, name, skill) VALUES ($1,$2,$3,$4)
     ON CONFLICT (session_id, user_id) DO UPDATE SET status = CASE WHEN open_play_player.status='left' THEN 'registered' ELSE open_play_player.status END, skill=EXCLUDED.skill`,
    [session.id, user.id, user.name, skill],
  );
}

export async function addWalkIn(sessionId: string, name: string, skill: Skill, paidCents: number) {
  await q(
    "INSERT INTO open_play_player (session_id, name, skill, status, queue_at, checked_in_at, paid_cents) VALUES ($1,$2,$3,'waiting',now(),now(),$4)",
    [sessionId, name, skill, paidCents],
  );
}

export async function checkInPlayer(sessionId: string, playerId: string, paidCents: number) {
  await q(
    `UPDATE open_play_player SET status='waiting', queue_at=now(), checked_in_at=coalesce(checked_in_at, now()), paid_cents=paid_cents+$3
      WHERE id=$1 AND session_id=$2 AND status='registered'`,
    [playerId, sessionId, paidCents],
  );
}

/** waiting | resting | left. Back to the queue goes to the end of the line. */
export async function setPlayerStatus(sessionId: string, playerId: string, status: "waiting" | "resting" | "left") {
  await q(
    `UPDATE open_play_player SET status=$3, queue_at = CASE WHEN $3='waiting' THEN now() ELSE queue_at END
      WHERE id=$1 AND session_id=$2 AND status IN ('waiting','resting','registered')`,
    [playerId, sessionId, status],
  );
}

type Run = <R = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<R[]>;

async function fillWith(run: Run, s: Session) {
  const playing = await run<{ resource_id: string }>("SELECT resource_id FROM open_play_game WHERE session_id=$1 AND status='playing'", [s.id]);
  const free = s.court_ids.filter((c) => !playing.some((g) => g.resource_id === c));
  let started = 0;
  for (const court of free) {
    const waiting = await run<{ id: string; skill: Skill; queue_at: string }>(
      "SELECT id, skill, queue_at FROM open_play_player WHERE session_id=$1 AND status='waiting' ORDER BY queue_at",
      [s.id],
    );
    const group = nextGroup(waiting.map((p): QPlayer => ({ id: p.id, skill: p.skill, queueAt: new Date(p.queue_at).getTime() })), 4, s.skill_match);
    if (!group) break;
    const [a, b] = teams(group);
    await run("INSERT INTO open_play_game (session_id, resource_id, team_a, team_b) VALUES ($1,$2,$3,$4)", [s.id, court, a, b]);
    await run("UPDATE open_play_player SET status='playing' WHERE id = ANY($1)", [[...a, ...b]]);
    started++;
  }
  return started;
}

/** Put the next players on every free court. */
export async function fillCourts(sessionId: string) {
  return tx(async (run) => {
    const [s] = await run<Session>(`SELECT ${SESSION_COLS} FROM open_play_session WHERE id=$1 FOR UPDATE`, [sessionId]);
    if (!s || s.status !== "live") throw new OpenPlayError("Start the session first.");
    return fillWith(run, s);
  });
}

/** Record a result, rotate players, and refill free courts. */
export async function endGame(sessionId: string, gameId: string, winner: "a" | "b" | null, actorId: string) {
  await tx(async (run) => {
    const [s] = await run<Session>(`SELECT ${SESSION_COLS} FROM open_play_session WHERE id=$1 FOR UPDATE`, [sessionId]);
    const [g] = await run<Game>("SELECT id, session_id, resource_id, team_a, team_b, winner, status, started_at FROM open_play_game WHERE id=$1 AND session_id=$2 FOR UPDATE", [gameId, sessionId]);
    if (!s || !g || g.status !== "playing") throw new OpenPlayError("That game already ended.");
    await run("UPDATE open_play_game SET status='done', winner=$2, ended_at=now() WHERE id=$1", [gameId, winner]);
    const winners = winner === "a" ? g.team_a : winner === "b" ? g.team_b : [];
    const losers = winner === "a" ? g.team_b : winner === "b" ? g.team_a : [...g.team_a, ...g.team_b];
    await run("UPDATE open_play_player SET games_played=games_played+1, win_streak = CASE WHEN id = ANY($1) THEN win_streak+1 ELSE 0 END WHERE id = ANY($2)", [winners, [...g.team_a, ...g.team_b]]);
    const streak = winners.length ? (await run<{ s: number }>("SELECT max(win_streak)::int AS s FROM open_play_player WHERE id = ANY($1)", [winners]))[0].s : 0;
    const out = afterGame(s.mode, g.team_a, g.team_b, winner, streak);
    // Losers go back first, then winners rotating off, so ties keep a fair order.
    const ordered = [...losers.filter((id) => out.toQueue.includes(id)), ...out.toQueue.filter((id) => !losers.includes(id))];
    for (let i = 0; i < ordered.length; i++) {
      await run("UPDATE open_play_player SET status='waiting', queue_at = now() + make_interval(secs => $2), win_streak = CASE WHEN $3 THEN 0 ELSE win_streak END WHERE id=$1 AND status='playing'",
        [ordered[i], i * 0.001, out.stay.length === 0]);
    }
    if (out.stay.length && s.status === "live") {
      const waiting = await run<{ id: string; skill: Skill; queue_at: string }>("SELECT id, skill, queue_at FROM open_play_player WHERE session_id=$1 AND status='waiting' ORDER BY queue_at", [s.id]);
      const challengers = nextGroup(waiting.map((p) => ({ id: p.id, skill: p.skill, queueAt: new Date(p.queue_at).getTime() })), 2, s.skill_match);
      if (challengers) {
        await run("INSERT INTO open_play_game (session_id, resource_id, team_a, team_b) VALUES ($1,$2,$3,$4)", [s.id, g.resource_id, out.stay, challengers.map((c) => c.id)]);
        await run("UPDATE open_play_player SET status='playing' WHERE id = ANY($1)", [challengers.map((c) => c.id)]);
      } else {
        await run("UPDATE open_play_player SET status='waiting', queue_at=now(), win_streak=0 WHERE id = ANY($1)", [out.stay]);
      }
    }
    if (s.status === "live") await fillWith(run, s);
  });
  await audit(actorId, "openplay.game_end", "open_play_session", sessionId, { gameId, winner });
}

export async function setSessionStatus(sessionId: string, status: "live" | "ended" | "cancelled", actorId: string) {
  await tx(async (run) => {
    await run("UPDATE open_play_session SET status=$2 WHERE id=$1", [sessionId, status]);
    if (status !== "live") {
      await run("UPDATE open_play_game SET status='done', ended_at=now() WHERE session_id=$1 AND status='playing'", [sessionId]);
      await run("UPDATE open_play_player SET status = CASE WHEN status='left' THEN 'left' ELSE 'resting' END WHERE session_id=$1", [sessionId]);
    }
    if (status === "cancelled") await run("DELETE FROM resource_block WHERE open_play_session_id=$1", [sessionId]);
  });
  await audit(actorId, `openplay.${status}`, "open_play_session", sessionId);
}
