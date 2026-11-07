import { notFound } from "next/navigation";
import type { Metadata } from "next";
import QRCode from "qrcode";
import { AutoRefresh } from "@/components/portal/AutoRefresh";
import { formatRange } from "@/lib/booking/time";
import { publicName } from "@/lib/openplay/queue";
import { q, q1 } from "@/lib/server/db";
import { liveGames, sessionByCode, sessionPlayers } from "@/lib/server/openplay";

export const metadata: Metadata = { title: "Open play board — Playbook", robots: { index: false } };
export const dynamic = "force-dynamic";

// Public TV display for the venue. Shows first names and last initials only.
export default async function Board({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const s = await sessionByCode(code);
  if (!s) notFound();
  const [players, games, courts, venue] = await Promise.all([
    sessionPlayers(s.id),
    liveGames(s.id),
    q<{ id: string; name: string }>("SELECT id, name FROM resource WHERE id = ANY($1) ORDER BY sort, created_at", [s.court_ids]),
    q1<{ name: string }>("SELECT name FROM venue WHERE id=$1", [s.venue_id]),
  ]);
  const base = process.env.BETTER_AUTH_URL || "https://playbook.databridgesol.space";
  const joinUrl = `${base}/play/${s.code}`;
  const qr = await QRCode.toString(joinUrl, { type: "svg", margin: 1, color: { dark: "#101713", light: "#ffffff" } });
  const name = (id: string) => publicName(players.find((p) => p.id === id)?.name ?? "");
  const waiting = players.filter((p) => p.status === "waiting");
  return (
    <main className="board">
      <AutoRefresh seconds={5} />
      <header className="board-head">
        <div>
          <p className="board-eyebrow">{venue?.name} · {formatRange(s.start_min, s.end_min)}</p>
          <h1>{s.title}</h1>
        </div>
        <div className="board-join">
          <div className="board-qr" dangerouslySetInnerHTML={{ __html: qr }} />
          <div><b>Scan to join</b><span>or open /play/{s.code}</span></div>
        </div>
      </header>
      <section className="board-courts">
        {courts.map((c) => {
          const g = games.find((x) => x.resource_id === c.id);
          return (
            <div key={c.id} className={`board-court ${g ? "on" : ""}`}>
              <h2>{c.name}</h2>
              {g ? (
                <>
                  <p className="board-team">{g.team_a.map(name).join(" & ")}</p>
                  <p className="board-vs">vs</p>
                  <p className="board-team">{g.team_b.map(name).join(" & ")}</p>
                </>
              ) : (
                <p className="board-free">{s.status === "live" ? "Free" : s.status === "scheduled" ? "Starting soon" : "Closed"}</p>
              )}
            </div>
          );
        })}
      </section>
      <section className="board-next">
        <h2>Up next</h2>
        {waiting.length === 0 ? <p className="board-free">Queue is empty — scan to join</p> : (
          <ol>{waiting.slice(0, 12).map((p, i) => <li key={p.id} className={i < 4 ? "soon" : ""}><span>{i + 1}</span>{publicName(p.name)}</li>)}</ol>
        )}
        {waiting.length > 12 && <p className="board-more">+{waiting.length - 12} more in the queue</p>}
      </section>
    </main>
  );
}
