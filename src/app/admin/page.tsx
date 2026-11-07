import Link from "next/link";
import type { Metadata } from "next";
import { Flash, PortalHeader, VenueStatus, peso, when } from "@/components/portal/Portal";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { q, q1 } from "@/lib/server/db";
import { emailConfigured } from "@/lib/server/email";
import { requireAdmin } from "@/lib/server/session";
import { saveSettings, setUserBan, setUserRole, setVenueStatus } from "./actions";

export const metadata: Metadata = { title: "Platform admin — Playbook", robots: { index: false } };
export const dynamic = "force-dynamic";

const TABS = ["overview", "venues", "users", "audit", "settings"] as const;

export default async function AdminPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const admin = await requireAdmin();
  const tab = (TABS as readonly string[]).includes(sp.tab ?? "") ? sp.tab! : "overview";
  return (
    <main id="main" className="app-shell">
      <PortalHeader
        eyebrow="Platform admin"
        title="Playbook HQ"
        actions={<><span className="badge on-dark">{admin.email}</span><SignOutButton /></>}
        tabs={TABS.map((t) => ({ key: t, label: t[0].toUpperCase() + t.slice(1), href: t === "overview" ? "/admin" : `/admin?tab=${t}` }))}
        active={tab}
      />
      <div className="app-body">
        <div className="container app-stack">
          <Flash ok={sp.ok} error={sp.error} />
          {tab === "overview" && <Overview />}
          {tab === "venues" && <Venues filter={sp.status} />}
          {tab === "users" && <Users meId={admin.id} search={sp.q} />}
          {tab === "audit" && <Audit />}
          {tab === "settings" && <Settings />}
        </div>
      </div>
    </main>
  );
}

async function Overview() {
  const s = (await q1<Record<string, number>>(
    `SELECT (SELECT count(*)::int FROM venue WHERE status='pending') AS pending,
            (SELECT count(*)::int FROM venue WHERE status='active') AS active,
            (SELECT count(*)::int FROM venue WHERE status IN ('suspended','rejected')) AS inactive,
            (SELECT count(*)::int FROM "user") AS users,
            (SELECT count(*)::int FROM "user" WHERE "createdAt" > now() - interval '7 days') AS new_users,
            (SELECT count(*)::int FROM booking WHERE status IN ('confirmed','completed')) AS bookings,
            (SELECT coalesce(sum(platform_fee_cents),0)::int FROM booking WHERE status IN ('confirmed','completed') AND date_trunc('month',created_at)=date_trunc('month',now())) AS fees_month,
            (SELECT count(*)::int FROM venue WHERE plan='trial' AND trial_ends_at BETWEEN now() AND now() + interval '7 days') AS trials_ending`,
  ))!;
  return (
    <>
      <div className="stat-row">
        <Link href="/admin?tab=venues&status=pending" className="stat"><b>{s.pending}</b><span>Venues awaiting review</span></Link>
        <div className="stat"><b>{s.active}</b><span>Live venues</span></div>
        <div className="stat"><b>{s.trials_ending}</b><span>Trials ending in 7 days</span></div>
        <div className="stat"><b>{s.users}</b><span>Accounts ({s.new_users} new this week)</span></div>
        <div className="stat"><b>{s.bookings}</b><span>Confirmed bookings</span></div>
        <div className="stat"><b>{peso(s.fees_month)}</b><span>Booking fees this month</span></div>
      </div>
      {!emailConfigured() && (
        <div className="alert alert-warn">Email isn&apos;t configured yet, so confirmation and reset emails are only logged and sign-ups aren&apos;t required to confirm their email. Add a Resend API key to turn on real emails.</div>
      )}
    </>
  );
}

async function Venues({ filter }: { filter?: string }) {
  const status = ["pending", "active", "suspended", "rejected"].includes(filter ?? "") ? filter : null;
  const venues = await q<{ id: string; name: string; area: string; status: string; status_reason: string | null; plan: string; business_name: string; business_reg_no: string; phone: string; created_at: string; owner: string | null; owner_email: string | null; courts: number }>(
    `SELECT v.id, v.name, v.area, v.status, v.status_reason, v.plan, v.business_name, v.business_reg_no, v.phone, v.created_at,
            u.name AS owner, u.email AS owner_email,
            (SELECT count(*)::int FROM resource r WHERE r.venue_id=v.id) AS courts
       FROM venue v
       LEFT JOIN venue_member m ON m.venue_id=v.id AND m.role='owner'
       LEFT JOIN "user" u ON u.id=m.user_id
      WHERE ($1::text IS NULL OR v.status=$1)
      ORDER BY CASE v.status WHEN 'pending' THEN 0 ELSE 1 END, v.created_at DESC LIMIT 200`,
    [status],
  );
  return (
    <section className="app-card">
      <div className="inline-form">
        <h2 style={{ marginRight: "auto" }}>Venues</h2>
        {["all", "pending", "active", "suspended", "rejected"].map((f) => (
          <Link key={f} className={`btn btn-xs ${(status ?? "all") === f ? "" : "btn-outline"}`} href={f === "all" ? "/admin?tab=venues" : `/admin?tab=venues&status=${f}`}>{f}</Link>
        ))}
      </div>
      {venues.length === 0 ? <p className="hint">No venues here.</p> : (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th scope="col">Venue</th><th scope="col">Business</th><th scope="col">Owner</th><th scope="col">Status</th><th scope="col">Action</th></tr></thead>
            <tbody>
              {venues.map((v) => (
                <tr key={v.id}>
                  <td><Link href={`/venue/${v.id}`}><strong>{v.name}</strong></Link><br /><span className="hint">{v.area} · {v.courts} courts · {when(v.created_at)}</span></td>
                  <td>{v.business_name}<br /><span className="hint">Reg. {v.business_reg_no} · {v.phone}</span></td>
                  <td>{v.owner ?? "—"}<br /><span className="hint">{v.owner_email}</span></td>
                  <td><VenueStatus status={v.status} />{v.status_reason && <><br /><span className="hint">{v.status_reason}</span></>}</td>
                  <td>
                    <div className="app-stack" style={{ gap: 8 }}>
                      {(v.status === "pending" || v.status === "rejected" || v.status === "suspended") && (
                        <form action={setVenueStatus}>
                          <input type="hidden" name="id" value={v.id} />
                          <input type="hidden" name="action" value={v.status === "suspended" ? "reactivate" : "approve"} />
                          <button className="btn btn-xs" type="submit">{v.status === "suspended" ? "Reactivate" : "Approve"}</button>
                        </form>
                      )}
                      {(v.status === "pending" || v.status === "active") && (
                        <form action={setVenueStatus} className="inline-form">
                          <input type="hidden" name="id" value={v.id} />
                          <input type="hidden" name="action" value={v.status === "pending" ? "reject" : "suspend"} />
                          <input className="input" name="reason" placeholder="Reason shown to the owner" aria-label={`Reason for ${v.name}`} required minLength={5} />
                          <button className={`btn btn-xs ${v.status === "pending" ? "btn-outline" : "btn-danger"}`} type="submit">{v.status === "pending" ? "Reject" : "Suspend"}</button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

async function Users({ meId, search }: { meId: string; search?: string }) {
  const term = (search ?? "").trim().slice(0, 80);
  const users = await q<{ id: string; name: string; email: string; emailVerified: boolean; role: string | null; banned: boolean | null; createdAt: string; venues: number }>(
    `SELECT u.id, u.name, u.email, u."emailVerified", u.role, u.banned, u."createdAt",
            (SELECT count(*)::int FROM venue_member m WHERE m.user_id=u.id) AS venues
       FROM "user" u WHERE ($1 = '' OR u.email ILIKE '%' || $1 || '%' OR u.name ILIKE '%' || $1 || '%')
      ORDER BY u."createdAt" DESC LIMIT 200`,
    [term],
  );
  return (
    <section className="app-card">
      <form className="inline-form" action="/admin">
        <h2 style={{ marginRight: "auto" }}>Accounts</h2>
        <input type="hidden" name="tab" value="users" />
        <input className="input" name="q" defaultValue={term} placeholder="Search name or email" aria-label="Search accounts" />
        <button className="btn btn-xs" type="submit">Search</button>
      </form>
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Joined</th><th scope="col">Venues</th><th scope="col">Role</th><th scope="col">Access</th></tr></thead>
          <tbody>
            {users.map((u) => {
              const isAdmin = (u.role ?? "").includes("admin");
              return (
                <tr key={u.id}>
                  <td>{u.name}{u.id === meId && <span className="hint"> (you)</span>}</td>
                  <td>{u.email} {u.emailVerified ? null : <span className="badge badge-warn">unconfirmed</span>}</td>
                  <td>{when(u.createdAt)}</td>
                  <td>{u.venues}</td>
                  <td>
                    <form action={setUserRole}>
                      <input type="hidden" name="id" value={u.id} />
                      <input type="hidden" name="role" value={isAdmin ? "user" : "admin"} />
                      {isAdmin ? <span className="badge badge-lime">admin</span> : <span className="badge badge-muted">user</span>}{" "}
                      {u.id !== meId && <button className="btn btn-xs btn-outline" type="submit">{isAdmin ? "Remove admin" : "Make admin"}</button>}
                    </form>
                  </td>
                  <td>
                    {u.id !== meId && (
                      <form action={setUserBan}>
                        <input type="hidden" name="id" value={u.id} />
                        <input type="hidden" name="ban" value={u.banned ? "0" : "1"} />
                        <button className={`btn btn-xs ${u.banned ? "" : "btn-danger"}`} type="submit">{u.banned ? "Unban" : "Ban"}</button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

async function Audit() {
  const rows = await q<{ id: string; action: string; target_type: string; target_id: string | null; meta: Record<string, unknown>; created_at: string; actor: string | null }>(
    `SELECT a.id, a.action, a.target_type, a.target_id, a.meta, a.created_at, u.email AS actor FROM audit_log a LEFT JOIN "user" u ON u.id=a.actor_id ORDER BY a.created_at DESC LIMIT 200`,
  );
  return (
    <section className="app-card">
      <h2>Audit log</h2>
      {rows.length === 0 ? <p className="hint">Nothing yet.</p> : (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th scope="col">When</th><th scope="col">Who</th><th scope="col">Action</th><th scope="col">Target</th><th scope="col">Details</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{when(r.created_at)}</td><td>{r.actor ?? "system"}</td><td><code>{r.action}</code></td>
                  <td>{r.target_type}{r.target_id ? ` · ${r.target_id.slice(0, 8)}` : ""}</td>
                  <td className="hint">{Object.keys(r.meta).length ? JSON.stringify(r.meta) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

async function Settings() {
  const rows = await q<{ key: string; value: unknown }>("SELECT key, value FROM platform_setting");
  const get = (k: string) => rows.find((r) => r.key === k)?.value;
  const fee = (get("booking_fee") as { percent: number; min_cents: number; max_cents: number }) ?? { percent: 3, min_cents: 1000, max_cents: 5000 };
  const trial = Number(get("trial_days") ?? 30);
  return (
    <form action={saveSettings} className="app-card form-grid" style={{ maxWidth: 720 }}>
      <h2>Platform settings</h2>
      <fieldset className="form-section">
        <legend><h3>Per-booking platform fee</h3></legend>
        <p className="hint">Players pay venues directly. This fee is recorded on each confirmed booking and billed to the venue monthly with its subscription.</p>
        <div className="field-row">
          <div className="field"><label htmlFor="fee_percent">Percent of booking</label><input id="fee_percent" name="fee_percent" className="input" inputMode="decimal" defaultValue={fee.percent} /></div>
          <div className="field"><label htmlFor="fee_min">Minimum (₱)</label><input id="fee_min" name="fee_min" className="input" inputMode="decimal" defaultValue={fee.min_cents / 100} /></div>
        </div>
        <div className="field"><label htmlFor="fee_max">Maximum (₱)</label><input id="fee_max" name="fee_max" className="input" inputMode="decimal" defaultValue={fee.max_cents / 100} /></div>
      </fieldset>
      <fieldset className="form-section">
        <legend><h3>Venue trial</h3></legend>
        <div className="field"><label htmlFor="trial_days">Free trial length (days), starts on approval</label><input id="trial_days" name="trial_days" type="number" min={0} max={180} className="input" defaultValue={trial} /></div>
      </fieldset>
      <fieldset className="form-section">
        <legend><h3>Integrations</h3></legend>
        <dl className="kv">
          <dt>Email (Resend)</dt><dd>{emailConfigured() ? <span className="badge badge-ok">Connected</span> : <span className="badge badge-warn">Not configured</span>}</dd>
          <dt>Subscription billing (PayMongo)</dt><dd><span className="badge badge-muted">Not connected yet</span></dd>
        </dl>
      </fieldset>
      <button className="btn" type="submit">Save settings</button>
    </form>
  );
}
