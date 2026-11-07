import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AutoRefresh } from "@/components/portal/AutoRefresh";
import { Flash, PortalHeader, peso } from "@/components/portal/Portal";
import { formatDate, formatRange } from "@/lib/booking/time";
import { q } from "@/lib/server/db";
import { gamesPlayed, liveGames, sessionById, sessionPlayers, type Player } from "@/lib/server/openplay";
import { requireVenueRole } from "@/lib/server/session";
import { fill, gameOver, sessionStatus, staffCheckIn, staffPlayerStatus, staffWalkIn } from "../../../../openplay/actions";

export const metadata: Metadata = { title: "Open play — Playbook", robots: { index: false } };
export const dynamic = "force-dynamic";

const SKILL: Record<string, string> = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" };

export default async function OpenPlayControl({ params, searchParams }: { params: Promise<{ id: string; sid: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id, sid } = await params;
  const sp = await searchParams;
  await requireVenueRole(id, "staff");
  const s = await sessionById(sid);
  if (!s || s.venue_id !== id) notFound();
  const [players, games, courts, played] = await Promise.all([
    sessionPlayers(sid),
    liveGames(sid),
    q<{ id: string; name: string }>("SELECT id, name FROM resource WHERE id = ANY($1) ORDER BY sort, created_at", [s.court_ids]),
    gamesPlayed(sid),
  ]);
  const byId = new Map(players.map((p) => [p.id, p]));
  const waiting = players.filter((p) => p.status === "waiting");
  const registered = players.filter((p) => p.status === "registered");
  const resting = players.filter((p) => p.status === "resting");
  const playing = players.filter((p) => p.status === "playing");
  const collected = players.reduce((sum, p) => sum + p.paid_cents, 0);
  const hidden = (more: Record<string, string> = {}) => (
    <>
      <input type="hidden" name="venue_id" value={id} />
      <input type="hidden" name="session_id" value={sid} />
      {Object.entries(more).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
    </>
  );
  const names = (ids: string[]) => ids.map((i) => byId.get(i)?.name ?? "?").join(" & ");
  const live = s.status === "live";

  return (
    <main id="main" className="app-shell">
      {live && <AutoRefresh seconds={15} />}
      <PortalHeader
        eyebrow={`Open play · code ${s.code}`}
        title={s.title}
        actions={
          <>
            <span className={`badge ${live ? "badge-ok" : "badge-warn"}`}>{s.status}</span>
            <Link href={`/board/${s.code}`} className="btn btn-xs" target="_blank">TV board</Link>
            <Link href={`/venue/${id}?tab=openplay`} className="btn btn-xs btn-ghost">All sessions</Link>
          </>
        }
      />
      <div className="app-body">
        <div className="container app-stack">
          <Flash ok={sp.ok} error={sp.error} />
          <div className="stat-row">
            <div className="stat"><b>{formatRange(s.start_min, s.end_min)}</b><span>{formatDate(s.date)}</span></div>
            <div className="stat"><b>{waiting.length}</b><span>Waiting</span></div>
            <div className="stat"><b>{playing.length}</b><span>On court</span></div>
            <div className="stat"><b>{played?.n ?? 0}</b><span>Games played</span></div>
            <div className="stat"><b>{peso(collected)}</b><span>Collected ({peso(s.fee_cents)} each)</span></div>
          </div>

          <section className="app-card">
            <div className="inline-form">
              <h2 style={{ marginRight: "auto" }}>Courts</h2>
              {s.status === "scheduled" && (
                <form action={sessionStatus}>{hidden({ status: "live" })}<button className="btn btn-sm" type="submit">Start session</button></form>
              )}
              {live && <form action={fill}>{hidden()}<button className="btn btn-sm" type="submit">Fill free courts</button></form>}
              {live && <form action={sessionStatus}>{hidden({ status: "ended" })}<button className="btn btn-sm btn-outline" type="submit">End session</button></form>}
              {s.status === "scheduled" && <form action={sessionStatus}>{hidden({ status: "cancelled" })}<button className="btn btn-sm btn-outline" type="submit">Cancel</button></form>}
            </div>
            <div className="op-courts">
              {courts.map((c) => {
                const g = games.find((x) => x.resource_id === c.id);
                return (
                  <div key={c.id} className={`op-court ${g ? "is-playing" : ""}`}>
                    <h3>{c.name}</h3>
                    {g ? (
                      <>
                        <p className="op-team"><span className="badge badge-lime">A</span> {names(g.team_a)}</p>
                        <p className="op-vs">vs</p>
                        <p className="op-team"><span className="badge on-dark">B</span> {names(g.team_b)}</p>
                        <div className="chip-row">
                          <form action={gameOver}>{hidden({ game_id: g.id, winner: "a" })}<button className="btn btn-xs" type="submit">A won</button></form>
                          <form action={gameOver}>{hidden({ game_id: g.id, winner: "b" })}<button className="btn btn-xs" type="submit">B won</button></form>
                          <form action={gameOver}>{hidden({ game_id: g.id, winner: "" })}<button className="btn btn-xs btn-outline" type="submit">Game over</button></form>
                        </div>
                      </>
                    ) : (
                      <p className="hint">{live ? (waiting.length >= 4 ? "Free — press Fill free courts" : "Free — waiting for 4 players") : "Not started"}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <div className="app-grid">
            <section className="app-card">
              <h2>Queue ({waiting.length})</h2>
              {waiting.length === 0 ? <p className="hint">Nobody waiting.</p> : (
                <ol className="op-queue">
                  {waiting.map((p, i) => (
                    <li key={p.id}>
                      <span className="op-pos">{i + 1}</span>
                      <span className="op-name">{p.name}<span className="hint"> · {SKILL[p.skill]} · {p.games_played} games</span></span>
                      <PlayerAction p={p} status="resting" label="Rest" hidden={hidden} />
                      <PlayerAction p={p} status="left" label="Left" hidden={hidden} />
                    </li>
                  ))}
                </ol>
              )}
              {resting.length > 0 && (
                <>
                  <h3>Resting</h3>
                  <ul className="op-queue">
                    {resting.map((p) => (
                      <li key={p.id}><span className="op-name">{p.name}</span><PlayerAction p={p} status="waiting" label="Back in queue" hidden={hidden} /><PlayerAction p={p} status="left" label="Left" hidden={hidden} /></li>
                    ))}
                  </ul>
                </>
              )}
            </section>
            <aside className="app-stack">
              <section className="app-card">
                <h3>Check in ({registered.length})</h3>
                {registered.length === 0 ? <p className="hint">Players who join with the QR code appear here.</p> : (
                  <ul className="op-queue">
                    {registered.map((p) => (
                      <li key={p.id}>
                        <span className="op-name">{p.name}<span className="hint"> · {SKILL[p.skill]}</span></span>
                        <form action={staffCheckIn} className="inline-form">
                          {hidden({ player_id: p.id })}
                          <input className="input" name="paid" inputMode="decimal" defaultValue={s.fee_cents / 100} aria-label={`Paid by ${p.name}`} style={{ maxWidth: 90 }} />
                          <button className="btn btn-xs" type="submit">Check in</button>
                        </form>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <form action={staffWalkIn} className="app-card form-grid">
                <h3>Add a walk-in</h3>
                {hidden()}
                <div className="field"><label htmlFor="wk-name">Name</label><input id="wk-name" name="name" className="input" required /></div>
                <div className="field-row">
                  <div className="field"><label htmlFor="wk-skill">Level</label>
                    <select id="wk-skill" name="skill" className="select" defaultValue="intermediate"><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select>
                  </div>
                  <div className="field"><label htmlFor="wk-paid">Paid (₱)</label><input id="wk-paid" name="paid" inputMode="decimal" className="input" defaultValue={s.fee_cents / 100} /></div>
                </div>
                <button className="btn btn-sm" type="submit">Add to queue</button>
              </form>
              <section className="app-card">
                <h3>Players join here</h3>
                <p>Show the TV board, or share <strong>/play/{s.code}</strong>.</p>
              </section>
            </aside>
          </div>
        </div>
      </div>
    </main>
  );
}

function PlayerAction({ p, status, label, hidden }: { p: Player; status: string; label: string; hidden: (m?: Record<string, string>) => React.ReactNode }) {
  return (
    <form action={staffPlayerStatus}>
      {hidden({ player_id: p.id, status })}
      <button className="btn btn-xs btn-outline" type="submit">{label}</button>
    </form>
  );
}
