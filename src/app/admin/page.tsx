import Link from "next/link";
import type { Metadata } from "next";
import { Flash, PortalHeader, VenueStatus, peso, when } from "@/components/portal/Portal";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { q, q1 } from "@/lib/server/db";
import { emailConfigured } from "@/lib/server/email";
import { requireAdmin } from "@/lib/server/session";
import { connectPlatformPaymongo, runInvoices, saveBilling, saveSettings, setInvoiceStatus, setUserBan, setUserRole, setVenueStatus } from "./actions";
import { billingSettings, cutSettings, platformPaymongo } from "@/lib/server/billing";
import { addDays, manilaToday } from "@/lib/booking/time";
import { weekRange, type CutRule } from "@/lib/booking/engine";

export const metadata: Metadata = { title: "Platform admin — Playbook", robots: { index: false } };
export const dynamic = "force-dynamic";

const TABS = ["overview", "venues", "transactions", "billing", "users", "audit", "settings"] as const;

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
          {tab === "transactions" && <Transactions show={sp.show} />}
          {tab === "billing" && <Billing status={sp.status} />}
          {tab === "users" && <Users meId={admin.id} search={sp.q} />}
          {tab === "audit" && <Audit />}
          {tab === "settings" && <><Settings /><BillingSettings /></>}
        </div>
      </div>
    </main>
  );
}

async function Overview() {
  const wk = weekRange(manilaToday());
  const s = (await q1<Record<string, number>>(
    `SELECT (SELECT count(*)::int FROM venue WHERE status='pending') AS pending,
            (SELECT count(*)::int FROM venue WHERE status='active') AS active,
            (SELECT count(*)::int FROM "user") AS users,
            (SELECT count(*)::int FROM "user" WHERE "createdAt" > now() - interval '7 days') AS new_users,
            (SELECT coalesce(sum(platform_fee_cents),0)::int FROM booking WHERE status IN ('confirmed','completed','no_show') AND date BETWEEN $1 AND $2) AS court_cut,
            (SELECT coalesce(sum(platform_fee_cents),0)::int FROM open_play_player WHERE (checked_in_at AT TIME ZONE 'Asia/Manila')::date BETWEEN $1 AND $2) AS play_cut,
            (SELECT count(*)::int FROM open_play_player WHERE platform_fee_cents > 0 AND (checked_in_at AT TIME ZONE 'Asia/Manila')::date BETWEEN $1 AND $2) AS players,
            (SELECT count(*)::int FROM open_play_player WHERE voided_at > now() - interval '7 days') AS voids,
            (SELECT coalesce(sum(total_cents),0)::int FROM invoice WHERE status='open') AS open_cents,
            (SELECT count(DISTINCT venue_id)::int FROM invoice WHERE status='open' AND due_date < (now() AT TIME ZONE 'Asia/Manila')::date) AS overdue_venues`,
    [wk.start, wk.end],
  ))!;
  return (
    <>
      <div className="stat-row">
        <Link href="/admin?tab=venues&status=pending" className="stat"><b>{s.pending}</b><span>Venues awaiting review</span></Link>
        <div className="stat"><b>{s.active}</b><span>Live venues</span></div>
        <div className="stat"><b>{s.users}</b><span>Accounts ({s.new_users} new this week)</span></div>
        <Link href="/admin?tab=transactions" className="stat"><b>{peso(s.court_cut + s.play_cut)}</b><span>Your cut this week so far ({s.players} open-play players)</span></Link>
        <Link href="/admin?tab=billing&status=open" className="stat"><b>{peso(s.open_cents)}</b><span>Owed to you on unpaid statements</span></Link>
        <Link href="/admin?tab=billing&status=open" className="stat"><b>{s.overdue_venues}</b><span>Venues overdue</span></Link>
        <Link href="/admin?tab=transactions&show=voids" className="stat"><b>{s.voids}</b><span>Voided check-ins, last 7 days</span></Link>
      </div>
      {!emailConfigured() && (
        <div className="alert alert-warn">Email isn&apos;t configured yet, so confirmation and reset emails are only logged and sign-ups aren&apos;t required to confirm their email. Add a Resend API key to turn on real emails.</div>
      )}
    </>
  );
}

type Txn = { at: string; venue: string; kind: string; who: string; amount: number; method: string | null; cut: number; status: string; note: string | null };

/** Every payment players made to venues, with Playbook's cut on each. Read-only. */
async function Transactions({ show }: { show?: string }) {
  const voids = show === "voids";
  const rows = await q<Txn>(
    `SELECT * FROM (
       SELECT coalesce(b.confirmed_at, b.created_at) AS ts, to_char(coalesce(b.confirmed_at, b.created_at) AT TIME ZONE 'Asia/Manila','Mon DD, HH12:MI AM') AS at, v.name AS venue,
              'Court booking' AS kind, b.customer_name || ' · ' || b.ref AS who, b.price_cents AS amount, b.pay_method AS method, b.platform_fee_cents AS cut, b.status, b.cancel_reason AS note
         FROM booking b JOIN venue v ON v.id=b.venue_id WHERE b.status <> 'held' AND NOT $1
       UNION ALL
       SELECT coalesce(p.voided_at, p.checked_in_at, p.paid_at) AS ts, to_char(coalesce(p.voided_at, p.checked_in_at, p.paid_at) AT TIME ZONE 'Asia/Manila','Mon DD, HH12:MI AM') AS at, v.name AS venue,
              'Open play' AS kind, p.name || ' · ' || s.title AS who, p.paid_cents AS amount, p.pay_method AS method, p.platform_fee_cents AS cut,
              CASE WHEN p.voided_at IS NOT NULL THEN 'voided' WHEN p.checked_in_at IS NOT NULL THEN 'checked in' ELSE 'paid, not checked in' END AS status, p.void_reason AS note
         FROM open_play_player p JOIN open_play_session s ON s.id=p.session_id JOIN venue v ON v.id=s.venue_id
        WHERE (p.checked_in_at IS NOT NULL OR p.paid_at IS NOT NULL OR p.voided_at IS NOT NULL) AND (NOT $1 OR p.voided_at IS NOT NULL)
     ) t ORDER BY ts DESC NULLS LAST LIMIT 300`,
    [voids],
  );
  const perVenue = await q<{ id: string; name: string; week_cut: number; open_cents: number; overdue: boolean; voids: number; walkins: number; checkins: number }>(
    `SELECT v.id, v.name,
            (SELECT coalesce(sum(platform_fee_cents),0)::int FROM booking b WHERE b.venue_id=v.id AND b.status IN ('confirmed','completed','no_show') AND b.date >= date_trunc('week', (now() AT TIME ZONE 'Asia/Manila'))::date)
          + (SELECT coalesce(sum(p.platform_fee_cents),0)::int FROM open_play_player p JOIN open_play_session s ON s.id=p.session_id WHERE s.venue_id=v.id AND p.checked_in_at >= date_trunc('week', (now() AT TIME ZONE 'Asia/Manila')) AT TIME ZONE 'Asia/Manila') AS week_cut,
            (SELECT coalesce(sum(total_cents),0)::int FROM invoice i WHERE i.venue_id=v.id AND i.status='open') AS open_cents,
            EXISTS (SELECT 1 FROM invoice i WHERE i.venue_id=v.id AND i.status='open' AND i.due_date < (now() AT TIME ZONE 'Asia/Manila')::date) AS overdue,
            (SELECT count(*)::int FROM open_play_player p JOIN open_play_session s ON s.id=p.session_id WHERE s.venue_id=v.id AND p.voided_at > now() - interval '30 days') AS voids,
            (SELECT count(*)::int FROM open_play_player p JOIN open_play_session s ON s.id=p.session_id WHERE s.venue_id=v.id AND p.user_id IS NULL AND p.checked_in_at > now() - interval '30 days') AS walkins,
            (SELECT count(*)::int FROM open_play_player p JOIN open_play_session s ON s.id=p.session_id WHERE s.venue_id=v.id AND p.checked_in_at > now() - interval '30 days') AS checkins
       FROM venue v WHERE v.status IN ('active','suspended') ORDER BY v.name LIMIT 200`,
  );
  return (
    <>
      <section className="app-card">
        <h2>What each venue owes you</h2>
        <p className="hint">Players pay venues directly. Your cut is counted when a player is checked in or a court is confirmed, whether they paid by cash or online, and billed on the weekly statement.</p>
        {perVenue.length === 0 ? <p className="hint">No live venues yet.</p> : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th scope="col">Venue</th><th scope="col">Cut this week (not yet billed)</th><th scope="col">Unpaid statements</th><th scope="col">Last 30 days</th></tr></thead>
              <tbody>
                {perVenue.map((v) => (
                  <tr key={v.id}>
                    <td><Link href={`/venue/${v.id}`}><strong>{v.name}</strong></Link></td>
                    <td>{peso(v.week_cut)}</td>
                    <td><strong>{peso(v.open_cents)}</strong> {v.overdue && <span className="badge badge-bad">Overdue · paused</span>}</td>
                    <td>{v.checkins} check-ins · {v.walkins} walk-ins · {v.voids} voids {v.checkins >= 10 && v.voids / v.checkins > 0.1 && <span className="badge badge-warn">Many voids</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="app-card">
        <div className="inline-form">
          <h2 style={{ marginRight: "auto" }}>{voids ? "Voided check-ins" : "Transactions"}</h2>
          <Link className={`btn btn-xs ${voids ? "btn-outline" : ""}`} href="/admin?tab=transactions">All</Link>
          <Link className={`btn btn-xs ${voids ? "" : "btn-outline"}`} href="/admin?tab=transactions&show=voids">Voids only</Link>
        </div>
        {rows.length === 0 ? <p className="hint">Nothing yet.</p> : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th scope="col">When</th><th scope="col">Venue</th><th scope="col">Type</th><th scope="col">Player</th><th scope="col">Paid to venue</th><th scope="col">How</th><th scope="col">Your cut</th><th scope="col">Status</th></tr></thead>
              <tbody>
                {rows.map((t, i) => (
                  <tr key={i}>
                    <td>{t.at}</td><td>{t.venue}</td><td>{t.kind}</td><td>{t.who}</td><td>{peso(t.amount)}</td>
                    <td>{t.method === "online" ? "Online" : t.method === "cash" ? "Cash" : t.method === "at_venue" ? "At venue" : "—"}</td>
                    <td><strong>{peso(t.cut)}</strong></td>
                    <td><span className={`badge ${t.status === "voided" || t.status === "cancelled" ? "badge-bad" : "badge-ok"}`}>{t.status}</span>{t.note && <><br /><span className="hint">{t.note}</span></>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="hint">Showing the latest 300.</p>
      </section>
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

function RuleFields({ k, label, rule, hint }: { k: string; label: string; rule: CutRule; hint: string }) {
  return (
    <fieldset className="form-section">
      <legend><h3>{label}</h3></legend>
      <p className="hint">{hint}</p>
      <div className="field-row">
        <div className="field"><label htmlFor={`${k}_mode`}>How it is worked out</label>
          <select id={`${k}_mode`} name={`${k}_mode`} className="select" defaultValue={rule.mode}>
            <option value="fixed">Fixed amount in pesos</option>
            <option value="percent">Percent of the price</option>
          </select>
        </div>
        <div className="field"><label htmlFor={`${k}_value`}>Amount (₱) or percent (%)</label><input id={`${k}_value`} name={`${k}_value`} className="input" inputMode="decimal" defaultValue={rule.mode === "fixed" ? rule.value / 100 : rule.value} /></div>
      </div>
      <div className="field"><label htmlFor={`${k}_min`}>Minimum cut in pesos (percent only, 0 for none)</label><input id={`${k}_min`} name={`${k}_min`} className="input" inputMode="decimal" defaultValue={(rule.min_cents ?? 0) / 100} /></div>
    </fieldset>
  );
}

async function Settings() {
  const cut = await cutSettings();
  return (
    <form action={saveSettings} className="app-card form-grid" style={{ maxWidth: 720 }}>
      <h2>Your cut</h2>
      <p className="hint">Listing is free for venues. You earn a cut on each open-play player and each court booking. Players pay the venue; the venue pays you on the weekly statement. Rentals carry no cut. Changes apply from the next check-in or booking.</p>
      <RuleFields k="op" label="Open play, per player" rule={cut.open_play} hint="Counted when a player is checked in. Example: fee ₱150, fixed ₱30 → venue keeps ₱120." />
      <RuleFields k="court" label="Court bookings, per booking" rule={cut.court} hint="Counted when a booking is confirmed, on the court price only." />
      <label className="check"><input type="checkbox" name="staff_bookings" value="1" defaultChecked={cut.staff_bookings} /> <span>Also take the cut on walk-in, phone and recurring bookings the venue adds itself</span></label>
      <fieldset className="form-section">
        <legend><h3>Integrations</h3></legend>
        <dl className="kv">
          <dt>Email (Resend)</dt><dd>{emailConfigured() ? <span className="badge badge-ok">Connected</span> : <span className="badge badge-warn">Not configured</span>}</dd>
          <dt>Statement payments (PayMongo)</dt><dd>See &quot;Your PayMongo account&quot; below</dd>
        </dl>
      </fieldset>
      <button className="btn" type="submit">Save cut</button>
    </form>
  );
}

async function Billing({ status }: { status?: string }) {
  const today = manilaToday();
  const lastWeek = addDays(weekRange(today).start, -1);
  const st = ["open", "paid", "void"].includes(status ?? "") ? status! : null;
  const invoices = await q<{ id: string; number: string; venue: string; venue_id: string; period: string; booking_count: number; booking_fee_cents: number; open_play_count: number; open_play_fee_cents: number; total_cents: number; status: string; due_date: string; overdue: boolean; paid_via: string | null; note: string | null }>(
    `SELECT i.id, i.number, v.name AS venue, v.id AS venue_id, to_char(i.period_start,'Mon DD') || ' – ' || to_char(i.period_end,'Mon DD') AS period, i.booking_count, i.booking_fee_cents, i.open_play_count, i.open_play_fee_cents,
            i.total_cents, i.status, to_char(i.due_date,'Mon DD') AS due_date, (i.status='open' AND i.due_date < (now() AT TIME ZONE 'Asia/Manila')::date) AS overdue, i.paid_via, i.note
       FROM invoice i JOIN venue v ON v.id=i.venue_id WHERE ($1::text IS NULL OR i.status=$1) ORDER BY i.period_start DESC, v.name LIMIT 300`,
    [st],
  );
  return (
    <>
      <form action={runInvoices} className="app-card inline-form">
        <h2 style={{ marginRight: "auto" }}>Create weekly statements</h2>
        <label className="hint" htmlFor="date">Any day in the week</label>
        <input id="date" name="date" type="date" className="input" defaultValue={lastWeek} max={today} />
        <button className="btn btn-sm" type="submit">Create statements</button>
        <p className="hint" style={{ flexBasis: "100%" }}>This runs automatically every Monday for the week before (Monday to Sunday), and owners are emailed. Each statement adds up your cut on that week&apos;s court bookings and open-play check-ins. Venues that owe nothing are skipped; running it again never duplicates.</p>
      </form>
      <section className="app-card">
        <div className="inline-form">
          <h2 style={{ marginRight: "auto" }}>Statements</h2>
          {["all", "open", "paid", "void"].map((f) => (
            <Link key={f} className={`btn btn-xs ${(st ?? "all") === f ? "" : "btn-outline"}`} href={f === "all" ? "/admin?tab=billing" : `/admin?tab=billing&status=${f}`}>{f}</Link>
          ))}
        </div>
        {invoices.length === 0 ? <p className="hint">No statements yet.</p> : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th scope="col">Statement</th><th scope="col">Venue</th><th scope="col">Open play</th><th scope="col">Court bookings</th><th scope="col">Owed to you</th><th scope="col">Status</th><th scope="col">Action</th></tr></thead>
              <tbody>
                {invoices.map((i) => (
                  <tr key={i.id}>
                    <td><Link href={`/venue/${i.venue_id}/invoice/${i.id}`}>{i.number}</Link><br /><span className="hint">{i.period} · due {i.due_date}</span></td>
                    <td>{i.venue}</td>
                    <td>{peso(i.open_play_fee_cents)}<br /><span className="hint">{i.open_play_count} players</span></td>
                    <td>{peso(i.booking_fee_cents)}<br /><span className="hint">{i.booking_count} bookings</span></td>
                    <td><strong>{peso(i.total_cents)}</strong></td>
                    <td><span className={`badge ${i.status === "paid" ? "badge-ok" : i.overdue ? "badge-bad" : i.status === "open" ? "badge-warn" : "badge-muted"}`}>{i.overdue ? "overdue" : i.status}</span>{i.paid_via && <><br /><span className="hint">{i.paid_via}</span></>}</td>
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
  const [billing, pm] = await Promise.all([billingSettings(), platformPaymongo()]);
  return (
    <>
      <form action={saveBilling} className="app-card form-grid" style={{ maxWidth: 720 }}>
        <h2>Weekly statements</h2>
        <p className="hint">Each Monday every venue gets a statement of your cut for the week before.</p>
        <div className="field"><label htmlFor="due_days">Days a venue has to pay after the statement</label><input id="due_days" name="due_days" type="number" min={0} max={60} className="input" defaultValue={billing.due_days} /></div>
        <label className="check"><input type="checkbox" name="auto_pause" value="1" defaultChecked={billing.auto_pause} /> <span>Pause a venue automatically when a statement is past due (no new bookings or check-ins until it is paid)</span></label>
        <div className="field"><label htmlFor="manual_instructions">How venues pay you (shown on statements)</label><textarea id="manual_instructions" name="manual_instructions" className="input textarea" defaultValue={billing.manual_instructions} placeholder="e.g. GCash 0917 000 0000 (Playbook) or BDO account …, then send the reference number." /></div>
        {!billing.manual_instructions && !pm && <div className="alert alert-warn">Venues have no way to pay you yet. Add payment instructions here or connect PayMongo below.</div>}
        <button className="btn" type="submit">Save statement settings</button>
      </form>
      <form action={connectPlatformPaymongo} className="app-card form-grid" style={{ maxWidth: 720 }}>
        <h2>Your PayMongo account (for statement payments)</h2>
        {pm ? <div className="alert alert-ok">Connected in <strong>{pm.livemode ? "live" : "test"}</strong> mode since {when(pm.connected_at)}.</div> : <p className="hint">Connect Playbook&apos;s own PayMongo account so venues can pay statements by GCash, Maya or card. Until then, venues see your manual payment instructions.</p>}
        <div className="field"><label htmlFor="ppk">Public key</label><input id="ppk" name="public_key" className="input" placeholder="pk_live_…" autoComplete="off" required /></div>
        <div className="field"><label htmlFor="psk">Secret key</label><input id="psk" name="secret_key" type="password" className="input" placeholder="sk_live_…" autoComplete="off" required /></div>
        <button className="btn btn-sm" type="submit">{pm ? "Replace keys" : "Connect PayMongo"}</button>
      </form>
    </>
  );
}
