"use client";
// Sport → Venue → Named court/table/pitch → Date, duration & start → Review
// → Demo checkout → Confirmation. Works without WebGL; shares the demo store
// with the player area and venue admin.
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SPORTS, sportById } from "@/content/sports";
import { EVENTS, VENUES, resourceById, venueById } from "@/content/venues";
import { venuePlanById } from "@/content/plans";
import { displayStatus, durationOptions, listSlots, priceFor, type Slot } from "@/lib/booking/rules";
import {
  addDays,
  formatDate,
  formatDuration,
  formatPHP,
  formatRange,
  formatTime,
  manilaToday,
} from "@/lib/booking/time";
import type { Booking, Resource, SportId, Venue } from "@/lib/booking/types";
import { useDemo } from "@/lib/demo/DemoProvider";
import { DemoError, applyPaymentEvent, cancelBooking, createHold, invite, registerEvent, simulateCompetitor, uid } from "@/lib/demo/state";
import { useBooking } from "@/lib/ui/BookingLauncher";
import { useToast } from "@/lib/ui/Toast";

const STEPS = ["Sport", "Venue", "Court", "Time", "Review", "Checkout", "Done"] as const;
type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const SLOT_REASON: Record<Slot["reason"], string> = {
  available: "Available",
  booked: "Booked",
  maintenance: "Maintenance",
  past: "Already passed",
  closed: "Unavailable",
};

function venuesFor(sport: SportId) {
  return VENUES.filter((v) => v.resources.some((r) => r.sports.includes(sport)));
}

function Countdown({ until, now }: { until?: number; now: number }) {
  const [t, setT] = useState(now);
  useEffect(() => {
    const i = setInterval(() => setT(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);
  if (!until) return null;
  const left = Math.max(0, until - t);
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return (
    <span className="num">
      {m}:{String(s).padStart(2, "0")}
    </span>
  );
}

export function BookingDialog() {
  const { isOpen, close, prefill, session } = useBooking();
  const { state, now, act } = useDemo();
  const toast = useToast();
  const ref = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  const [step, setStep] = useState<Step>(0);
  const [sportId, setSportId] = useState<SportId | null>(null);
  const [venueId, setVenueId] = useState<string | null>(null);
  const [resourceId, setResourceId] = useState<string | null>(null);
  const [date, setDate] = useState(() => manilaToday());
  const [duration, setDuration] = useState(60);
  const [startMin, setStartMin] = useState<number | null>(null);
  const [equipment, setEquipment] = useState<string[]>([]);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<"succeeded" | "pending" | "failed">("succeeded");
  const [simulateTaken, setSimulateTaken] = useState(false);
  const [busy, setBusy] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteName, setInviteName] = useState("");
  const [dateError, setDateError] = useState<string | null>(null);

  const today = manilaToday(now);
  const maxDate = addDays(today, 30);

  // Reset on every open, applying prefill.
  useEffect(() => {
    if (!session) return;
    const s = prefill.sportId ?? null;
    const v = prefill.venueId ?? null;
    const r = prefill.resourceId ?? null;
    setSportId(s);
    setVenueId(v);
    setResourceId(r);
    setDate(prefill.date && prefill.date >= manilaToday() ? prefill.date : manilaToday());
    setStartMin(null);
    setEquipment([]);
    setBookingId(null);
    setOutcome("succeeded");
    setSimulateTaken(false);
    setError(null);
    setInviteName("");
    if (r) {
      const res = resourceById(r);
      setDuration(res.minDurationMin);
      setStep(s ? 3 : 0);
    } else if (s && v) setStep(2);
    else if (s) setStep(1);
    else setStep(0);
  }, [session, prefill]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (isOpen && !d.open) d.showModal();
    if (!isOpen && d.open) d.close();
  }, [isOpen]);

  useEffect(() => {
    heading.current?.focus();
  }, [step, isOpen]);

  const sport = sportId ? sportById(sportId) : null;
  const venue: Venue | null = venueId ? venueById(venueId) : null;
  const resource: Resource | null = resourceId ? resourceById(resourceId) : null;
  const booking: Booking | undefined = state?.bookings.find((b) => b.id === bookingId);

  const slots = useMemo(() => {
    if (!venue || !resource || !state) return [];
    return listSlots({ venue, resource, date, durationMin: duration, bookings: state.bookings, maintenance: state.maintenance, now });
  }, [venue, resource, state, date, duration, now]);

  // Simulated availability fetch for honest loading states.
  useEffect(() => {
    if (step !== 3) return;
    setSlotsLoading(true);
    const t = setTimeout(() => setSlotsLoading(false), 350);
    return () => clearTimeout(t);
  }, [step, date, duration, resourceId]);

  const price = venue && resource ? priceFor(venue, resource, duration, equipment) : null;
  const videoAvailable = !!(venue && resource && state && resource.recordingCapable && venuePlanById(state.venuePlans[venue.id]).entitlements.videoPublishing);

  const go = (s: Step) => {
    setError(null);
    setStep(s);
  };

  const run = useCallback(
    async (fn: () => Promise<unknown>) => {
      setBusy(true);
      setError(null);
      try {
        await fn();
      } catch (e) {
        setError(e instanceof DemoError ? e.message : "Something went wrong. Please try again.");
        return false;
      } finally {
        setBusy(false);
      }
      return true;
    },
    [],
  );

  const placeHold = () =>
    run(async () => {
      const req = { venueId: venue!.id, resourceId: resource!.id, sportId: sportId!, date, startMin: startMin!, durationMin: duration, equipmentIds: equipment };
      if (simulateTaken) await act((s, t) => simulateCompetitor(s, req, t), 200);
      try {
        let id = "";
        await act((s, t) => {
          const r = createHold(s, req, t);
          id = r.booking.id;
          return r.state;
        }, 600);
        setBookingId(id);
        setStep(5);
      } catch (e) {
        if (e instanceof DemoError && e.code === "slot_taken") {
          setStartMin(null);
          setSimulateTaken(false);
          setStep(3);
        }
        throw e;
      }
    });

  const pay = () =>
    run(async () => {
      await act((s, t) => applyPaymentEvent(s, { bookingId: bookingId!, eventId: uid("evt"), outcome }, t), 1100);
      setStep(6);
    });

  const lateEvent = (o: "succeeded" | "failed") =>
    run(() => act((s, t) => applyPaymentEvent(s, { bookingId: bookingId!, eventId: uid("evt"), outcome: o }, t), 900));

  const onDateChange = (v: string) => {
    if (!v) return setDateError("Choose a date.");
    if (v < today) return setDateError("That date has passed. Pick today or later.");
    if (v > maxDate) return setDateError("Bookings open up to 30 days ahead.");
    setDateError(null);
    setDate(v);
    setStartMin(null);
  };

  const canNext =
    (step === 0 && !!sportId && venuesFor(sportId).length > 0) ||
    (step === 1 && !!venueId) ||
    (step === 2 && !!resourceId) ||
    (step === 3 && startMin != null && slots.find((s) => s.startMin === startMin)?.reason === "available");

  const status = booking ? displayStatus(booking, now) : null;
  const title = step === 6 && status ? status : STEPS[step];

  return (
    <dialog
      ref={ref}
      className="dialog on-light"
      aria-labelledby="booking-title"
      onClose={close}
      onCancel={(e) => {
        if (busy) e.preventDefault();
      }}
    >
      <div className="dialog-head">
        <h2 id="booking-title">Book a slot</h2>
        <span className="badge on-dark badge-demo">Demo</span>
        <button type="button" className="icon-btn" onClick={close} aria-label="Close booking">
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path d="M3 3l12 12M15 3L3 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className="stepper" aria-hidden="true">
        {STEPS.map((s, i) => (
          <span key={s} className={i <= step ? "done" : ""} />
        ))}
      </div>

      <div className="dialog-body">
        <p className="eyebrow">
          Step {step + 1} of {STEPS.length} · {STEPS[step]}
        </p>
        <h3 className="step-title" tabIndex={-1} ref={heading}>
          {step === 0 && "Pick your sport"}
          {step === 1 && `Where do you want to play${sport ? ` ${sport.name.toLowerCase()}` : ""}?`}
          {step === 2 && `Choose your ${sport?.resourceNoun ?? "court"}`}
          {step === 3 && "Pick your time"}
          {step === 4 && "Review your booking"}
          {step === 5 && "Demo checkout"}
          {step === 6 && title}
        </h3>

        {error && (
          <div className="alert alert-error" role="alert">
            <strong>Heads up.</strong> {error}
          </div>
        )}

        {/* STEP 0 — sport */}
        {step === 0 && (
          <>
            <div className="choice-grid" role="radiogroup" aria-label="Sport">
              {SPORTS.map((s) => {
                const n = venuesFor(s.id).length;
                return (
                  <button
                    key={s.id}
                    type="button"
                    role="radio"
                    aria-checked={sportId === s.id}
                    className="choice"
                    onClick={() => {
                      setSportId(s.id);
                      setVenueId(null);
                      setResourceId(null);
                    }}
                  >
                    <span className="t">{s.name}</span>
                    <span className="m">{n ? `${n} venue${n > 1 ? "s" : ""}` : "No venues yet"}</span>
                  </button>
                );
              })}
            </div>
            {sportId && venuesFor(sportId).length === 0 && <NoVenues sportId={sportId} onJoin={(id) => act((s, t) => registerEvent(s, id, t)).then(() => toast("You're on the list for that session (demo)."))} />}
          </>
        )}

        {/* STEP 1 — venue */}
        {step === 1 && sportId && (
          <div className="choice-grid" role="radiogroup" aria-label="Venue">
            {venuesFor(sportId).map((v) => {
                const rs = v.resources.filter((r) => r.sports.includes(sportId));
                const from = Math.min(...rs.map((r) => r.hourlyRate));
                const vid = state && venuePlanById(state.venuePlans[v.id]).entitlements.videoPublishing && rs.some((r) => r.recordingCapable);
                return (
                  <button key={v.id} type="button" role="radio" aria-checked={venueId === v.id} className="choice wide" onClick={() => { setVenueId(v.id); setResourceId(null); }}>
                    <span className="t">{v.name}</span>
                    <span className="m">
                      {v.area} · {rs.length} {sport?.resourceNoun}
                      {rs.length > 1 ? "s" : ""} · from <span className="num">{formatPHP(from)}</span>/hr · open {formatTime(parseInt(v.open) * 60)}–{v.close}
                      {vid ? " · Recordings available" : ""}
                    </span>
                  </button>
                );
              })}
          </div>
        )}

        {/* STEP 2 — resource */}
        {step === 2 && venue && sportId && (
          <div className="choice-grid" role="radiogroup" aria-label={`${sport?.resourceNoun}s`}>
            {venue.resources
              .filter((r) => r.sports.includes(sportId))
              .map((r) => {
                const vid = state && r.recordingCapable && venuePlanById(state.venuePlans[venue.id]).entitlements.videoPublishing;
                return (
                  <button
                    key={r.id}
                    type="button"
                    role="radio"
                    aria-checked={resourceId === r.id}
                    className="choice wide"
                    onClick={() => {
                      setResourceId(r.id);
                      setDuration(r.minDurationMin);
                      setStartMin(null);
                    }}
                  >
                    <span className="t">{r.name}</span>
                    <span className="m">
                      {r.indoor ? "Indoor" : "Outdoor"} · {r.surface} · up to {r.capacity} players · <span className="num">{formatPHP(r.hourlyRate)}</span>/hr
                    </span>
                    <span className="m">
                      {vid ? "Recording available on eligible plans" : "No recording for this " + r.kind}
                      {r.sports.length > 1 ? ` · Shared ${r.sports.map((s) => sportById(s).name.toLowerCase()).join(" & ")} schedule` : ""}
                    </span>
                  </button>
                );
              })}
          </div>
        )}

        {/* STEP 3 — date, duration, start */}
        {step === 3 && venue && resource && (
          <>
            <div className="field-row">
              <div className="field">
                <label htmlFor="bk-date">Date</label>
                <input
                  id="bk-date"
                  className="input num"
                  type="date"
                  min={today}
                  max={maxDate}
                  value={date}
                  onChange={(e) => onDateChange(e.target.value)}
                  aria-invalid={!!dateError}
                  aria-describedby={dateError ? "bk-date-err" : "bk-date-hint"}
                />
                {dateError ? (
                  <span id="bk-date-err" className="field-error">{dateError}</span>
                ) : (
                  <span id="bk-date-hint" className="hint">{formatDate(date)} · times in Asia/Manila</span>
                )}
              </div>
              <div className="field">
                <span className="label" id="dur-label">Duration</span>
                <div className="mini-chips" role="radiogroup" aria-labelledby="dur-label" style={{ gap: 8 }}>
                  {durationOptions(resource).map((d) => (
                    <button key={d} type="button" role="radio" aria-checked={duration === d} className="chip" onClick={() => { setDuration(d); setStartMin(null); }}>
                      {formatDuration(d)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="mini-chips" style={{ gap: 6 }} aria-label="Quick dates">
              {Array.from({ length: 7 }).map((_, i) => {
                const d = addDays(today, i);
                return (
                  <button key={d} type="button" className="chip" aria-pressed={d === date} onClick={() => onDateChange(d)} style={{ minHeight: 40, fontSize: "0.85rem" }}>
                    {i === 0 ? "Today" : formatDate(d)}
                  </button>
                );
              })}
            </div>
            {!resource.indoor && (
              <div className="alert alert-warn">
                <span>Outdoor {resource.kind}. {resource.notes ?? "Weather may affect play."} Check the venue&apos;s cancellation policy for weather.</span>
              </div>
            )}
            <div>
              <div className="legend" style={{ marginBottom: 10 }}>
                <span><i style={{ background: "var(--lime)", borderColor: "var(--charcoal)" }} />Selected</span>
                <span><i />Available</span>
                <span><i style={{ background: "repeating-linear-gradient(-45deg,var(--hatch-a) 0 3px,var(--line-light) 3px 6px)" }} />Booked / maintenance / passed</span>
              </div>
              {slotsLoading ? (
                <div className="alert alert-info" role="status"><span className="spinner" /> Checking live availability…</div>
              ) : slots.some((s) => s.reason === "available") ? (
                <div className="slot-grid" role="radiogroup" aria-label={`Start times on ${formatDate(date)}`}>
                  {slots.map((s) => (
                    <button
                      key={s.startMin}
                      type="button"
                      role="radio"
                      className="chip"
                      aria-checked={startMin === s.startMin}
                      disabled={s.reason !== "available"}
                      aria-label={`${formatRange(s.startMin, s.endMin)} — ${SLOT_REASON[s.reason]}`}
                      title={SLOT_REASON[s.reason]}
                      onClick={() => setStartMin(s.startMin)}
                    >
                      {formatTime(s.startMin)}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="empty">
                  <p><strong>No {formatDuration(duration)} slots left on {formatDate(date)}.</strong></p>
                  <p style={{ marginTop: 6 }}>Try a shorter duration or another day.</p>
                  {date < maxDate && (
                    <button type="button" className="btn btn-sm btn-dark" style={{ marginTop: 12 }} onClick={() => onDateChange(addDays(date, 1))}>
                      Check {formatDate(addDays(date, 1))}
                    </button>
                  )}
                </div>
              )}
              {resource.bufferMin > 0 && <p className="hint" style={{ marginTop: 10 }}>This {resource.kind} keeps a {resource.bufferMin}-minute setup buffer between bookings.</p>}
            </div>
          </>
        )}

        {/* STEP 4 — review */}
        {step === 4 && venue && resource && price && startMin != null && sportId && (
          <>
            <div className="panel">
              <dl className="kv">
                <dt>Sport</dt><dd>{sport?.name}</dd>
                <dt>Venue</dt><dd>{venue.name} · {venue.area}</dd>
                <dt>{sport?.resourceNoun === "table" ? "Table" : sport?.resourceNoun === "pitch" ? "Pitch" : "Court"}</dt><dd>{resource.name}</dd>
                <dt>Details</dt><dd>{resource.indoor ? "Indoor" : "Outdoor"} · {resource.surface} · up to {resource.capacity}</dd>
                <dt>When</dt><dd>{formatDate(date)} · {formatRange(startMin, startMin + duration)}</dd>
                <dt>Recording</dt><dd>{videoAvailable ? "Available — venue publishes clips to eligible members" : "Not available for this booking"}</dd>
              </dl>
            </div>
            {venue.equipment.some((e) => !e.sports || e.sports.includes(sportId)) && (
              <fieldset className="panel" style={{ margin: 0 }}>
                <legend className="label" style={{ fontWeight: 700, padding: "0 4px" }}>Equipment (optional)</legend>
                {venue.equipment
                  .filter((e) => !e.sports || e.sports.includes(sportId))
                  .map((e) => (
                    <label key={e.id} className="check">
                      <input
                        type="checkbox"
                        checked={equipment.includes(e.id)}
                        onChange={(ev) => setEquipment((cur) => (ev.target.checked ? [...cur, e.id] : cur.filter((x) => x !== e.id)))}
                      />
                      <span style={{ flex: 1 }}>{e.label}</span>
                      <span className="num">{formatPHP(e.price)}</span>
                    </label>
                  ))}
              </fieldset>
            )}
            <PriceBox price={price} />
            <div className="alert alert-info">
              <span><strong>Cancellation:</strong> {venue.cancellationPolicy}</span>
            </div>
            {videoAvailable && (
              <p className="hint">Highlights need a Replay or Replay Plus membership, footage published by the venue, and you being an authorised participant. Memberships are separate from court rental.</p>
            )}
            <details className="panel">
              <summary style={{ cursor: "pointer", fontWeight: 700 }}>Demo controls</summary>
              <label className="check">
                <input type="checkbox" checked={simulateTaken} onChange={(e) => setSimulateTaken(e.target.checked)} />
                Simulate another player booking this slot first
              </label>
            </details>
          </>
        )}

        {/* STEP 5 — checkout */}
        {step === 5 && booking && (
          <>
            <div className="sim-banner" role="note">
              <span aria-hidden="true">⚠</span> Simulated checkout. No real payment is taken — never enter card details here.
            </div>
            <div className="panel">
              <div className="receipt">
                <div className="line"><span>{booking.ref} · {resourceById(booking.resourceId).name}</span><span /></div>
                <div className="line"><span>{formatDate(booking.date)} · {formatRange(booking.startMin, booking.endMin)}</span></div>
                <div className="line total"><span>Pay now{booking.price.depositPercent ? ` (${booking.price.depositPercent}% deposit)` : ""}</span><span>{formatPHP(booking.price.dueNow)}</span></div>
                {booking.price.balance > 0 && <div className="line"><span>Balance at venue</span><span>{formatPHP(booking.price.balance)}</span></div>}
              </div>
              <p className="hint">
                Slot held for <Countdown until={booking.holdExpiresAt} now={now} />. Booking status: <strong>{displayStatus(booking, now)}</strong> · Payment: <strong>{booking.payment.status.replace("_", " ")}</strong>
              </p>
            </div>
            <fieldset className="panel" style={{ margin: 0 }}>
              <legend className="label" style={{ fontWeight: 700, padding: "0 4px" }}>Demo payment outcome</legend>
              {(
                [
                  ["succeeded", "Payment succeeds"],
                  ["pending", "Payment stays pending"],
                  ["failed", "Payment fails"],
                ] as const
              ).map(([v, l]) => (
                <label key={v} className="check">
                  <input type="radio" name="outcome" value={v} checked={outcome === v} onChange={() => setOutcome(v)} />
                  {l}
                </label>
              ))}
            </fieldset>
          </>
        )}
        {step === 5 && !booking && state && <div className="alert alert-error" role="alert">This hold is no longer available. Please pick a time again.</div>}

        {/* STEP 6 — result */}
        {step === 6 && booking && <Result booking={booking} status={status!} now={now} busy={busy} onLate={lateEvent} onRetry={() => go(5)} onCancel={() => run(() => act((s, t) => cancelBooking(s, booking.id, "player", t)))} inviteName={inviteName} setInviteName={setInviteName} onInvite={() => run(async () => { await act((s) => invite(s, booking.id, inviteName)); setInviteName(""); toast("Invite sent (demo). Invites don't include recording access."); })} onAnother={() => { setStartMin(null); setBookingId(null); go(3); }} />}
      </div>

      {step < 6 && (
        <div className="dialog-foot">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => (step === 0 ? close() : go((step - 1) as Step))} disabled={busy || step === 5}>
            {step === 0 ? "Cancel" : "Back"}
          </button>
          {step <= 3 && (
            <button type="button" className="btn btn-sm btn-dark" disabled={!canNext} onClick={() => go((step + 1) as Step)}>
              Continue
            </button>
          )}
          {step === 4 && (
            <button type="button" className="btn btn-sm" onClick={placeHold} disabled={busy}>
              {busy ? <><span className="spinner" /> Holding slot…</> : "Hold slot & check out"}
            </button>
          )}
          {step === 5 && booking && (
            <button type="button" className="btn btn-sm" onClick={pay} disabled={busy || displayStatus(booking, now) === "Hold expired"}>
              {busy ? <><span className="spinner" /> Processing…</> : `Pay ${formatPHP(booking.price.dueNow)} (demo)`}
            </button>
          )}
        </div>
      )}
    </dialog>
  );
}

function PriceBox({ price }: { price: ReturnType<typeof priceFor> }) {
  return (
    <div className="panel">
      <div className="receipt">
        <div className="line"><span>Court/table rental</span><span>{formatPHP(price.rental)}</span></div>
        {price.equipment.map((e) => (
          <div key={e.id} className="line"><span>{e.label}</span><span>{formatPHP(e.price)}</span></div>
        ))}
        <div className="line total"><span>Total</span><span>{formatPHP(price.subtotal)}</span></div>
        <div className="line"><span>{price.depositPercent ? `Pay now (${price.depositPercent}% deposit)` : "Pay now (full amount)"}</span><span>{formatPHP(price.dueNow)}</span></div>
        {price.balance > 0 && <div className="line"><span>Remaining balance at venue</span><span>{formatPHP(price.balance)}</span></div>}
      </div>
      <p className="hint">Player memberships are billed separately and are not included here.</p>
    </div>
  );
}

function NoVenues({ sportId, onJoin }: { sportId: SportId; onJoin: (eventId: string) => void }) {
  const events = EVENTS.filter((e) => e.sportId === sportId);
  const s = sportById(sportId);
  return (
    <div className="empty" style={{ textAlign: "left" }}>
      <p><strong>No venues offer {s.name.toLowerCase()} rental on Playbook yet.</strong> We&apos;re adding venues across Metro Manila.</p>
      {events.length > 0 && (
        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          <p>Open sessions you can join (pay per player — not a full {s.resourceNoun} rental):</p>
          {events.map((e) => (
            <div key={e.id} className="option">
              <div>
                <div className="t">{e.title}</div>
                <div className="m">{venueById(e.venueId).name} · {formatDate(addDays(manilaToday(), e.dayOffset))} · {formatRange(e.startMin, e.endMin)} · {formatPHP(e.feePerPlayer)}/player</div>
              </div>
              <button type="button" className="btn btn-xs btn-dark" onClick={() => onJoin(e.id)}>Join session</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Result({
  booking, status, now, busy, onLate, onRetry, onCancel, inviteName, setInviteName, onInvite, onAnother,
}: {
  booking: Booking;
  status: ReturnType<typeof displayStatus>;
  now: number;
  busy: boolean;
  onLate: (o: "succeeded" | "failed") => void;
  onRetry: () => void;
  onCancel: () => void;
  inviteName: string;
  setInviteName: (s: string) => void;
  onInvite: () => void;
  onAnother: () => void;
}) {
  const r = resourceById(booking.resourceId);
  const v = venueById(booking.venueId);
  const summary = (
    <dl className="kv panel">
      <dt>Reference</dt><dd>{booking.ref}</dd>
      <dt>Where</dt><dd>{v.name} · {r.name}</dd>
      <dt>When</dt><dd>{formatDate(booking.date)} · {formatRange(booking.startMin, booking.endMin)}</dd>
      <dt>Booking</dt><dd>{status}</dd>
      <dt>Payment</dt><dd>{booking.payment.status.replace("_", " ")} · {formatPHP(booking.payment.amountPaid)} paid</dd>
      {booking.price.balance > 0 && booking.status === "confirmed" && (<><dt>At venue</dt><dd>{formatPHP(booking.price.balance)}</dd></>)}
    </dl>
  );

  if (status === "Confirmed") {
    return (
      <>
        <div className="confirm-hero" role="status">
          <span className="badge badge-ok">Booking confirmed</span>
          <span className="ref">{booking.ref}</span>
          <span className="hint">It&apos;s in My bookings and on the venue&apos;s calendar.</span>
        </div>
        {summary}
        <div className="panel">
          <label htmlFor="inv" className="label" style={{ fontWeight: 700 }}>Invite your squad</label>
          <div className="inline-form">
            <input id="inv" className="input" placeholder="Friend's name" value={inviteName} onChange={(e) => setInviteName(e.target.value)} maxLength={40} />
            <button type="button" className="btn btn-sm btn-dark" onClick={onInvite} disabled={busy || !inviteName.trim()}>Send invite</button>
          </div>
          <p className="hint">Invited: {booking.participants.filter((p) => p.role === "invitee").map((p) => p.name).join(", ") || "nobody yet"}. Invitations never include recording access — you choose that later.</p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link className="btn btn-sm btn-dark" href="/demo?role=player">My bookings</Link>
          <Link className="btn btn-sm btn-ghost" href="/demo?role=venue">See venue calendar</Link>
          <button type="button" className="btn btn-sm btn-ghost" onClick={onAnother}>Book another time</button>
        </div>
      </>
    );
  }
  if (status === "Awaiting payment") {
    return (
      <>
        <div className="alert alert-warn" role="status">
          <span><strong>Not confirmed yet.</strong> We&apos;re waiting for the payment provider. Your slot is held for <Countdown until={booking.holdExpiresAt} now={now} />. If payment confirms after the hold expires and someone else has booked, you&apos;ll be refunded.</span>
        </div>
        {summary}
        <div className="panel">
          <span className="label" style={{ fontWeight: 700 }}>Demo: simulate the provider&apos;s webhook</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-sm btn-dark" disabled={busy} onClick={() => onLate("succeeded")}>Payment confirmed</button>
            <button type="button" className="btn btn-sm btn-ghost" disabled={busy} onClick={() => onLate("failed")}>Payment failed</button>
          </div>
        </div>
      </>
    );
  }
  if (status === "Payment failed") {
    return (
      <>
        <div className="alert alert-error" role="alert">
          <span><strong>Payment failed.</strong> Nothing was charged. Your slot is still held for <Countdown until={booking.holdExpiresAt} now={now} />.</span>
        </div>
        {summary}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="btn btn-sm" onClick={onRetry}>Try payment again</button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={onCancel} disabled={busy}>Release this slot</button>
        </div>
      </>
    );
  }
  return (
    <>
      <div className={`alert ${status === "Refund due" ? "alert-warn" : "alert-info"}`} role="status">
        <span>
          {status === "Refund due" && "Your payment arrived after the hold expired and the slot was booked by someone else. The booking was not confirmed and a refund is due."}
          {status === "Hold expired" && "The 10-minute hold expired before payment completed. The slot has been released."}
          {status === "Cancelled" && (booking.cancellation?.note ?? "This hold was released.")}
        </span>
      </div>
      {summary}
      <button type="button" className="btn btn-sm btn-dark" onClick={onAnother}>Pick another time</button>
    </>
  );
}
