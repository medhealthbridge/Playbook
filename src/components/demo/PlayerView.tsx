"use client";
import { useMemo, useState } from "react";
import { PLAYER_PLANS, PRICE_TBA, playerPlanById } from "@/content/plans";
import { sportById } from "@/content/sports";
import { EVENTS, resourceById, venueById } from "@/content/venues";
import { cancellationRefund, displayStatus, isPast, videoAccess } from "@/lib/booking/rules";
import { addDays, formatDate, formatPHP, formatRange, manilaToday } from "@/lib/booking/time";
import type { Booking } from "@/lib/booking/types";
import { useDemo } from "@/lib/demo/DemoProvider";
import {
  DEMO_PLAYER_ID,
  DemoError,
  acceptInvite,
  cancelBooking,
  invite,
  markNotificationsRead,
  setPlayerPlan,
  setRecordingAccess,
} from "@/lib/demo/state";
import { useBooking } from "@/lib/ui/BookingLauncher";
import { useToast } from "@/lib/ui/Toast";
import { SportArt } from "../art/SportArt";
import { HighlightPlayer } from "../media/HighlightPlayer";
import { ACCESS_LABEL, DateTile, PaymentBadge, StatusBadge, fmtSec } from "./shared";

type Tab = "upcoming" | "past" | "highlights" | "membership";

export function PlayerView() {
  const { state, now, act } = useDemo();
  const [tab, setTab] = useState<Tab>("upcoming");
  const [openId, setOpenId] = useState<string | null>(null);
  const s = state!;

  const mine = useMemo(
    () => s.bookings.filter((b) => b.ownerId === DEMO_PLAYER_ID).sort((a, b) => (a.date + a.startMin).localeCompare(b.date + b.startMin)),
    [s.bookings],
  );
  const upcoming = mine.filter((b) => !isPast(b, now) && (b.status === "confirmed" || b.status === "held" || b.payment.status === "refund_due"));
  const past = mine.filter((b) => !upcoming.includes(b)).reverse();
  const unread = s.notifications.filter((n) => !n.read).length;

  const tabs: [Tab, string][] = [
    ["upcoming", `Upcoming (${upcoming.length})`],
    ["past", "Past & cancelled"],
    ["highlights", "Highlights"],
    ["membership", "Membership"],
  ];

  return (
    <div className="app-grid">
      <div className="app-stack">
        <div className="subtabs" role="tablist" aria-label="Player sections">
          {tabs.map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
              {l}
            </button>
          ))}
        </div>

        {(tab === "upcoming" || tab === "past") && (
          <div className="app-card">
            <h2>{tab === "upcoming" ? "Upcoming bookings" : "Past & cancelled"}</h2>
            {(tab === "upcoming" ? upcoming : past).length === 0 && (
              <div className="empty">{tab === "upcoming" ? "No upcoming bookings. Your next game is one tap away." : "Nothing here yet."}</div>
            )}
            {(tab === "upcoming" ? upcoming : past).map((b) => (
              <div key={b.id} style={{ display: "grid", gap: 10 }}>
                <BookingRow b={b} now={now} open={openId === b.id} onToggle={() => setOpenId(openId === b.id ? null : b.id)} />
                {openId === b.id && <BookingDetail b={b} />}
              </div>
            ))}
            {tab === "upcoming" && s.eventRegistrations.length > 0 && (
              <>
                <h3 style={{ marginTop: 10 }}>Open sessions you joined</h3>
                {s.eventRegistrations.map((r) => {
                  const e = EVENTS.find((x) => x.id === r.eventId)!;
                  return (
                    <div key={r.eventId} className="option">
                      <div>
                        <div className="t">{e.title}</div>
                        <div className="m">
                          {venueById(e.venueId).name} · {formatDate(addDays(manilaToday(now), e.dayOffset))} · {formatRange(e.startMin, e.endMin)} · {formatPHP(e.feePerPlayer)} at the venue
                        </div>
                      </div>
                      <span className="badge">Session spot</span>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {tab === "highlights" && <Highlights mine={mine} />}
        {tab === "membership" && (
          <div className="app-card">
            <h2>Membership</h2>
            <p>
              Current demo plan: <strong>{playerPlanById(s.playerPlan).name}</strong>. Memberships are separate from court rental and never change a venue&apos;s subscription.
            </p>
            <div className="plan-grid" style={{ marginTop: 0 }}>
              {PLAYER_PLANS.map((p) => (
                <article key={p.id} className={`plan ${s.playerPlan === p.id ? "is-current" : ""}`}>
                  <h3>{p.name}</h3>
                  <p className="price">{p.price ?? PRICE_TBA}</p>
                  <ul>{p.benefits.map((x) => <li key={x}>{x}</li>)}</ul>
                  <button type="button" className="btn btn-sm btn-dark" disabled={s.playerPlan === p.id} onClick={() => act((st) => setPlayerPlan(st, p.id), 250)}>
                    {s.playerPlan === p.id ? "Current (demo)" : `Switch to ${p.name}`}
                  </button>
                </article>
              ))}
            </div>
          </div>
        )}
      </div>

      <aside className="app-stack" aria-label="Notifications and plan">
        <div className="app-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3>Notifications {unread > 0 && <span className="badge badge-orange">{unread} new</span>}</h3>
            {unread > 0 && <button type="button" className="text-btn" onClick={() => act(markNotificationsRead, 0)}>Mark read</button>}
          </div>
          <div className="notif">
            <ul>
              {s.notifications.slice(0, 6).map((n) => (
                <li key={n.id} className={n.read ? "" : "unread"}>{n.text}</li>
              ))}
              {s.notifications.length === 0 && <li>No notifications.</li>}
            </ul>
          </div>
        </div>
        <div className="app-card">
          <h3>Your plan</h3>
          <p><strong>{playerPlanById(s.playerPlan).name}</strong> · {playerPlanById(s.playerPlan).summary}</p>
          <button type="button" className="btn btn-xs btn-ghost" onClick={() => setTab("membership")}>Compare plans</button>
        </div>
      </aside>
    </div>
  );
}

function BookingRow({ b, now, open, onToggle }: { b: Booking; now: number; open: boolean; onToggle: () => void }) {
  const r = resourceById(b.resourceId);
  const v = venueById(b.venueId);
  return (
    <button type="button" className="booking-row" aria-expanded={open} onClick={onToggle}>
      <DateTile date={b.date} />
      <span>
        <span className="t" style={{ display: "block" }}>{sportById(b.sportId).name} · {r.name}</span>
        <span className="m">{v.name} · {formatDate(b.date)} · {formatRange(b.startMin, b.endMin)} · {b.ref}</span>
      </span>
      <span style={{ display: "grid", gap: 4, justifyItems: "end" }}>
        <StatusBadge status={displayStatus(b, now)} />
        <PaymentBadge status={b.payment.status} />
      </span>
    </button>
  );
}

function BookingDetail({ b }: { b: Booking }) {
  const { act, now } = useDemo();
  const { open } = useBooking();
  const toast = useToast();
  const [name, setName] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const v = venueById(b.venueId);
  const r = resourceById(b.resourceId);
  const status = displayStatus(b, now);
  const refund = cancellationRefund(b, v, now);
  const run = (p: Promise<unknown>) => p.then(() => setErr(null)).catch((e) => setErr(e instanceof DemoError ? e.message : "Something went wrong."));
  const canCancel = status === "Confirmed" || status === "Awaiting payment" || status === "Payment failed";

  return (
    <div className="panel" style={{ background: "var(--white)" }}>
      {err && <div className="alert alert-error" role="alert">{err}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
        <dl className="kv">
          <dt>Venue</dt><dd>{v.name}, {v.area}</dd>
          <dt>{r.kind === "table" ? "Table" : r.kind === "pitch" ? "Pitch" : "Court"}</dt><dd>{r.name}</dd>
          <dt>Details</dt><dd>{r.indoor ? "Indoor" : "Outdoor"} · {r.surface}</dd>
          <dt>When</dt><dd>{formatDate(b.date)} · {formatRange(b.startMin, b.endMin)}</dd>
          <dt>Booking</dt><dd>{status}</dd>
          <dt>Payment</dt><dd>{b.payment.status.replace("_", " ")}</dd>
        </dl>
        <div className="receipt" aria-label="Receipt">
          <div className="line"><span>Rental</span><span>{formatPHP(b.price.rental)}</span></div>
          {b.price.equipment.map((e) => <div key={e.id} className="line"><span>{e.label}</span><span>{formatPHP(e.price)}</span></div>)}
          <div className="line total"><span>Total</span><span>{formatPHP(b.price.subtotal)}</span></div>
          <div className="line"><span>Paid online</span><span>{formatPHP(b.payment.amountPaid)}</span></div>
          {b.status === "confirmed" && b.price.balance > 0 && <div className="line"><span>Balance at venue</span><span>{formatPHP(b.price.balance)}</span></div>}
          {b.cancellation && <div className="line"><span>Refund</span><span>{formatPHP(b.cancellation.refund)}</span></div>}
        </div>
      </div>
      {b.cancellation && <p className="hint">{b.cancellation.note}</p>}

      <div>
        <h3 style={{ fontSize: "1.2rem", marginBottom: 8 }}>Squad</h3>
        <table className="ledger on-light" style={{ fontSize: "0.88rem" }}>
          <thead><tr><th scope="col">Name</th><th scope="col">Status</th><th scope="col">Recording access</th></tr></thead>
          <tbody>
            {b.participants.map((p) => (
              <tr key={p.id}>
                <td>{p.role === "owner" ? "You (owner)" : p.name}</td>
                <td>
                  {p.status === "accepted" ? "Going" : (
                    <>Invited <button type="button" className="text-btn" onClick={() => run(act((s) => acceptInvite(s, b.id, p.id), 200))}>(demo: accept)</button></>
                  )}
                </td>
                <td>
                  {p.role === "owner" ? "Yes" : (
                    <label className="check" style={{ minHeight: 32 }}>
                      <input type="checkbox" checked={p.recordingAccess} onChange={(e) => run(act((s) => setRecordingAccess(s, b.id, p.id, e.target.checked), 200))} />
                      {p.recordingAccess ? "Allowed" : "Not allowed"}
                    </label>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!isPast(b, now) && b.status === "confirmed" && (
          <div className="inline-form" style={{ marginTop: 10 }}>
            <div className="field">
              <label htmlFor={`inv-${b.id}`}>Invite someone</label>
              <input id={`inv-${b.id}`} className="input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Name" />
            </div>
            <button type="button" className="btn btn-sm btn-dark" disabled={!name.trim()} onClick={() => run(act((s) => invite(s, b.id, name), 250).then(() => { setName(""); toast("Invite sent (demo)."); }))}>
              Send invite
            </button>
          </div>
        )}
        <p className="hint" style={{ marginTop: 6 }}>Invitations never include recording access. Grant it per person after they accept.</p>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="btn btn-sm btn-dark" onClick={() => open({ sportId: b.sportId, venueId: b.venueId, resourceId: b.resourceId })}>
          Book again
        </button>
        {canCancel && !confirmCancel && (
          <button type="button" className="btn btn-sm btn-danger" onClick={() => setConfirmCancel(true)}>Cancel booking</button>
        )}
      </div>
      {confirmCancel && (
        <div className="alert alert-warn" role="alert">
          <div style={{ display: "grid", gap: 10 }}>
            <span><strong>Cancel {b.ref}?</strong> {refund.note} Refund: {formatPHP(refund.refund)}.</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn btn-xs btn-dark" onClick={() => run(act((s, t) => cancelBooking(s, b.id, "player", t)).then(() => { setConfirmCancel(false); toast(`${b.ref} cancelled (demo).`); }))}>Yes, cancel</button>
              <button type="button" className="btn btn-xs btn-ghost" onClick={() => setConfirmCancel(false)}>Keep booking</button>
            </div>
          </div>
        </div>
      )}
      {!r.indoor && <p className="hint">Outdoor {r.kind}: {r.notes}</p>}
    </div>
  );
}

function Highlights({ mine }: { mine: Booking[] }) {
  const { state, now } = useDemo();
  const toast = useToast();
  const s = state!;
  const [playing, setPlaying] = useState<string | null>(null);
  const past = mine.filter((b) => isPast(b, now) && b.status === "confirmed").reverse();

  return (
    <div className="app-card">
      <h2>Your highlights</h2>
      <div className="alert alert-info">
        <span>Clips appear when the venue records and publishes footage for your booking, you&apos;re an authorised participant, and your plan includes highlights. Each card explains why if something isn&apos;t available.</span>
      </div>
      <div className="clip-grid">
        {past.flatMap((b) => {
          const r = resourceById(b.resourceId);
          const rec = s.recordings.find((x) => x.bookingId === b.id);
          const base = { booking: b, resource: r, venuePlan: s.venuePlans[b.venueId], recording: rec, viewerId: DEMO_PLAYER_ID, playerPlan: s.playerPlan };
          const published = rec?.status === "ready" ? rec.clips.filter((c) => c.published) : [];
          if (published.length === 0) {
            const a = videoAccess(base);
            const [label, cls] = a.ok ? ["Ready", "badge-ok"] : ACCESS_LABEL[a.code];
            return [
              <article key={b.id} className="clip-card">
                <div className="thumb">
                  <SportArt sport={b.sportId} idSuffix={`-h${b.id}`} />
                  <div className="state">{a.ok ? "" : a.message}</div>
                </div>
                <div className="body">
                  <span className={`badge ${cls}`} style={{ justifySelf: "start" }}>{label}</span>
                  <span className="t">{sportById(b.sportId).name} · {r.name}</span>
                  <span className="hint">{venueById(b.venueId).name} · {formatDate(b.date)}</span>
                </div>
              </article>,
            ];
          }
          return published.map((c) => {
            const a = videoAccess({ ...base, clip: c });
            const key = `${b.id}-${c.id}`;
            return (
              <article key={key} className="clip-card">
                {a.ok && playing === key ? (
                  <HighlightPlayer kind={c.kind} title={c.title} length={c.endSec - c.startSec} />
                ) : (
                  <div className="thumb">
                    <SportArt sport={b.sportId} idSuffix={`-c${c.id}`} />
                    {!a.ok && <div className="state">{a.message}</div>}
                  </div>
                )}
                <div className="body">
                  <span className={`badge ${a.ok ? "badge-ok" : ACCESS_LABEL[a.code][1]}`} style={{ justifySelf: "start" }}>
                    {a.ok ? "Ready" : ACCESS_LABEL[a.code][0]}
                  </span>
                  <span className="t">{c.title}</span>
                  <span className="hint">{r.name} · {formatDate(b.date)} · {fmtSec(c.endSec - c.startSec)} · demo clip</span>
                  {a.ok && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button type="button" className="btn btn-xs btn-dark" onClick={() => setPlaying(playing === key ? null : key)}>
                        {playing === key ? "Close preview" : "Preview"}
                      </button>
                      {a.canDownload ? (
                        <button type="button" className="btn btn-xs btn-ghost" onClick={() => toast("Demo: production issues a short-lived signed download link.")}>Download</button>
                      ) : (
                        <span className="hint">Downloads in Replay Plus</span>
                      )}
                    </div>
                  )}
                </div>
              </article>
            );
          });
        })}
      </div>
    </div>
  );
}
