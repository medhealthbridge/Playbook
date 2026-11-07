import Link from "next/link";
import type { Metadata } from "next";
import { Flash, PortalHeader, VenueStatus, peso, when } from "@/components/portal/Portal";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { q, q1 } from "@/lib/server/db";
import { emailConfigured } from "@/lib/server/email";
import { requireAdmin } from "@/lib/server/session";
import { connectPlatformPaymongo, runInvoices, saveBilling, saveSettings, setInvoiceStatus, setUserBan, setUserRole, setVenueStatus } from "./actions";
import { PLAN_IDS, billingSettings, planPrices, platformPaymongo } from "@/lib/server/billing";
import { addDays, manilaToday } from "@/lib/booking/time";

export const metadata: Metadata = { title: "Platform admin — Playbook", robots: { index: false } };
export const dynamic = "force-dynamic";

const TABS = ["overview", "venues", "billing", "users", "audit", "settings"] as const;

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
          {tab === "billing" && <Billing month={sp.month} status={sp.status} />}
          {tab === "users" && <Users meId={admin.id} search={sp.q} />}
          {tab === "audit" && <Audit />}
          {tab === "settings" && <><Settings /><BillingSettings /></>}
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
            (SELECT count(*)::int FROM venue WHERE plan='trial' AND trial_ends_at BETWEEN now() AND now() + interval '7 days') AS trials_ending,
            (SELECT count(*)::int FROM venue WHERE status='active' AND plan='trial' AND trial_ends_at < now()) AS trials_over,
            (SELECT coalesce(sum(total_cents),0)::int FROM invoice WHERE status='open') AS open_cents,
            (SELECT count(*)::int FROM invoice WHERE status='open' AND due_date < (now() AT TIME ZONE 'Asia/Manila')::date) AS overdue`,
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
        <Link href="/admin?tab=billing&status=open" className="stat"><b>{peso(s.open_cents)}</b><span>Unpaid invoices ({s.overdue} overdue)</span></Link>
        <div className="stat"><b>{s.trials_over}</b><span>Trials ended without a plan</span></div>
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
          <dt>Invoice payments (PayMongo)</dt><dd>See &quot;Your PayMongo account&quot; below</dd>
        </dl>
      </fieldset>
      <button className="btn" type="submit">Save settings</button>
    </form>
  );
}

async function Billing({ month, status }: { month?: string; status?: string }) {
  const today = manilaToday();
  const lastMonth = addDays(`${today.slice(0, 7)}-01`, -1).slice(0, 7);
  const m = /^\d{4}-\d{2}$/.test(month ?? "") ? month! : lastMonth;
  const st = ["open", "paid", "void"].includes(status ?? "") ? status! : null;
  const [prices, invoices, mrr] = await Promise.all([
    planPrices(),
    q<{ id: string; number: string; venue: string; venue_id: string; period_start: string; subscription_cents: number; booking_count: number; booking_fee_cents: number; total_cents: number; status: string; due_date: string; paid_via: string | null; note: string | null }>(
      `SELECT i.id, i.number, v.name AS venue, v.id AS venue_id, to_char(i.period_start,'Mon YYYY') AS period_start, i.subscription_cents, i.booking_count, i.booking_fee_cents, i.total_cents, i.status, to_char(i.due_date,'Mon DD') AS due_date, i.paid_via, i.note
         FROM invoice i JOIN venue v ON v.id=i.venue_id WHERE ($1::text IS NULL OR i.status=$1) ORDER BY i.period_start DESC, v.name LIMIT 300`,
      [st],
    ),
    q1<{ plans: Record<string, number> | null }>("SELECT json_object_agg(plan, n) AS plans FROM (SELECT plan, count(*)::int AS n FROM venue WHERE status='active' GROUP BY plan) t"),
  ]);
  const counts = mrr?.plans ?? {};
  const monthly = PLAN_IDS.reduce((s, p) => s + (counts[p] ?? 0) * prices[p], 0);
  return (
    <>
      <div className="stat-row">
        <div className="stat"><b>{peso(monthly)}</b><span>Monthly subscriptions (live venues on paid plans)</span></div>
        {(["trial", ...PLAN_IDS] as string[]).map((p) => <div key={p} className="stat"><b>{counts[p] ?? 0}</b><span>{p === "trial" ? "On free trial" : `${p[0].toUpperCase()}${p.slice(1)} · ${peso(prices[p as keyof typeof prices])}/mo`}</span></div>)}
      </div>
      <form action={runInvoices} className="app-card inline-form">
        <h2 style={{ marginRight: "auto" }}>Create invoices</h2>
        <label className="hint" htmlFor="month">Month</label>
        <input id="month" name="month" type="month" className="input" defaultValue={m} max={today.slice(0, 7)} />
        <button className="btn btn-sm" type="submit">Create invoices</button>
        <p className="hint" style={{ flexBasis: "100%" }}>This runs automatically on the 1st of every month for the previous month (owners are emailed). Use the button to run it now. Bills each live venue for that month: its plan price (none while on trial) plus Playbook booking fees. Venues with nothing to bill are skipped; running it again never duplicates.</p>
      </form>
      <section className="app-card">
        <div className="inline-form">
          <h2 style={{ marginRight: "auto" }}>Invoices</h2>
          {["all", "open", "paid", "void"].map((f) => (
            <Link key={f} className={`btn btn-xs ${(st ?? "all") === f ? "" : "btn-outline"}`} href={f === "all" ? "/admin?tab=billing" : `/admin?tab=billing&status=${f}`}>{f}</Link>
          ))}
        </div>
        {invoices.length === 0 ? <p className="hint">No invoices yet.</p> : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th scope="col">Invoice</th><th scope="col">Venue</th><th scope="col">Plan</th><th scope="col">Booking fees</th><th scope="col">Total</th><th scope="col">Status</th><th scope="col">Action</th></tr></thead>
              <tbody>
                {invoices.map((i) => (
                  <tr key={i.id}>
                    <td><Link href={`/venue/${i.venue_id}/invoice/${i.id}`}>{i.number}</Link><br /><span className="hint">{i.period_start} · due {i.due_date}</span></td>
                    <td>{i.venue}</td>
                    <td>{peso(i.subscription_cents)}</td>
                    <td>{peso(i.booking_fee_cents)}<br /><span className="hint">{i.booking_count} bookings</span></td>
                    <td><strong>{peso(i.total_cents)}</strong></td>
                    <td><span className={`badge ${i.status === "paid" ? "badge-ok" : i.status === "open" ? "badge-warn" : "badge-muted"}`}>{i.status}</span>{i.paid_via && <><br /><span className="hint">{i.paid_via}</span></>}</td>
                    <td>
                      {i.status === "open" && (
                        <form action={setInvoiceStatus} className="inline-form">
                          <input type="hidden" name="id" value={i.id} />
                          <input type="hidden" name="action" value="paid" />
                          <input className="input" name="note" placeholder="Note (e.g. GCash ref)" aria-label="Note" />
                          <button className="btn btn-xs" type="submit">Mark paid</button>
                        </form>
                      )}
                      {i.status === "open" && (
                        <form action={setInvoiceStatus}>
                          <input type="hidden" name="id" value={i.id} />
                          <input type="hidden" name="action" value="void" />
                          <button className="btn btn-xs btn-outline" type="submit">Void</button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

async function BillingSettings() {
  const [prices, billing, pm] = await Promise.all([planPrices(), billingSettings(), platformPaymongo()]);
  return (
    <>
      <form action={saveBilling} className="app-card form-grid" style={{ maxWidth: 720 }}>
        <h2>Venue plans and invoices</h2>
        <p className="hint">Monthly price per plan in pesos. Venues pay nothing during their free trial. Price changes apply to the next invoices you create.</p>
        <div className="field-row">
          {PLAN_IDS.map((p) => (
            <div key={p} className="field"><label htmlFor={`price_${p}`}>{p[0].toUpperCase() + p.slice(1)} (₱/month)</label><input id={`price_${p}`} name={`price_${p}`} className="input" inputMode="decimal" defaultValue={prices[p] / 100} /></div>
          ))}
        </div>
        {PLAN_IDS.some((p) => prices[p] === 0) && <div className="alert alert-warn">Some plans are priced at ₱0. Set prices before venues&apos; trials end.</div>}
        <div className="field"><label htmlFor="due_days">Payment terms (days after month end)</label><input id="due_days" name="due_days" type="number" min={0} max={60} className="input" defaultValue={billing.due_days} /></div>
        <div className="field"><label htmlFor="manual_instructions">How venues can pay manually (shown on invoices)</label><textarea id="manual_instructions" name="manual_instructions" className="input textarea" defaultValue={billing.manual_instructions} placeholder="e.g. GCash 0917 000 0000 (Playbook Inc.) or BDO account …, then reply with the reference number." /></div>
        <button className="btn" type="submit">Save billing settings</button>
      </form>
      <form action={connectPlatformPaymongo} className="app-card form-grid" style={{ maxWidth: 720 }}>
        <h2>Your PayMongo account (for invoice payments)</h2>
        {pm ? <div className="alert alert-ok">Connected in <strong>{pm.livemode ? "live" : "test"}</strong> mode since {when(pm.connected_at)}.</div> : <p className="hint">Connect Playbook&apos;s own PayMongo account so venues can pay invoices by GCash, Maya or card. Until then, venues see your manual payment instructions.</p>}
        <div className="field"><label htmlFor="ppk">Public key</label><input id="ppk" name="public_key" className="input" placeholder="pk_live_…" autoComplete="off" required /></div>
        <div className="field"><label htmlFor="psk">Secret key</label><input id="psk" name="secret_key" type="password" className="input" placeholder="sk_live_…" autoComplete="off" required /></div>
        <button className="btn btn-sm" type="submit">{pm ? "Replace keys" : "Connect PayMongo"}</button>
      </form>
    </>
  );
}
