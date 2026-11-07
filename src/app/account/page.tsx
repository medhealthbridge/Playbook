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
