import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CourtFields } from "@/components/portal/CourtFields";
import { Flash, PortalHeader, VenueStatus, peso, when } from "@/components/portal/Portal";
import { SPORTS } from "@/content/sports";
import { q, q1 } from "@/lib/server/db";
import { requireVenueRole } from "@/lib/server/session";
import { addCourt, addMember, removeMember, updateCourt, updateVenue } from "../actions";

export const metadata: Metadata = { title: "Venue dashboard — Playbook", robots: { index: false } };
export const dynamic = "force-dynamic";

type Venue = {
  id: string; name: string; area: string; address: string; phone: string | null; description: string | null; status: string; status_reason: string | null;
  plan: string; trial_ends_at: string | null; open_time: string; close_time: string; deposit_percent: number; free_cancel_hours: number; created_at: string;
};
type Court = { id: string; name: string; kind: string; sports: string[]; indoor: boolean; hourly_rate_cents: number; active: boolean };
const sportName = (id: string) => SPORTS.find((s) => s.id === id)?.name ?? id;
const PLAN: Record<string, string> = { trial: "Free trial", manage: "Manage", capture: "Capture", club: "Club" };

export default async function VenueDashboard({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { role } = await requireVenueRole(id, "staff");
  const venue = await q1<Venue>(
    "SELECT id, name, area, address, phone, description, status, status_reason, plan, trial_ends_at, to_char(open_time,'HH24:MI') AS open_time, to_char(close_time,'HH24:MI') AS close_time, deposit_percent, free_cancel_hours, created_at FROM venue WHERE id = $1",
    [id],
  );
  if (!venue) notFound();
  const tab = ["overview", "courts", "staff", "settings"].includes(sp.tab ?? "") ? sp.tab! : "overview";
  const canManage = role === "owner" || role === "manager";
  const tabs = [
    { key: "overview", label: "Overview", href: `/venue/${id}` },
    { key: "courts", label: "Courts", href: `/venue/${id}?tab=courts` },
    ...(canManage ? [{ key: "staff", label: "Staff", href: `/venue/${id}?tab=staff` }, { key: "settings", label: "Settings", href: `/venue/${id}?tab=settings` }] : []),
  ];

  return (
    <main id="main" className="app-shell">
      <PortalHeader
        eyebrow={`${venue.area} · ${role}`}
        title={venue.name}
        actions={<><VenueStatus status={venue.status} /><Link href="/venue" className="btn btn-xs btn-ghost">All venues</Link></>}
        tabs={tabs}
        active={tab}
      />
      <div className="app-body">
        <div className="container app-stack">
          <Flash ok={sp.ok} error={sp.error} />
          {tab === "overview" && <Overview venue={venue} />}
          {tab === "courts" && <Courts venueId={id} canManage={canManage} />}
          {tab === "staff" && canManage && <Staff venueId={id} isOwner={role === "owner"} />}
          {tab === "settings" && canManage && <Settings venue={venue} />}
        </div>
      </div>
    </main>
  );
}

async function Overview({ venue }: { venue: Venue }) {
  const [stats] = await q<{ courts: number; today: number; upcoming: number; fees: number }>(
    `SELECT (SELECT count(*)::int FROM resource WHERE venue_id=$1 AND active) AS courts,
            (SELECT count(*)::int FROM booking WHERE venue_id=$1 AND date=(now() AT TIME ZONE 'Asia/Manila')::date AND status IN ('held','confirmed')) AS today,
            (SELECT count(*)::int FROM booking WHERE venue_id=$1 AND date>(now() AT TIME ZONE 'Asia/Manila')::date AND status IN ('held','confirmed')) AS upcoming,
            (SELECT coalesce(sum(platform_fee_cents),0)::int FROM booking WHERE venue_id=$1 AND status IN ('confirmed','completed') AND date_trunc('month',created_at)=date_trunc('month',now())) AS fees`,
    [venue.id],
  );
  return (
    <>
      {venue.status === "pending" && <div className="alert alert-info">Your venue is under review. We check the business details and courts, then email you when it&apos;s live. Players can&apos;t see it yet.</div>}
      {venue.status === "rejected" && <div className="alert alert-error">Not approved{venue.status_reason ? `: ${venue.status_reason}` : "."} Update your details and contact support to request another review.</div>}
      {venue.status === "suspended" && <div className="alert alert-error">Suspended{venue.status_reason ? `: ${venue.status_reason}` : "."} New bookings are paused. Contact support.</div>}
      <div className="stat-row">
        <div className="stat"><b>{stats.courts}</b><span>Active courts</span></div>
        <div className="stat"><b>{stats.today}</b><span>Bookings today</span></div>
        <div className="stat"><b>{stats.upcoming}</b><span>Upcoming bookings</span></div>
        <div className="stat"><b>{peso(stats.fees)}</b><span>Platform fees this month</span></div>
      </div>
      <div className="app-grid">
        <section className="app-card">
          <h2>Next steps</h2>
          <ul className="plain-list">
            <li>{venue.status === "active" ? "✓" : "•"} Venue approved by Playbook</li>
            <li>• Connect your PayMongo account so players can pay you online <span className="badge badge-muted">Coming next</span></li>
            <li>• Booking calendar and walk-ins <span className="badge badge-muted">Coming next</span></li>
          </ul>
        </section>
        <aside className="app-card">
          <h3>Plan</h3>
          <dl className="kv">
            <dt>Plan</dt><dd>{PLAN[venue.plan] ?? venue.plan}</dd>
            {venue.trial_ends_at && (<><dt>Trial ends</dt><dd>{when(venue.trial_ends_at)}</dd></>)}
            <dt>Listed</dt><dd>{when(venue.created_at)}</dd>
          </dl>
        </aside>
      </div>
    </>
  );
}

async function Courts({ venueId, canManage }: { venueId: string; canManage: boolean }) {
  const courts = await q<Court>("SELECT id, name, kind, sports, indoor, hourly_rate_cents, active FROM resource WHERE venue_id=$1 ORDER BY sort, created_at", [venueId]);
  return (
    <section className="app-card">
      <h2>Courts, tables and pitches</h2>
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th scope="col">Name</th><th scope="col">Sport</th><th scope="col">Type</th><th scope="col">Rate / hour</th>{canManage && <th scope="col">Edit</th>}</tr></thead>
          <tbody>
            {courts.map((c) => (
              <tr key={c.id}>
                <td><strong>{c.name}</strong>{!c.active && <> <span className="badge badge-muted">Inactive</span></>}</td>
                <td>{c.sports.map(sportName).join(", ")}</td>
                <td>{c.kind} · {c.indoor ? "indoor" : "outdoor"}</td>
                <td>{peso(c.hourly_rate_cents)}</td>
                {canManage && (
                  <td>
                    <form action={updateCourt} className="inline-form">
                      <input type="hidden" name="venue_id" value={venueId} />
                      <input type="hidden" name="id" value={c.id} />
                      <input className="input" name="rate" defaultValue={c.hourly_rate_cents / 100} inputMode="decimal" aria-label={`${c.name} hourly rate`} />
                      <select className="select" name="active" defaultValue={c.active ? "1" : "0"} aria-label={`${c.name} status`}>
                        <option value="1">Active</option>
                        <option value="0">Inactive</option>
                      </select>
                      <button className="btn btn-xs" type="submit">Save</button>
                    </form>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {canManage && (
        <form action={addCourt} className="form-section">
          <h3>Add a court</h3>
          <input type="hidden" name="venue_id" value={venueId} />
          <CourtFields i={0} required />
          <button className="btn btn-sm" type="submit">Add</button>
        </form>
      )}
    </section>
  );
}

async function Staff({ venueId, isOwner }: { venueId: string; isOwner: boolean }) {
  const members = await q<{ user_id: string; name: string; email: string; role: string }>(
    `SELECT m.user_id, u.name, u.email, m.role FROM venue_member m JOIN "user" u ON u.id = m.user_id WHERE m.venue_id=$1 ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END, u.name`,
    [venueId],
  );
  return (
    <section className="app-card">
      <h2>Staff access</h2>
      <p className="hint">Managers can edit courts, staff and settings. Front-desk staff can view the venue and, once bookings launch, check players in. Only the owner sees billing.</p>
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Role</th>{isOwner && <th scope="col" />}</tr></thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.user_id}>
                <td>{m.name}</td><td>{m.email}</td><td>{m.role}</td>
                {isOwner && (
                  <td>
                    {m.role !== "owner" && (
                      <form action={removeMember}>
                        <input type="hidden" name="venue_id" value={venueId} />
                        <input type="hidden" name="user_id" value={m.user_id} />
                        <button className="btn btn-xs btn-outline" type="submit">Remove</button>
                      </form>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form action={addMember} className="form-section">
        <h3>Add someone</h3>
        <p className="hint">They need a Playbook account first.</p>
        <input type="hidden" name="venue_id" value={venueId} />
        <div className="inline-form">
          <input className="input" name="email" type="email" placeholder="Their email" required aria-label="Email" />
          <select className="select" name="role" defaultValue="staff" aria-label="Role">
            <option value="staff">Front-desk staff</option>
            {isOwner && <option value="manager">Manager</option>}
          </select>
          <button className="btn btn-sm" type="submit">Add</button>
        </div>
      </form>
    </section>
  );
}

function Settings({ venue }: { venue: Venue }) {
  return (
    <form action={updateVenue} className="app-card form-grid" style={{ maxWidth: 760 }}>
      <h2>Venue settings</h2>
      <input type="hidden" name="venue_id" value={venue.id} />
      <div className="field-row">
        <div className="field"><label htmlFor="open_time">Opens</label><input id="open_time" name="open_time" type="time" className="input" defaultValue={venue.open_time} /></div>
        <div className="field"><label htmlFor="close_time">Closes</label><input id="close_time" name="close_time" type="time" className="input" defaultValue={venue.close_time} /></div>
      </div>
      <div className="field-row">
        <div className="field"><label htmlFor="deposit_percent">Deposit to confirm (%)</label><input id="deposit_percent" name="deposit_percent" type="number" min={0} max={100} className="input" defaultValue={venue.deposit_percent} /></div>
        <div className="field"><label htmlFor="free_cancel_hours">Free cancellation (hours before)</label><input id="free_cancel_hours" name="free_cancel_hours" type="number" min={0} max={168} className="input" defaultValue={venue.free_cancel_hours} /></div>
      </div>
      <div className="field"><label htmlFor="phone">Contact number</label><input id="phone" name="phone" className="input" defaultValue={venue.phone ?? ""} /></div>
      <div className="field"><label htmlFor="description">About the venue</label><textarea id="description" name="description" className="input textarea" defaultValue={venue.description ?? ""} maxLength={600} /></div>
      <p className="hint">Name, address and business details are verified, so changes go through support.</p>
      <button className="btn" type="submit">Save settings</button>
    </form>
  );
}
