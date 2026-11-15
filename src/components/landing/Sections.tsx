"use client";
import Link from "next/link";
import { useState } from "react";
import { COPY } from "@/content/copy";
import { FAQ } from "@/content/faq";
import { HIGHLIGHTS, clipTime } from "@/content/highlights";
import Image from "next/image";
import { SPORTS, SPORT_PHOTOS, sportById } from "@/content/sports";
import { formatPHP } from "@/lib/booking/time";
import { useLiveVenues } from "@/lib/ui/useLiveVenues";
import { CalendarArt, LedgerArt, PriceArt, VenueCalArt } from "../art/FeatureArt";
import { SportArt } from "../art/SportArt";
import { ClipPlayer } from "../media/HighlightPlayer";

/* ------------------------------------------------------------ sports */
export function SportsSection() {
  const venues = useLiveVenues();
  const count = (id: string) => (venues ?? []).filter((v) => v.sports.includes(id)).length;

  return (
    <section id="sports" className="section light" aria-labelledby="sports-title">
      <div className="container">
        <div className="section-head">
          <div>
            <p className="eyebrow">Sports</p>
            <h2 id="sports-title">{COPY.sports.heading}</h2>
          </div>
          <p>{COPY.sports.body}</p>
        </div>
        <div className="sports-grid">
          {SPORTS.map((s) => {
            const n = count(s.id);
            return (
              <Link key={s.id} href={`/venues?sport=${s.id}`} className={`sport-card ${s.featured ? "featured" : ""} ${SPORT_PHOTOS[s.id] ? "has-photo" : ""}`}>
                <span className="art">
                  {SPORT_PHOTOS[s.id] ? (
                    <Image
                      src={SPORT_PHOTOS[s.id]!.src}
                      alt=""
                      fill
                      sizes={s.featured ? "(max-width: 1020px) 100vw, 50vw" : "(max-width: 1020px) 50vw, 25vw"}
                      style={{
                        objectFit: "cover",
                        objectPosition: SPORT_PHOTOS[s.id]!.position ?? "center",
                        transform: `scale(${SPORT_PHOTOS[s.id]!.zoom ?? 1})`,
                        transformOrigin: "50% 100%",
                      }}
                    />
                  ) : (
                    <SportArt sport={s.id} />
                  )}
                </span>
                {SPORT_PHOTOS[s.id]?.illustrative && <span className="illustrative" aria-hidden="true">Illustrative</span>}
                <span className="avail">
                  {venues === null ? null : n > 0 ? (
                    <span className="badge badge-lime">{n} {n === 1 ? "venue" : "venues"}</span>
                  ) : (
                    <span className="badge on-dark">Coming soon</span>
                  )}
                </span>
                <h3>{s.name}</h3>
                <p>{s.tagline}</p>
                <span className="go" aria-hidden="true">{n > 0 ? "See availability →" : "See venues →"}</span>
                <span className="sr-only">{s.visual}</span>
              </Link>
            );
          })}
          <Link href="/venue/new" className="sport-card sport-cta">
            <span className="avail"><span className="badge badge-lime">For venues</span></span>
            <h3>Run courts or tables?</h3>
            <p>List your venue for free, take bookings and run open play with automatic matchmaking.</p>
            <span className="go">List your venue →</span>
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ features */
const FEATURES = [
  { who: "Players", title: "Your time, secured.", body: "Pick a named court and an exact start and end time. A 10-minute hold keeps it yours while you confirm.", Art: CalendarArt },
  { who: "Players", title: "Know what you\u2019re paying.", body: "Court, rentals, deposit and balance, shown before you pay. You pay the venue directly.", Art: PriceArt },
  { who: "Venues", title: "One view of the whole venue.", body: "Every court, table and pitch: bookings, walk-ins and maintenance blocks together.", Art: VenueCalArt },
  { who: "Venues", title: "Keep payments in view.", body: "Cash and online payments recorded per player, with a beep when an online payment lands.", Art: LedgerArt },
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
          <p>Book a court for your group, or join open play and get matched with players of your level. Screens shown are illustrations.</p>
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
  const venues = useLiveVenues();
  return (
    <section id="discover" className="section light" aria-labelledby="disc-title">
      <div className="container">
        <div className="section-head">
          <div>
            <p className="eyebrow">Venues</p>
            <h2 id="disc-title">{COPY.venuesDiscovery.heading}</h2>
          </div>
          <p>{COPY.venuesDiscovery.body}</p>
        </div>
        {venues === null ? (
          <p className="hint">Loading venues…</p>
        ) : venues.length === 0 ? (
          <div className="venue-card">
            <h3>Venues are joining Playbook</h3>
            <p className="loc">The first venues are being set up. Run courts, tables or pitches? Listing is free.</p>
            <div className="actions"><Link href="/venue/new" className="btn btn-sm btn-dark">List your venue</Link></div>
          </div>
        ) : (
          <>
            <div className="venue-grid">
              {venues.slice(0, 6).map((v) => (
                <article key={v.slug} className="venue-card">
                  <div>
                    <h3>{v.name}</h3>
                    <p className="loc">{v.area} · Open {v.open}–{v.close}</p>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {v.sports.map((id) => <span key={id} className="badge">{SPORTS.find((x) => x.id === id)?.name ?? id}</span>)}
                    {v.payOnline && <span className="badge badge-lime">Pay online</span>}
                  </div>
                  <ul className="res-list">
                    <li><span className="name">{v.courts} {v.courts === 1 ? "court" : "courts"}</span><span className="num">from {formatPHP(v.fromCents / 100)}/hr</span></li>
                  </ul>
                  <div className="actions"><Link href={`/venues/${v.slug}`} className="btn btn-sm btn-dark">See times</Link></div>
                </article>
              ))}
            </div>
            {venues.length > 6 && <p style={{ marginTop: 16 }}><Link href="/venues" className="btn btn-sm btn-outline">All {venues.length} venues</Link></p>}
          </>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ highlights */
export function HighlightsSection() {
  const [i, setI] = useState(0);
  const clip = HIGHLIGHTS[i];
  return (
    <section id="highlights" className="section dark" aria-labelledby="hl-title">
      <div className="container">
        <div className="section-head">
          <div>
            <p className="eyebrow">Highlights · coming soon</p>
            <h2 id="hl-title">{COPY.highlights.heading}</h2>
          </div>
          <p>{COPY.highlights.body}</p>
        </div>
        <div className="highlights-grid">
          <ClipPlayer clip={clip} />
          <div>
            <p className="eyebrow" style={{ marginBottom: 10 }}>Sample clips</p>
            <div className="library">
              {HIGHLIGHTS.map((c, k) => (
                <button key={c.id} type="button" className="lib-item" aria-pressed={k === i} onClick={() => setI(k)}>
                  <span className="thumb">
                    {c.poster ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.poster} alt="" loading="lazy" decoding="async" width={160} height={100} />
                    ) : (
                      <SportArt sport={c.sport} idSuffix={`-lib${k}`} />
                    )}
                  </span>
                  <span>
                    <span className="t" style={{ display: "block" }}>{c.title}</span>
                    <span className="m">{sportById(c.sport).name} · {clipTime(c.seconds)}</span>
                  </span>
                </button>
              ))}
            </div>
            <div className="alert alert-info" style={{ marginTop: 14 }}>
              <span>Game recordings are not available yet. When they launch, clips will be private by default and shared only with the players in the booking.</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ for venues */
const VENUE_STEPS: [string, string][] = [
  ["List for free", "Register your venue and courts. No subscription and no setup fee."],
  ["Take bookings", "Players book online; your front desk adds walk-ins, blocks and weekly regulars on one calendar."],
  ["Run open play", "Players join by QR code, the system matches them by level, and your facilitator calls games and enters scores."],
  ["Get paid directly", "Cash or online through your own PayMongo account. Playbook keeps a small cut per player or booking, billed weekly."],
];

export function ForVenuesSection() {
  return (
    <section id="venues" className="section dark" aria-labelledby="fv-title" style={{ borderTop: "1px solid var(--line-dark)" }}>
      <div className="container">
        <div className="section-head">
          <div>
            <p className="eyebrow">For venues</p>
            <h2 id="fv-title">{COPY.forVenues.heading}</h2>
          </div>
          <div style={{ display: "grid", gap: 12, justifyItems: "start" }}>
            <p>{COPY.forVenues.body}</p>
            <Link href="/venue/new" className="btn btn-sm">{COPY.forVenues.cta}</Link>
          </div>
        </div>
        <ol className="rules" aria-label="How Playbook works for venues">
          {VENUE_STEPS.map(([t, b]) => <li key={t}><strong>{t}</strong>{b}</li>)}
        </ol>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ pricing */
export function PlansSection() {
  return (
    <section id="plans" className="section light" aria-labelledby="plans-title">
      <div className="container">
        <div className="section-head">
          <div>
            <p className="eyebrow">Pricing</p>
            <h2 id="plans-title">{COPY.plans.heading}</h2>
          </div>
          <p>{COPY.plans.body}</p>
        </div>
        <div className="plan-grid">
          <article className="plan">
            <h3>Players</h3>
            <p>Create an account, book courts and join open play.</p>
            <p className="price">Free</p>
            <ul>
              <li>Pay only the venue&apos;s court or open-play fee</li>
              <li>Pay by cash at the venue, or online where the venue offers it</li>
              <li>Your level and win–loss record per sport</li>
              <li>Messages with the venue about your booking</li>
            </ul>
            <Link href="/venues" className="btn btn-sm btn-dark">Find a court</Link>
          </article>
          <article className="plan is-current">
            <h3>Venues</h3>
            <p>No subscription and no setup fee. Playbook earns only when you do.</p>
            <p className="price">Free to list</p>
            <ul>
              <li>Court calendar, walk-ins and recurring bookings</li>
              <li>Open play with automatic matchmaking by level</li>
              <li>Players pay you directly, by cash or online</li>
              <li>A small cut per open-play player or court booking, billed weekly</li>
              <li>No cut on your equipment rentals</li>
            </ul>
            <Link href="/venue/new" className="btn btn-sm btn-dark">List your venue</Link>
          </article>
        </div>
        <p className="plan-note">The exact cut is shown in your venue dashboard before you take your first booking.</p>
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

