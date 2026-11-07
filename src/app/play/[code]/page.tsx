import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AutoRefresh } from "@/components/portal/AutoRefresh";
import { Flash, PortalHeader, peso } from "@/components/portal/Portal";
import { formatDate, formatRange } from "@/lib/booking/time";
import { publicName } from "@/lib/openplay/queue";
import { q1 } from "@/lib/server/db";
import { liveGames, sessionByCode, sessionPlayers } from "@/lib/server/openplay";
import { getSession } from "@/lib/server/session";
import { joinOpenPlay, playerSelfStatus } from "../../openplay/actions";

export const metadata: Metadata = { title: "Join open play — Playbook", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function PlayPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { code } = await params;
  const sp = await searchParams;
  const s = await sessionByCode(code);
  if (!s) notFound();
  const [auth, venue, players, games] = await Promise.all([
    getSession(),
    q1<{ name: string; slug: string; area: string }>("SELECT name, slug, area FROM venue WHERE id=$1", [s.venue_id]),
    sessionPlayers(s.id),
    liveGames(s.id),
  ]);
  const me = auth ? players.find((p) => p.user_id === auth.user.id && p.status !== "left") : undefined;
  const waiting = players.filter((p) => p.status === "waiting");
  const pos = me ? waiting.findIndex((p) => p.id === me.id) + 1 : 0;
  const myGame = me ? games.find((g) => g.team_a.includes(me.id) || g.team_b.includes(me.id)) : undefined;
  const court = myGame ? await q1<{ name: string }>("SELECT name FROM resource WHERE id=$1", [myGame.resource_id]) : null;
  const nameOf = (id: string) => publicName(players.find((p) => p.id === id)?.name ?? "");
  const mates = myGame && me ? (myGame.team_a.includes(me.id) ? myGame.team_a : myGame.team_b).filter((x) => x !== me.id).map(nameOf) : [];
  const opps = myGame && me ? (myGame.team_a.includes(me.id) ? myGame.team_b : myGame.team_a).map(nameOf) : [];
  const freeCourts = s.court_ids.length - games.length;
  const ended = s.status === "ended" || s.status === "cancelled";
  const status = (st: string, label: string, cls = "btn-outline") => (
    <form action={playerSelfStatus}><input type="hidden" name="code" value={s.code} /><input type="hidden" name="status" value={st} /><button className={`btn btn-sm ${cls}`} type="submit">{label}</button></form>
  );

  return (
    <main id="main" className="app-shell">
      {s.status === "live" && me && <AutoRefresh seconds={10} />}
      <PortalHeader eyebrow={`${venue?.name ?? ""} · ${venue?.area ?? ""}`} title={s.title} />
      <div className="app-body">
        <div className="container app-stack" style={{ maxWidth: 640 }}>
          <Flash ok={sp.ok} error={sp.error} />
          <section className="app-card">
            <dl className="kv">
              <dt>When</dt><dd>{formatDate(s.date)}, {formatRange(s.start_min, s.end_min)}</dd>
              <dt>Fee</dt><dd>{s.fee_cents ? `${peso(s.fee_cents)} per player, paid at the front desk` : "Free"}</dd>
              <dt>Players</dt><dd>{players.filter((p) => p.status !== "left").length} / {s.max_players} · {s.court_ids.length} courts</dd>
              <dt>Status</dt><dd>{ended ? "Ended" : s.status === "live" ? `Live · ${waiting.length} waiting` : "Starts soon"}</dd>
            </dl>
          </section>

          {ended ? null : !auth ? (
            <section className="app-card">
              <h2>Join this session</h2>
              <p>Sign in or create a free account to join the queue.</p>
              <Link className="btn" href={`/login?next=${encodeURIComponent(`/play/${s.code}`)}`}>Sign in to join</Link>
            </section>
          ) : !me ? (
            <form action={joinOpenPlay} className="app-card form-grid">
              <h2>Join this session</h2>
              <input type="hidden" name="code" value={s.code} />
              <div className="field">
                <label htmlFor="skill">Your level</label>
                <select id="skill" name="skill" className="select" defaultValue="intermediate">
                  <option value="beginner">Beginner — learning the rules and the dink</option>
                  <option value="intermediate">Intermediate — consistent rallies, play the kitchen</option>
                  <option value="advanced">Advanced — fast hands, competitive play</option>
                </select>
              </div>
              <button className="btn" type="submit">Join the queue</button>
            </form>
          ) : (
            <section className={`app-card op-me op-me-${me.status}`}>
              {me.status === "registered" && (<><h2>You&apos;re registered</h2><p>Show this screen at the front desk to check in{s.fee_cents ? ` and pay ${peso(s.fee_cents)}` : ""}. Then you&apos;re in the queue.</p><p className="op-big">{me.name}</p></>)}
              {me.status === "waiting" && (<><h2>You&apos;re in the queue</h2><p className="op-big">#{pos}</p><p>{pos <= 4 && freeCourts > 0 ? "You're up next — head to the courts." : pos <= 4 ? "You're in the next group. Stay close to the courts." : `${pos - 1} players ahead of you.`}</p></>)}
              {me.status === "playing" && myGame && (<><h2>You&apos;re on {court?.name}</h2><p className="op-big">{court?.name}</p><p>With {mates.join(", ") || "your partner"} · vs {opps.join(" & ")}</p></>)}
              {me.status === "resting" && (<><h2>You&apos;re resting</h2><p>Jump back in whenever you&apos;re ready. You&apos;ll go to the end of the queue.</p></>)}
              <p className="hint">Games played: {me.games_played}</p>
              <div className="chip-row">
                {me.status === "waiting" && status("resting", "Take a break")}
                {me.status === "resting" && status("waiting", "Back in the queue", "")}
                {(me.status === "waiting" || me.status === "resting" || me.status === "registered") && status("left", "Leave session")}
              </div>
            </section>
          )}
          {venue && <p><Link href={`/venues/${venue.slug}`}>More at {venue.name} →</Link></p>}
        </div>
      </div>
    </main>
  );
}
