import Link from "next/link";
import type { Metadata } from "next";
import { Flash, PortalHeader, VenueStatus, peso } from "@/components/portal/Portal";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { q } from "@/lib/server/db";
import { isPlatformAdmin, myVenues, requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Your account — Playbook", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AccountPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const user = await requireUser("/account");
  const [venues, bookings] = await Promise.all([
    myVenues(user.id),
    q<{ id: string; ref: string; date: string; start_min: number; end_min: number; status: string; price_cents: number; venue: string; court: string }>(
      `SELECT b.id, b.ref, to_char(b.date, 'Dy, Mon DD') AS date, b.start_min, b.end_min, b.status, b.price_cents, v.name AS venue, r.name AS court
         FROM booking b JOIN venue v ON v.id = b.venue_id JOIN resource r ON r.id = b.resource_id
        WHERE b.user_id = $1 ORDER BY b.date DESC, b.start_min DESC LIMIT 20`,
      [user.id],
    ),
  ]);
  const [feed, replies] = await Promise.all([
    q<{ id: string; title: string; body: string; created_at: string; venue: string; slug: string }>(
      `SELECT a.id, a.title, a.body, a.created_at, v.name AS venue, v.slug FROM venue_announcement a JOIN venue_follower f ON f.venue_id=a.venue_id AND f.user_id=$1
         JOIN venue v ON v.id=a.venue_id ORDER BY a.created_at DESC LIMIT 8`,
      [user.id],
    ),
    q<{ booking_id: string; ref: string; venue: string; body: string; created_at: string }>(
      `SELECT * FROM (SELECT DISTINCT ON (m.booking_id) m.booking_id, b.ref, v.name AS venue, m.body, m.created_at, m.author_side
         FROM booking_message m JOIN booking b ON b.id=m.booking_id JOIN venue v ON v.id=b.venue_id WHERE b.user_id=$1 ORDER BY m.booking_id, m.created_at DESC) t
        WHERE t.author_side='venue' ORDER BY t.created_at DESC LIMIT 5`,
      [user.id],
    ),
  ]);
  const admin = isPlatformAdmin(user);
  const hm = (m: number) => `${String(Math.floor(m / 60) % 12 || 12)}:${String(m % 60).padStart(2, "0")} ${m < 720 ? "AM" : "PM"}`;

  return (
    <main id="main" className="app-shell">
      <PortalHeader
        eyebrow="Your account"
        title={`Hi, ${user.name.split(" ")[0]}`}
        actions={
          <>
            {admin && <Link href="/admin" className="btn btn-xs">Platform admin</Link>}
            <SignOutButton />
          </>
        }
      />
      <div className="app-body">
        <div className="container app-stack">
          {sp.denied && <Flash error="You don't have access to that page." />}
          {!user.emailVerified && <div className="alert alert-warn">Your email isn&apos;t confirmed yet. Check your inbox for the confirmation link.</div>}
          <div className="app-grid">
            <section className="app-card" aria-labelledby="bk">
              <h2 id="bk">Your bookings</h2>
              {bookings.length === 0 ? (
                <div className="empty">
                  <p>No bookings yet.</p>
                  <Link href="/venues" className="btn btn-sm">Find a court</Link>
                </div>
              ) : (
                <table className="ledger">
                  <thead><tr><th scope="col">When</th><th scope="col">Where</th><th scope="col">Status</th><th scope="col">Price</th></tr></thead>
                  <tbody>
                    {bookings.map((b) => (
                      <tr key={b.id}>
                        <td>{b.date}<br /><span className="hint">{hm(b.start_min)}–{hm(b.end_min)}</span></td>
                        <td><Link href={`/bookings/${b.id}`}>{b.venue}</Link><br /><span className="hint">{b.court} · {b.ref}</span></td>
                        <td>{b.status === "held" ? "waiting" : b.status.replace("_", "-")}</td>
                        <td>{peso(b.price_cents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
            <aside className="app-stack">
              {replies.length > 0 && (
                <section className="app-card">
                  <h3>Replies from venues</h3>
                  <ul className="plain-list">
                    {replies.map((r) => (
                      <li key={r.booking_id}><Link href={`/bookings/${r.booking_id}#messages`}>{r.venue} · {r.ref}</Link><br /><span className="hint">{r.body.slice(0, 100)}</span></li>
                    ))}
                  </ul>
                </section>
              )}
              {feed.length > 0 && (
                <section className="app-card">
                  <h3>From venues you follow</h3>
                  {feed.map((n) => (
                    <article key={n.id} className="news-item">
                      <strong>{n.title}</strong>
                      <p>{n.body.length > 160 ? `${n.body.slice(0, 160)}…` : n.body}</p>
                      <span className="hint"><Link href={`/venues/${n.slug}`}>{n.venue}</Link></span>
                    </article>
                  ))}
                </section>
              )}
              <section className="app-card" aria-labelledby="pf">
                <h3 id="pf">Profile</h3>
                <dl className="kv">
                  <dt>Name</dt><dd>{user.name}</dd>
                  <dt>Email</dt><dd>{user.email} {user.emailVerified ? <span className="badge badge-ok">Confirmed</span> : <span className="badge badge-warn">Unconfirmed</span>}</dd>
                  {admin && (<><dt>Role</dt><dd><span className="badge badge-lime">Platform admin</span></dd></>)}
                </dl>
              </section>
              <section className="app-card" aria-labelledby="vn">
                <h3 id="vn">Your venues</h3>
                {venues.length === 0 ? (
                  <p className="hint">Run courts, tables or pitches? List your venue on Playbook.</p>
                ) : (
                  <ul className="plain-list">
                    {venues.map((v) => (
                      <li key={v.id}>
                        <Link href={`/venue/${v.id}`}>{v.name}</Link> <VenueStatus status={v.status} />
                        <span className="hint"> · {v.role}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <Link href="/venue/new" className="btn btn-sm btn-outline">Register a venue</Link>
              </section>
            </aside>
          </div>
        </div>
      </div>
    </main>
  );
}
