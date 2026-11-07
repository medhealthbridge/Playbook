import Link from "next/link";
import type { Metadata } from "next";
import { PortalHeader, peso } from "@/components/portal/Portal";
import { SPORTS } from "@/content/sports";
import { publicVenues } from "@/lib/server/bookings";

export const metadata: Metadata = { title: "Venues — Playbook", description: "Book courts, tables and pitches at venues across Metro Manila." };
export const dynamic = "force-dynamic";

export default async function VenuesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const sport = SPORTS.some((s) => s.id === sp.sport) ? sp.sport : undefined;
  const venues = await publicVenues(sport);
  const name = (id: string) => SPORTS.find((s) => s.id === id)?.name ?? id;
  return (
    <main id="main" className="app-shell">
      <PortalHeader eyebrow="Book a slot" title={sport ? `${name(sport)} venues` : "Venues"} />
      <div className="app-body">
        <div className="container app-stack">
          <nav className="chip-row" aria-label="Filter by sport">
            <Link href="/venues" className={`btn btn-xs ${!sport ? "" : "btn-outline"}`}>All sports</Link>
            {SPORTS.map((s) => (
              <Link key={s.id} href={`/venues?sport=${s.id}`} className={`btn btn-xs ${sport === s.id ? "" : "btn-outline"}`}>{s.name}</Link>
            ))}
          </nav>
          {venues.length === 0 ? (
            <section className="app-card">
              <h2>No venues yet{sport ? ` for ${name(sport)}` : ""}</h2>
              <p>Venues are joining Playbook. Run a venue? <Link href="/venue/new">List it here</Link>.</p>
            </section>
          ) : (
            <div className="venue-grid">
              {venues.map((v) => (
                <Link key={v.id} href={`/venues/${v.slug}${sport ? `?sport=${sport}` : ""}`} className="venue-card">
                  <h2>{v.name}</h2>
                  <p className="hint">{v.area} · {v.courts} {v.courts === 1 ? "court" : "courts"} · open {v.open_time}–{v.close_time}</p>
                  <p className="venue-sports">{(v.sports ?? []).map(name).join(" · ")}</p>
                  <p><strong>From {peso(v.from_cents)}</strong>/hour</p>
                  <span className="btn btn-sm">See times</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
