"use client";
import { useEffect, useMemo, useState } from "react";
import { PRICE_TBA, VENUE_PLANS, venuePlanById } from "@/content/plans";
import { sportById } from "@/content/sports";
import { VENUES, resourceById, venueById } from "@/content/venues";
import { displayStatus, isBlocking, isPast } from "@/lib/booking/rules";
import { addDays, formatDate, formatPHP, formatRange, formatTime, manilaToday, parseHM, pad } from "@/lib/booking/time";
import type { Booking, PaymentStatus, RecordingSource } from "@/lib/booking/types";
import { useDemo } from "@/lib/demo/DemoProvider";
import {
  DEMO_PLAYER_ID,
  DemoError,
  addClip,
  addMaintenance,
  cancelBooking,
  finishProcessing,
  publishClip,
  removeMaintenance,
  setVenuePlan,
  startUpload,
} from "@/lib/demo/state";
import { useToast } from "@/lib/ui/Toast";
import { PaymentBadge, StatusBadge, fmtSec } from "./shared";

type Tab = "calendar" | "payments" | "recordings" | "settings";

export function VenueView() {
  const { state } = useDemo();
  const [venueId, setVenueId] = useState("kalye");
  const [tab, setTab] = useState<Tab>("calendar");
  const venue = venueById(venueId);
  const plan = venuePlanById(state!.venuePlans[venueId]);

  return (
    <div className="app-stack">
      <div style={{ display: "flex", gap: 12, alignItems: "end", flexWrap: "wrap", justifyContent: "space-between" }}>
        <div className="field" style={{ minWidth: 260 }}>
          <label htmlFor="venue-sel">Venue (demo staff account)</label>
          <select id="venue-sel" className="select" value={venueId} onChange={(e) => setVenueId(e.target.value)}>
            {VENUES.map((v) => (
              <option key={v.id} value={v.id}>{v.name} — {v.area}</option>
            ))}
          </select>
        </div>
        <span className="badge">Plan: {plan.name} (demo)</span>
      </div>
      <p className="hint">Demo convenience: production staff only see venues their role grants, enforced on the server.</p>
      <div className="subtabs" role="tablist" aria-label="Venue sections">
        {([["calendar", "Calendar"], ["payments", "Bookings & payments"], ["recordings", "Recordings"], ["settings", "Plan & staff"]] as [Tab, string][]).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {tab === "calendar" && <Calendar venueId={venueId} />}
      {tab === "payments" && <Payments venueId={venueId} />}
      {tab === "recordings" && <Recordings venueId={venueId} />}
      {tab === "settings" && <Settings venueId={venueId} />}
      <p className="hint">Opening hours: {venue.open}–{venue.close} · All times Asia/Manila.</p>
    </div>
  );
}

function Calendar({ venueId }: { venueId: string }) {
  const { state, now, act } = useDemo();
  const toast = useToast();
  const s = state!;
  const v = venueById(venueId);
  const [date, setDate] = useState(manilaToday(now));
  const [view, setView] = useState<"day" | "week">("day");
  const [sel, setSel] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [mt, setMt] = useState({ resourceId: v.resources[0].id, start: "12:00", end: "13:00", reason: "Maintenance" });
  useEffect(() => {
    setMt((m) => ({ ...m, resourceId: v.resources[0].id }));
    setSel(null);
  }, [v]);

  const open = parseHM(v.open);
  const close = parseHM(v.close);
  const hours = Math.ceil((close - open) / 60);
  const pct = (m: number) => `${((m - open) / (close - open)) * 100}%`;
  const selected = s.bookings.find((b) => b.id === sel);

  const submitMaint = () => {
    const startMin = parseHM(mt.start);
    const endMin = parseHM(mt.end);
    if (!(endMin > startMin)) return setErr("Maintenance end must be after start.");
    act((st, t) => addMaintenance(st, { resourceId: mt.resourceId, date, startMin, endMin, reason: mt.reason || "Maintenance" }, t))
      .then(() => {
        setErr(null);
        toast("Maintenance block added. Those times are now unavailable to players.");
      })
      .catch((e) => setErr(e instanceof DemoError ? e.message : "Couldn't add block."));
  };

  return (
    <div className="app-grid">
      <div className="app-card">
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "space-between" }}>
          <h2>{view === "day" ? formatDate(date) : `Week of ${formatDate(date)}`}</h2>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-xs btn-ghost" onClick={() => setDate(addDays(date, view === "day" ? -1 : -7))} aria-label="Previous">←</button>
            <button type="button" className="btn btn-xs btn-ghost" onClick={() => setDate(manilaToday(now))}>Today</button>
            <button type="button" className="btn btn-xs btn-ghost" onClick={() => setDate(addDays(date, view === "day" ? 1 : 7))} aria-label="Next">→</button>
            <div className="subtabs" role="group" aria-label="Calendar view">
              <button type="button" aria-pressed={view === "day"} onClick={() => setView("day")}>Day</button>
              <button type="button" aria-pressed={view === "week"} onClick={() => setView("week")}>Week</button>
            </div>
          </div>
        </div>

        {view === "day" ? (
          <div className="admin-cal">
            <div className="admin-cal-inner" style={{ ["--hour-w" as string]: `${100 / hours}%` }}>
              <div className="hours">
                <span />
                <div className="ticks">
                  {Array.from({ length: hours + 1 }).map((_, i) =>
                    i % 2 === 0 ? <span key={i} style={{ left: `${(i / hours) * 100}%` }}>{formatTime(open + i * 60).replace(":00", "")}</span> : null,
                  )}
                </div>
              </div>
              {v.resources.map((r) => (
                <div key={r.id} className="row">
                  <div className="label">
                    {r.name.split(" · ")[0]}
                    <small>{r.sports.map((x) => sportById(x).name).join(" + ")}</small>
                  </div>
                  <div className="lane">
                    {s.maintenance
                      .filter((m) => m.resourceId === r.id && m.date === date)
                      .map((m) => (
                        <span key={m.id} className="ev maint" style={{ left: pct(m.startMin), width: `calc(${pct(m.endMin)} - ${pct(m.startMin)})` }} title={m.reason}>
                          {m.reason}
                        </span>
                      ))}
                    {s.bookings
                      .filter((b) => b.resourceId === r.id && b.date === date && (isBlocking(b, now) || (b.status === "confirmed")))
                      .map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          className={`ev ${b.status === "held" ? "held" : "confirmed"} ${b.ownerId === DEMO_PLAYER_ID ? "mine" : ""} ${isPast(b, now) ? "past" : ""}`}
                          style={{ left: pct(b.startMin), width: `calc(${pct(b.endMin)} - ${pct(b.startMin)})` }}
                          aria-pressed={sel === b.id}
                          aria-label={`${b.ref}, ${b.ownerName}, ${formatRange(b.startMin, b.endMin)}, ${displayStatus(b, now)}`}
                          onClick={() => setSel(b.id)}
                        >
                          {b.ownerName}
                          <br />
                          <span className="num">{formatTime(b.startMin)}</span>
                        </button>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <WeekView venueId={venueId} start={date} onPick={(d) => { setDate(d); setView("day"); }} />
        )}
        <div className="legend">
          <span><i style={{ background: "var(--charcoal)" }} />Confirmed</span>
          <span><i style={{ background: "var(--lime)" }} />Demo player&apos;s booking</span>
          <span><i style={{ border: "1.5px dashed var(--charcoal)" }} />Held (awaiting payment)</span>
          <span><i style={{ background: "#ffd0bf" }} />Maintenance</span>
        </div>
      </div>

      <aside className="app-stack">
        <div className="app-card">
          <h3>Booking details</h3>
          {!selected ? (
            <p className="hint">Select a booking on the calendar.</p>
          ) : (
            <>
              <dl className="kv">
                <dt>Ref</dt><dd>{selected.ref}</dd>
                <dt>Customer</dt><dd>{selected.ownerName}</dd>
                <dt>Resource</dt><dd>{resourceById(selected.resourceId).name}</dd>
                <dt>Sport</dt><dd>{sportById(selected.sportId).name}</dd>
                <dt>When</dt><dd>{formatRange(selected.startMin, selected.endMin)}</dd>
                <dt>Total</dt><dd>{formatPHP(selected.price.subtotal)}</dd>
                <dt>Paid</dt><dd>{formatPHP(selected.payment.amountPaid)}</dd>
              </dl>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <StatusBadge status={displayStatus(selected, now)} />
                <PaymentBadge status={selected.payment.status} />
              </div>
              {!isPast(selected, now) && (selected.status === "confirmed" || selected.status === "held") && (
                <button
                  type="button"
                  className="btn btn-sm btn-danger"
                  onClick={() => {
                    if (confirm(`Cancel ${selected.ref}? The customer is refunded in full.`))
                      act((st, t) => cancelBooking(st, selected.id, "venue", t)).then(() => toast(`${selected.ref} cancelled by venue (demo).`));
                  }}
                >
                  Cancel booking (full refund)
                </button>
              )}
            </>
          )}
        </div>
        <div className="app-card">
          <h3>Block time for maintenance</h3>
          {err && <div className="alert alert-error" role="alert">{err}</div>}
          <div className="field">
            <label htmlFor="mt-res">Resource</label>
            <select id="mt-res" className="select" value={mt.resourceId} onChange={(e) => setMt({ ...mt, resourceId: e.target.value })}>
              {v.resources.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="mt-s">Start</label>
              <input id="mt-s" type="time" step={1800} className="input num" value={mt.start} onChange={(e) => setMt({ ...mt, start: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="mt-e">End</label>
              <input id="mt-e" type="time" step={1800} className="input num" value={mt.end} onChange={(e) => setMt({ ...mt, end: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="mt-r">Reason</label>
            <input id="mt-r" className="input" value={mt.reason} maxLength={40} onChange={(e) => setMt({ ...mt, reason: e.target.value })} />
          </div>
          <button type="button" className="btn btn-sm btn-dark" onClick={submitMaint}>Add block on {formatDate(date)}</button>
          <ul className="notif" style={{ padding: 0 }}>
            {s.maintenance.filter((m) => m.date === date && v.resources.some((r) => r.id === m.resourceId)).map((m) => (
              <li key={m.id} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span>{resourceById(m.resourceId).name.split(" · ")[0]} · {formatRange(m.startMin, m.endMin)} · {m.reason}</span>
                <button type="button" className="text-btn" onClick={() => act((st) => removeMaintenance(st, m.id), 150)}>Remove</button>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}

function WeekView({ venueId, start, onPick }: { venueId: string; start: string; onPick: (d: string) => void }) {
  const { state, now } = useDemo();
  const v = venueById(venueId);
  const days = Array.from({ length: 7 }).map((_, i) => addDays(start, i));
  const openMin = parseHM(v.close) - parseHM(v.open);
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="ledger on-light" style={{ minWidth: 640 }}>
        <thead>
          <tr>
            <th scope="col">Resource</th>
            {days.map((d) => (
              <th key={d} scope="col">
                <button type="button" className="text-btn" onClick={() => onPick(d)}>{formatDate(d)}</button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {v.resources.map((r) => (
            <tr key={r.id}>
              <th scope="row" style={{ textTransform: "none", letterSpacing: 0, fontSize: "0.85rem" }}>{r.name.split(" · ")[0]}</th>
              {days.map((d) => {
                const bs = state!.bookings.filter((b) => b.resourceId === r.id && b.date === d && isBlocking(b, now));
                const mins = bs.reduce((a, b) => a + b.endMin - b.startMin, 0);
                const util = Math.round((mins / openMin) * 100);
                return (
                  <td key={d}>
                    <span className="num">{bs.length}</span> <span className="hint">({util}%)</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint" style={{ marginTop: 8 }}>Bookings per day (utilisation of opening hours). Select a day to open it.</p>
    </div>
  );
}

function Payments({ venueId }: { venueId: string }) {
  const { state, now } = useDemo();
  const [filter, setFilter] = useState<PaymentStatus | "all">("all");
  const today = manilaToday(now);
  const rows = useMemo(
    () =>
      state!.bookings
        .filter((b) => b.venueId === venueId && b.date >= addDays(today, -3) && b.date <= addDays(today, 7))
        .filter((b) => filter === "all" || b.payment.status === filter)
        .sort((a, b) => (a.date + pad(a.startMin)).localeCompare(b.date + pad(b.startMin))),
    [state, venueId, today, filter],
  );
  const totals = rows.reduce((a, b) => ({ paid: a.paid + b.payment.amountPaid, due: a.due + (b.status === "confirmed" ? b.price.balance : 0) }), { paid: 0, due: 0 });
  return (
    <div className="app-card">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
        <h2>Bookings &amp; payments</h2>
        <div className="field" style={{ minWidth: 200 }}>
          <label htmlFor="pf">Payment status</label>
          <select id="pf" className="select" value={filter} onChange={(e) => setFilter(e.target.value as PaymentStatus | "all")}>
            {["all", "paid", "deposit_paid", "pending", "failed", "unpaid", "refund_due", "refunded"].map((x) => (
              <option key={x} value={x}>{x === "all" ? "All" : x.replace("_", " ")}</option>
            ))}
          </select>
        </div>
      </div>
      <p className="hint">
        Showing {formatDate(addDays(today, -3))} – {formatDate(addDays(today, 7))}. Collected online: <strong className="num">{formatPHP(totals.paid)}</strong> · Balances due at venue: <strong className="num">{formatPHP(totals.due)}</strong>
      </p>
      <div style={{ overflowX: "auto" }}>
        <table className="ledger on-light" style={{ minWidth: 720 }}>
          <thead>
            <tr><th scope="col">Ref</th><th scope="col">When</th><th scope="col">Resource</th><th scope="col">Customer</th><th scope="col">Total</th><th scope="col">Paid</th><th scope="col">Booking</th><th scope="col">Payment</th></tr>
          </thead>
          <tbody>
            {rows.map((b: Booking) => (
              <tr key={b.id}>
                <td>{b.ref}</td>
                <td>{formatDate(b.date)} {formatTime(b.startMin)}</td>
                <td>{resourceById(b.resourceId).name.split(" · ")[0]}</td>
                <td>{b.ownerName}</td>
                <td>{formatPHP(b.price.subtotal)}</td>
                <td>{formatPHP(b.payment.amountPaid)}</td>
                <td><StatusBadge status={displayStatus(b, now)} /></td>
                <td><PaymentBadge status={b.payment.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <div className="empty">No bookings match this filter.</div>}
      </div>
    </div>
  );
}

function Recordings({ venueId }: { venueId: string }) {
  const { state, now, act } = useDemo();
  const toast = useToast();
  const s = state!;
  const plan = venuePlanById(s.venuePlans[venueId]);
  const [sel, setSel] = useState<string | null>(null);
  const [source, setSource] = useState<RecordingSource>("cctv_export");
  const [failNext, setFailNext] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [clip, setClip] = useState({ title: "", start: "0:10", end: "0:28" });
  const [err, setErr] = useState<string | null>(null);

  const eligible = s.bookings
    .filter((b) => b.venueId === venueId && b.status === "confirmed" && isPast(b, now) && resourceById(b.resourceId).recordingCapable)
    .sort((a, b) => (b.date + pad(b.startMin)).localeCompare(a.date + pad(a.startMin)))
    .slice(0, 12);
  const booking = eligible.find((b) => b.id === sel);
  const rec = booking ? s.recordings.find((r) => r.bookingId === booking.id) : undefined;

  if (!plan.entitlements.videoPublishing) {
    return (
      <div className="app-card">
        <h2>Recordings</h2>
        <div className="empty">
          Recording uploads and clip publishing are included in the Capture and Club plans. This venue is on {plan.name}.
          <div style={{ marginTop: 12 }}>
            <button type="button" className="btn btn-sm btn-dark" onClick={() => act((st) => setVenuePlan(st, venueId, "capture"), 250)}>Switch venue to Capture (demo)</button>
          </div>
        </div>
      </div>
    );
  }

  const parse = (t: string) => {
    const [m, sec] = t.split(":").map(Number);
    return (m || 0) * 60 + (sec || 0);
  };

  const upload = () => {
    if (!booking) return;
    setProgress(0);
    let p = 0;
    const iv = setInterval(() => {
      p += 20;
      setProgress(p);
      if (p >= 100) {
        clearInterval(iv);
        act((st) => startUpload(st, booking.id, source), 200).then((next) => {
          setProgress(null);
          const r = next.recordings.find((x) => x.bookingId === booking.id)!;
          setTimeout(() => {
            act((st) => finishProcessing(st, r.id, failNext ? "failed" : "ready"), 0).then(() => toast(failNext ? "Processing failed (simulated)." : "Footage processed and ready to clip."));
          }, 1800);
        });
      }
    }, 280);
  };

  return (
    <div className="app-grid">
      <div className="app-card">
        <h2>Completed bookings with camera coverage</h2>
        <p className="hint">Footage is private by default and linked to one booking and resource. Players never get raw camera feeds.</p>
        {eligible.length === 0 && <div className="empty">No completed bookings on camera-covered resources yet.</div>}
        {eligible.map((b) => {
          const r = s.recordings.find((x) => x.bookingId === b.id);
          const label = !r ? "Not recorded" : { awaiting_upload: "Awaiting upload", processing: "Processing", ready: `Ready · ${r.clips.filter((c) => c.published).length} published`, failed: "Failed", expired: "Expired" }[r.status];
          return (
            <button key={b.id} type="button" className="booking-row" aria-pressed={sel === b.id} onClick={() => { setSel(b.id); setErr(null); }} style={{ gridTemplateColumns: "1fr auto" }}>
              <span>
                <span className="t" style={{ display: "block" }}>{b.ref} · {resourceById(b.resourceId).name.split(" · ")[0]} · {b.ownerName}</span>
                <span className="m">{formatDate(b.date)} · {formatRange(b.startMin, b.endMin)} · {sportById(b.sportId).name}</span>
              </span>
              <span className="badge">{label}</span>
            </button>
          );
        })}
      </div>
      <aside className="app-stack">
        <div className="app-card">
          <h3>Publish workflow</h3>
          {!booking ? (
            <p className="hint">Select a completed booking.</p>
          ) : (
            <>
              <p><strong>{booking.ref}</strong> · {formatDate(booking.date)}</p>
              {err && <div className="alert alert-error" role="alert">{err}</div>}
              {(!rec || rec.status === "awaiting_upload" || rec.status === "failed") && (
                <>
                  {rec?.status === "failed" && <div className="alert alert-error">{rec.failureReason}</div>}
                  <fieldset className="panel" style={{ margin: 0 }}>
                    <legend className="label" style={{ fontWeight: 700 }}>Source</legend>
                    <label className="check"><input type="radio" name="src" checked={source === "cctv_export"} onChange={() => setSource("cctv_export")} />Exported venue CCTV file</label>
                    <label className="check"><input type="radio" name="src" checked={source === "camera_upload"} onChange={() => setSource("camera_upload")} />Uploaded camera recording</label>
                  </fieldset>
                  <label className="check"><input type="checkbox" checked={failNext} onChange={(e) => setFailNext(e.target.checked)} />Demo: simulate processing failure</label>
                  {progress != null ? (
                    <div role="status" aria-label={`Uploading ${progress}%`}>
                      <div className="progress"><i style={{ width: `${progress}%` }} /></div>
                      <p className="hint">Uploading sample media… {progress}%</p>
                    </div>
                  ) : (
                    <button type="button" className="btn btn-sm btn-dark" onClick={upload}>Upload sample footage (demo)</button>
                  )}
                </>
              )}
              {rec?.status === "processing" && <div className="alert alert-warn" role="status"><span className="spinner" /> Processing footage…</div>}
              {rec?.status === "expired" && <div className="alert alert-info">Retention period ended — footage removed.</div>}
              {rec?.status === "ready" && (
                <>
                  <p className="hint">Retained until {formatDate(rec.retainUntil)} · Source: {rec.source === "cctv_export" ? "CCTV export" : "camera upload"}</p>
                  {rec.clips.map((c) => (
                    <div key={c.id} className="option">
                      <div>
                        <div className="t">{c.title}</div>
                        <div className="m num">{fmtSec(c.startSec)}–{fmtSec(c.endSec)} · {c.published ? "Published to eligible participants" : "Draft (private)"}</div>
                      </div>
                      <button type="button" className={`btn btn-xs ${c.published ? "btn-ghost" : "btn-dark"}`} onClick={() => act((st, t) => publishClip(st, rec.id, c.id, !c.published, t), 250)}>
                        {c.published ? "Unpublish" : "Publish"}
                      </button>
                    </div>
                  ))}
                  <div className="panel">
                    <span className="label" style={{ fontWeight: 700 }}>Cut a clip</span>
                    <div className="field">
                      <label htmlFor="cl-t">Title</label>
                      <input id="cl-t" className="input" maxLength={60} value={clip.title} onChange={(e) => setClip({ ...clip, title: e.target.value })} placeholder="e.g. Buzzer beater" />
                    </div>
                    <div className="field-row">
                      <div className="field"><label htmlFor="cl-s">Start (m:ss)</label><input id="cl-s" className="input num" value={clip.start} onChange={(e) => setClip({ ...clip, start: e.target.value })} /></div>
                      <div className="field"><label htmlFor="cl-e">End (m:ss)</label><input id="cl-e" className="input num" value={clip.end} onChange={(e) => setClip({ ...clip, end: e.target.value })} /></div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-sm btn-dark"
                      onClick={() =>
                        act((st) => addClip(st, rec.id, { title: clip.title, startSec: parse(clip.start), endSec: parse(clip.end) }), 250)
                          .then(() => { setErr(null); setClip({ title: "", start: "0:10", end: "0:28" }); })
                          .catch((e) => setErr(e instanceof DemoError ? e.message : "Couldn't add clip."))
                      }
                    >
                      Add clip (draft)
                    </button>
                  </div>
                  <p className="hint">Published clips are visible only to the booking owner and participants they authorised, if their plan includes highlights.</p>
                </>
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

function Settings({ venueId }: { venueId: string }) {
  const { state, act } = useDemo();
  const toast = useToast();
  const current = state!.venuePlans[venueId];
  const plan = venuePlanById(current);
  return (
    <div className="app-stack">
      <div className="app-card">
        <h2>Venue subscription</h2>
        <p className="hint">Independent of any player&apos;s membership.</p>
        <div className="plan-grid" style={{ marginTop: 0 }}>
          {VENUE_PLANS.map((p) => (
            <article key={p.id} className={`plan ${current === p.id ? "is-current" : ""}`}>
              <h3>{p.name}</h3>
              <p className="price">{p.price ?? PRICE_TBA}</p>
              <ul>{p.benefits.map((b) => <li key={b}>{b}</li>)}</ul>
              <button type="button" className="btn btn-sm btn-dark" disabled={current === p.id} onClick={() => act((st) => setVenuePlan(st, venueId, p.id), 250).then(() => toast(`Venue plan set to ${p.name} (demo).`))}>
                {current === p.id ? "Current (demo)" : `Switch to ${p.name}`}
              </button>
            </article>
          ))}
        </div>
      </div>
      <div className="app-card">
        <h2>Staff access</h2>
        {plan.entitlements.staffRoles ? (
          <table className="ledger on-light">
            <thead><tr><th scope="col">Person</th><th scope="col">Role</th><th scope="col">Can</th></tr></thead>
            <tbody>
              <tr><td>Owner (demo)</td><td>Owner</td><td>Everything, billing</td></tr>
              <tr><td>Front desk (demo)</td><td>Bookings</td><td>Calendar, bookings, payments</td></tr>
              <tr><td>Media staff (demo)</td><td>Recordings</td><td>Upload, clip, publish</td></tr>
            </tbody>
          </table>
        ) : (
          <div className="empty">Staff roles are included in the Club plan. Currently a single owner account.</div>
        )}
      </div>
    </div>
  );
}
