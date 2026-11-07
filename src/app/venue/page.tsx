import Link from "next/link";
import type { Metadata } from "next";
import { Flash, PortalHeader, VenueStatus } from "@/components/portal/Portal";
import { myVenues, requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Your venues — Playbook", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function VenuesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const user = await requireUser("/venue");
  const venues = await myVenues(user.id);
  return (
    <main id="main" className="app-shell">
      <PortalHeader eyebrow="Venue dashboard" title="Your venues" actions={<Link href="/venue/new" className="btn btn-sm">Register a venue</Link>} />
      <div className="app-body">
        <div className="container app-stack">
          {sp.denied && <Flash error="You don't have access to that venue." />}
          {venues.length === 0 ? (
            <section className="app-card">
              <h2>List your venue on Playbook</h2>
              <p>Take bookings online, manage courts and staff, and publish game recordings. Players pay you directly through your own PayMongo account.</p>
              <Link href="/venue/new" className="btn">Register a venue</Link>
            </section>
          ) : (
            <section className="app-card">
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th scope="col">Venue</th><th scope="col">City</th><th scope="col">Status</th><th scope="col">Your role</th></tr></thead>
                  <tbody>
                    {venues.map((v) => (
                      <tr key={v.id}>
                        <td><Link href={`/venue/${v.id}`}><strong>{v.name}</strong></Link></td>
                        <td>{v.area}</td>
                        <td><VenueStatus status={v.status} /></td>
                        <td>{v.role}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
