"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { COPY } from "@/content/copy";
import { FAQ } from "@/content/faq";
import { PLAYER_PLANS, PRICE_TBA, VENUE_PLANS, venuePlanById } from "@/content/plans";
import { SPORTS, sportById } from "@/content/sports";
import { EVENTS, VENUES } from "@/content/venues";
import { isBlocking } from "@/lib/booking/rules";
import { addDays, formatDate, formatPHP, formatRange, manilaToday, parseHM } from "@/lib/booking/time";
import type { ClipKind, SportId } from "@/lib/booking/types";
import { useDemo } from "@/lib/demo/DemoProvider";
import { registerEvent, setPlayerPlan, setVenuePlan } from "@/lib/demo/state";
import { useBooking } from "@/lib/ui/BookingLauncher";
import { useToast } from "@/lib/ui/Toast";
import { CalendarArt, InviteArt, LedgerArt, LibraryArt, PriceArt, VenueCalArt } from "../art/FeatureArt";
import { SportArt } from "../art/SportArt";
import { HighlightPlayer } from "../media/HighlightPlayer";

/* ------------------------------------------------------------ sports */
export function SportsSection() {
  const [selected, setSelected] = useState<SportId | null>(null);
  const { open } = useBooking();
  const { act, state } = useDemo();
  const toast = useToast();

  const resources = (id: SportId) => VENUES.flatMap((v) => v.resources.filter((r) => r.sports.includes(id)).map((r) => ({ v, r })));

  return (
    <section id="sports" className="section light" aria-labelledby="sports-title">
      <div className="container">
        <div className="section-head">
          <div>
            <p className="eyebrow">Sports</p>
            <h2 id="sports-title">{COPY.sports.heading}</h2>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            <p>{COPY.sports.body}</p>
            <span className="demo-note"><span className="badge badge-demo">Demo</span> Availability reflects sample venues.</span>
          </div>
        </div>
        <div className="sports-grid">
          {SPORTS.map((s) => {
            const n = resources(s.id).length;
            const ev = EVENTS.filter((e) => e.sportId === s.id).length;
            return (
              <button
                key={s.id}
                type="button"
                className={`sport-card ${s.featured ? "featured" : ""}`}
                aria-expanded={selected === s.id}
                aria-controls="sport-panel"
                onClick={() => {
                  setSelected(s.id);
                  requestAnimationFrame(() => document.getElementById("sport-panel")?.scrollIntoView({ block: "nearest" }));
                }}
              >
                <span className="art"><SportArt sport={s.id} /></span>
                <span className="avail">
                  {n > 0 ? (
                    <span className="badge badge-lime">{n} to rent</span>
                  ) : ev > 0 ? (
                    <span className="badge badge-orange">Sessions only</span>
                  ) : (
                    <span className="badge on-dark">Coming soon</span>
                  )}
                </span>
                <h3>{s.name}</h3>
                <p>{s.tagline}</p>
                <span className="go" aria-hidden="true">See availability →</span>
                <span className="sr-only">{s.visual}</span>
              </button>
            );
          })}
          <a href="#venues" className="sport-card sport-cta">
            <span className="avail"><span className="badge badge-lime">For venues</span></span>
            <h3>Run courts or tables?</h3>
            <p>List your venue, manage bookings and payments, and publish game recordings.</p>
            <span className="go">Explore venue tools →</span>
          </a>
        </div>

        <div id="sport-panel" aria-live="polite">
          {selected && (
            <div className="sport-panel">
              <div className="section-head" style={{ marginBottom: 8 }}>
                <h3>{sportById(selected).name}</h3>
                {resources(selected).length > 0 && (
                  <button type="button" className="btn btn-dark btn-sm" onClick={() => open({ sportId: selected })}>
                    Book {sportById(selected).name.toLowerCase()}
                  </button>
                )}
              </div>
              <p className="eyebrow" style={{ marginTop: 12 }}>Rent a whole {sportById(selected).resourceNoun}</p>
              {resources(selected).length ? (
                <div className="option-list">
                  {resources(selected).map(({ v, r }) => (
                    <div key={r.id} className="option">
                      <div>
                        <div className="t">{r.name} · {v.name}</div>
                        <div className="m">
                          {v.area} · {r.indoor ? "Indoor" : "Outdoor"} · {r.surface} · up to {r.capacity} · <span className="num">{formatPHP(r.hourlyRate)}</span>/hr
                          {r.sports.length > 1 ? " · shared court" : ""}
                        </div>
                      </div>
                      <button type="button" className="btn btn-xs" onClick={() => open({ sportId: selected, venueId: v.id, resourceId: r.id })}>
                        Check times
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty" style={{ marginTop: 12 }}>
                  No venues offer {sportById(selected).name.toLowerCase()} rental on Playbook yet. We&apos;re adding venues — check back soon.
                </div>
              )}
              <p className="eyebrow" style={{ marginTop: 24 }}>Join an open session (pay per player)</p>
              {EVENTS.filter((e) => e.sportId === selected).length ? (
                <div className="option-list">
                  {EVENTS.filter((e) => e.sportId === selected).map((e) => {
                    const joined = state?.eventRegistrations.some((x) => x.eventId === e.id);
                    return (
                      <div key={e.id} className="option">
                        <div>
                          <div className="t">{e.title} · {VENUES.find((v) => v.id === e.venueId)!.name}</div>
                          <div className="m">
                            {formatDate(addDays(manilaToday(), e.dayOffset))} · {formatRange(e.startMin, e.endMin)} · {e.level} · <span className="num">{formatPHP(e.feePerPlayer)}</span>/player · {e.spots} spots
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-xs btn-dark"
                          disabled={joined}
                          onClick={() => act((s, t) => registerEvent(s, e.id, t)).then(() => toast("You're on the list (demo). Pay at the venue."))}
                        >
                          {joined ? "Joined" : "Join session"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="hint" style={{ marginTop: 8 }}>No open sessions scheduled.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ features */
const FEATURES = [
  { who: "Players", title: "Your time, secured.", body: "Pick a named court and an exact start and end time. Holds prevent double-booking.", Art: CalendarArt },
  { who: "Players", title: "Know what you're paying.", body: "Rental, equipment, deposit and balance — shown before you pay.", Art: PriceArt },
  { who: "Players", title: "Bring everyone into the game.", body: "Invite your squad from the booking. Recording access stays your call.", Art: InviteArt },
  { who: "Players", title: "Your moments, ready to replay.", body: "Clips from participating venues land in your private library.", Art: LibraryArt },
  { who: "Venues", title: "One view of the whole venue.", body: "Every court, table and pitch — bookings, holds and maintenance together.", Art: VenueCalArt },
  { who: "Venues", title: "Keep payments in view.", body: "Deposits, balances, pending and failed payments with clear statuses.", Art: LedgerArt },
];

export function FeaturesSection() {
  return (
    <section className="section paper" aria-labelledby="features-title">
      <div className="container">
        <div className="section-head">
          <div>
            <p className="eyebrow">How it works</p>
            <h2 id="features-title">Less group-chat chaos. More game time.</h2>
          </div>
          <span className="demo-note"><span className="badge badge-demo">Demo data</span> Previews use the same sample venue.</span>
        </div>
        <div className="feature-grid">
          {FEATURES.map(({ who, title, body, Art }) => (
            <article key={title} className="feature">
              <div className="fig"><Art /></div>
              <div className="body">
                <p className="who">For {who.toLowerCase()}</p>
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ venues */
export function VenueDiscovery() {
  const { open } = useBooking();
  const { state } = useDemo();
  return (
    <section id="discover" className="section light" aria-labelledby="disc-title">
      <div className="container">
        <div className="section-head">
          <div>
            <p className="eyebrow">Venues</p>
            <h2 id="disc-title">{COPY.venuesDiscovery.heading}</h2>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            <p>{COPY.venuesDiscovery.body}</p>
            <span className="demo-note"><span className="badge badge-demo">Demo data</span> Fictional venues and prices.</span>
          </div>
        </div>
        <div className="venue-grid">
          {VENUES.map((v) => {
            const video = state ? venuePlanById(state.venuePlans[v.id]).entitlements.videoPublishing : false;
            return (
              <article key={v.id} className="venue-card">
                <div>
                  <h3>{v.name}</h3>
                  <p className="loc">{v.area} · Open {v.open}–{v.close} · {v.depositPercent ? `${v.depositPercent}% deposit` : "Pay in full"}</p>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {v.amenities.slice(0, 4).map((a) => <span key={a} className="badge">{a}</span>)}
                  {video && <span className="badge badge-lime">Recordings</span>}
                </div>
                <ul className="res-list">
                  {v.resources.slice(0, 4).map((r) => (
                    <li key={r.id}>
                      <span className="name">{r.name}</span>
                      <span className="num">{formatPHP(r.hourlyRate)}/hr</span>
                      <span className="det">
                        {r.sports.map((s) => sportById(s).name).join(" · ")} · {r.indoor ? "Indoor" : "Outdoor"} · {r.surface} · up to {r.capacity}
                        {video && r.recordingCapable ? " · camera" : ""}
                      </span>
                    </li>
                  ))}
                  {v.resources.length > 4 && <li><span className="det">+{v.resources.length - 4} more</span></li>}
                </ul>
                <div className="actions">
                  <button type="button" className="btn btn-sm btn-dark" onClick={() => open({ venueId: v.id })}>Book here</button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ highlights */
const LIB: { kind: ClipKind; title: string; meta: string; length: number; sport: SportId }[] = [
  { kind: "basketball", title: "Fast break and-one", meta: "Court A · Kalye Court Hub", length: 18, sport: "basketball" },
  { kind: "rally", title: "Twenty-shot rally", meta: "Padel Court 1 · Rally Point", length: 32, sport: "padel" },
  { kind: "billiards", title: "Bank shot to win the rack", meta: "Table 1 · Cue & Co.", length: 12, sport: "billiards" },
];

export function HighlightsSection() {
  const [i, setI] = useState(0);
  const clip = LIB[i];
  const states = [
    ["Ready", "badge-ok"], ["Processing", "badge-warn"], ["Awaiting upload", "badge-warn"], ["Not recorded", "badge-muted"],
    ["Restricted by plan", "badge-muted"], ["Failed", "badge-bad"], ["Expired", "badge-muted"],
  ];
  return (
    <section id="highlights" className="section dark" aria-labelledby="hl-title">
      <div className="container">
        <div className="section-head">
          <div>
            <p className="eyebrow">Highlights</p>
            <h2 id="hl-title">{COPY.highlights.heading}</h2>
          </div>
          <p>{COPY.highlights.body}</p>
        </div>
        <div className="highlights-grid">
          <HighlightPlayer kind={clip.kind} title={clip.title} length={clip.length} />
          <div>
            <p className="eyebrow" style={{ marginBottom: 10 }}>Your library · demo</p>
            <div className="library">
              {LIB.map((c, k) => (
                <button key={c.title} type="button" className="lib-item" aria-pressed={k === i} onClick={() => setI(k)}>
                  <span className="thumb"><SportArt sport={c.sport} idSuffix={`-lib${k}`} /></span>
                  <span>
                    <span className="t" style={{ display: "block" }}>{c.title}</span>
                    <span className="m">{c.meta} · 0:{String(c.length).padStart(2, "0")}</span>
                  </span>
                </button>
              ))}
            </div>
            <div className="alert alert-info" style={{ marginTop: 14 }}>
              <span>Clips are private by default. Only authorised participants of the booking can view them, and sharing is controlled by the booking owner.</span>
            </div>
          </div>
        </div>
        <ol className="rules" aria-label="When a recording is available">
          <li><strong>The venue records</strong>Video publishing is on for the venue, and a camera covers your court or table.</li>
          <li><strong>Footage is published</strong>Staff upload footage for your booking and publish clips.</li>
          <li><strong>You&apos;re authorised</strong>You&apos;re the booking owner or they granted you access. Invites alone don&apos;t.</li>
          <li><strong>Your plan includes it</strong>Replay or Replay Plus. Downloads need Replay Plus.</li>
        </ol>
        <div className="states" aria-label="Clip states you might see">
          {states.map(([l, c]) => <span key={l} className={`badge ${c}`}>{l}</span>)}
        </div>
        <p className="hint" style={{ marginTop: 14, color: "var(--muted-dark)" }}>A membership can&apos;t create footage that was never recorded. Each state explains why a clip isn&apos;t available.</p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ for venues */
export function ForVenuesSection() {
  const { state, now } = useDemo();
  const today = manilaToday(now);
  const venue = VENUES[0];
  const open = parseHM(venue.open);
  const close = parseHM(venue.close);
  const span = close - open;
  const rows = useMemo(() => {
    if (!state) return [];
    return [...venue.resources, ...VENUES[2].resources.slice(0, 2)].map((r) => ({
      r,
      blocks: [
        ...state.bookings.filter((b) => b.resourceId === r.id && b.date === today && isBlocking(b, now)).map((b) => ({ s: b.startMin, e: b.endMin, k: b.status === "held" ? "held" : "confirmed", mine: b.ownerId === "demo-player" })),
        ...state.maintenance.filter((m) => m.resourceId === r.id && m.date === today).map((m) => ({ s: m.startMin, e: m.endMin, k: "maint", mine: false })),
      ],
    }));
  }, [state, today, now, venue]);
  const ledger = useMemo(() => (state ? state.bookings.filter((b) => b.venueId === "kalye" && b.date >= today).slice(0, 5) : []), [state, today]);

  return (
    <section id="venues" className="section dark" aria-labelledby="fv-title" style={{ borderTop: "1px solid var(--line-dark)" }}>
      <div className="container">
        <div className="section-head">
          <div>
            <p className="eyebrow">For venues</p>
            <h2 id="fv-title">{COPY.forVenues.heading}</h2>
          </div>
          <div style={{ display: "grid", gap: 14 }}>
            <p>{COPY.forVenues.body}</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link href="/demo?role=venue" className="btn btn-sm">{COPY.forVenues.cta}</Link>
              <a href="#plans" className="btn btn-sm btn-ghost">Venue plans</a>
            </div>
          </div>
        </div>
        <div className="venue-tools">
          <div className="tool-card">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <h3>Today&apos;s schedule</h3>
              <span className="badge on-dark badge-demo">Live demo data</span>
            </div>
            <div className="cal-mini" role="img" aria-label="Today's bookings, holds and maintenance across sample resources">
              {rows.map(({ r, blocks }) => (
                <div key={r.id} className="cal-row">
                  <span>{r.name.split(" · ")[0]}</span>
                  <div className="lane">
                    {blocks.map((b, i) => (
                      <span key={i} className={`blk ${b.k} ${b.mine ? "mine" : ""}`} style={{ left: `${(Math.max(0, b.s - open) / span) * 100}%`, width: `${((b.e - b.s) / span) * 100}%` }}>
                        {b.k === "maint" ? "Maint." : ""}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              {!state && <div className="empty">Loading schedule…</div>}
            </div>
            <p className="hint" style={{ color: "var(--muted-dark)" }}>Bookings made in the demo booking flow appear here instantly.</p>
          </div>
          <div className="tool-stack">
            <div className="tool-card">
              <h3>Payments</h3>
              <table className="ledger">
                <thead><tr><th scope="col">Ref</th><th scope="col">Paid</th><th scope="col">Status</th></tr></thead>
                <tbody>
                  {ledger.map((b) => (
                    <tr key={b.id}>
                      <td>{b.ref}</td>
                      <td>{formatPHP(b.payment.amountPaid)}</td>
                      <td>{b.payment.status.replace("_", " ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="tool-card">
              <h3>Publish recordings</h3>
              <ol className="workflow">
                <li><span className="n">1</span><span><b>Upload or import</b> exported CCTV or camera files.</span></li>
                <li><span className="n">2</span><span><b>Link</b> them to a completed booking and court.</span></li>
                <li><span className="n">3</span><span><b>Cut or supply</b> the clip.</span></li>
                <li><span className="n">4</span><span><b>Publish</b> to eligible participants only.</span></li>
              </ol>
              <p className="hint" style={{ color: "var(--muted-dark)" }}>Live camera connections and automatic highlight detection are planned, not part of this demo.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ plans */
export function PlansSection() {
  const [tab, setTab] = useState<"players" | "venues">("players");
  const { state, act } = useDemo();
  const toast = useToast();
  const plans = tab === "players" ? PLAYER_PLANS : VENUE_PLANS;
  return (
    <section id="plans" className="section light" aria-labelledby="plans-title">
      <div className="container">
        <div className="section-head">
          <div>
            <p className="eyebrow">Plans</p>
            <h2 id="plans-title">{COPY.plans.heading}</h2>
          </div>
          <p>{COPY.plans.body}</p>
        </div>
        <div className="tabs" role="tablist" aria-label="Plan audience">
          {(["players", "venues"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              id={`tab-${t}`}
              aria-selected={tab === t}
              aria-controls="plans-panel"
              tabIndex={tab === t ? 0 : -1}
              onClick={() => setTab(t)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                  const next = tab === "players" ? "venues" : "players";
                  setTab(next);
                  document.getElementById(`tab-${next}`)?.focus();
                }
              }}
            >
              For {t}
            </button>
          ))}
        </div>
        <div id="plans-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
          <div className="plan-grid">
            {plans.map((p) => {
              const current = tab === "players" ? state?.playerPlan === p.id : state?.venuePlans.kalye === p.id;
              return (
                <article key={p.id} className={`plan ${current ? "is-current" : ""}`}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <h3>{p.name}</h3>
                    {current && <span className="badge badge-lime">Demo: current</span>}
                  </div>
                  <p>{p.summary}</p>
                  <p className="price">{p.price ?? PRICE_TBA}</p>
                  <ul>
                    {p.benefits.map((b) => <li key={b}>{b}</li>)}
                  </ul>
                  <button
                    type="button"
                    className={`btn btn-sm ${current ? "btn-ghost" : "btn-dark"}`}
                    disabled={!state || current}
                    onClick={() =>
                      act((s) => (tab === "players" ? setPlayerPlan(s, p.id as never) : setVenuePlan(s, "kalye", p.id as never)), 250).then(() =>
                        toast(tab === "players" ? `Demo player plan set to ${p.name}. Venue plans unchanged.` : `Demo: Kalye Court Hub is now on ${p.name}. Your player plan is unchanged.`),
                      )
                    }
                  >
                    {current ? "Selected (demo)" : `Choose ${p.name} (demo)`}
                  </button>
                </article>
              );
            })}
          </div>
        </div>
        <p className="plan-note">
          {tab === "players"
            ? "Proposed plan names and benefits. Final prices, limits and allowances will be announced. Court and table rental is always charged separately. Highlights also depend on the venue recording and publishing your game."
            : "Proposed plan names and benefits. Final prices and configured limits will be announced. Venue subscriptions are separate from player memberships — changing one never changes the other."}{" "}
          <span className="badge badge-demo">Demo selection</span>
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ FAQ */
export function FAQSection() {
  return (
    <section id="faq" className="section paper" aria-labelledby="faq-title">
      <div className="container">
        <div className="section-head">
          <div>
            <p className="eyebrow">FAQ</p>
            <h2 id="faq-title">Good questions.</h2>
          </div>
        </div>
        <div className="faq">
          {FAQ.map((f) => (
            <details key={f.q}>
              <summary>
                <span><span className="topic">{f.topic}</span>{f.q}</span>
              </summary>
              <p className="a">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

