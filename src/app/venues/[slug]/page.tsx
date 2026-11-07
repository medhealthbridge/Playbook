import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Flash, PortalHeader, peso } from "@/components/portal/Portal";
import { SPORTS } from "@/content/sports";
import { formatDate, formatDuration, formatTime } from "@/lib/booking/time";
import { priceCents } from "@/lib/booking/engine";
import { bookingDates, durationsFor, expireHolds, startsFor, venueBySlug, venueResources } from "@/lib/server/bookings";
import { getSession } from "@/lib/server/session";
import { holdBooking } from "../../bookings/actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const v = await venueBySlug((await params).slug);
  return { title: v ? `${v.name} — Book on Playbook` : "Venue — Playbook" };
}

export default async function VenuePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const venue = await venueBySlug(slug);
  if (!venue || venue.status !== "active") notFound();
  const [resources, session] = await Promise.all([venueResources(venue.id), getSession()]);
  const sportName = (id: string) => SPORTS.find((s) => s.id === id)?.name ?? id;
  const sports = [...new Set(resources.flatMap((r) => r.sports))];
  const sport = sports.includes(sp.sport ?? "") ? sp.sport! : sports[0];
  const courts = resources.filter((r) => r.sports.includes(sport));
  const court = courts.find((r) => r.id === sp.court) ?? courts[0];
  const dates = bookingDates();
  const date = dates.includes(sp.date ?? "") ? sp.date! : dates[0];
  const durations = court ? durationsFor(court) : [];
  const dur = durations.includes(Number(sp.dur)) ? Number(sp.dur) : durations[0];
  await expireHolds();
  const starts = court ? await startsFor(venue, court, date, dur) : [];
  const link = (o: Record<string, string | number>) => {
    const p = new URLSearchParams({ sport, court: court?.id ?? "", date, dur: String(dur), ...Object.fromEntries(Object.entries(o).map(([k, v]) => [k, String(v)])) });
    return `/venues/${slug}?${p}`;
  };

  return (
    <main id="main" className="app-shell">
      <PortalHeader eyebrow={`${venue.area} · open ${venue.open_time}–${venue.close_time}`} title={venue.name} actions={<Link href="/venues" className="btn btn-xs btn-ghost">All venues</Link>} />
      <div className="app-body">
        <div className="container app-stack">
          <Flash error={sp.error} />
          <div className="app-grid">
            <section className="app-card" aria-labelledby="pick">
              <h2 id="pick">Pick a time</h2>
              {sports.length > 1 && (
                <div className="field">
                  <span className="label">Sport</span>
                  <div className="chip-row">{sports.map((s) => <Link key={s} href={link({ sport: s, court: "" })} className={`btn btn-xs ${s === sport ? "" : "btn-outline"}`}>{sportName(s)}</Link>)}</div>
                </div>
              )}
              <div className="field">
                <span className="label">Court</span>
                <div className="chip-row">{courts.map((r) => <Link key={r.id} href={link({ court: r.id })} className={`btn btn-xs ${r.id === court?.id ? "" : "btn-outline"}`}>{r.name} · {peso(r.hourly_rate_cents)}/hr</Link>)}</div>
              </div>
              <div className="field">
                <span className="label">Date</span>
                <div className="chip-row scroll-x">{dates.map((d) => <Link key={d} href={link({ date: d })} className={`btn btn-xs ${d === date ? "" : "btn-outline"}`}>{formatDate(d)}</Link>)}</div>
              </div>
              <div className="field">
                <span className="label">Duration</span>
                <div className="chip-row">{durations.map((d) => <Link key={d} href={link({ dur: d })} className={`btn btn-xs ${d === dur ? "" : "btn-outline"}`}>{formatDuration(d)}</Link>)}</div>
              </div>
              <div className="field">
                <span className="label">Start time · {formatDate(date)}</span>
                {starts.length === 0 ? (
                  <p className="hint">No free times for this court, date and duration. Try another day or a shorter game.</p>
                ) : (
                  <div className="slot-grid">
                    {starts.map((s) => (
                      <form key={s} action={holdBooking}>
                        <input type="hidden" name="slug" value={slug} />
                        <input type="hidden" name="resource_id" value={court!.id} />
                        <input type="hidden" name="date" value={date} />
                        <input type="hidden" name="duration" value={dur} />
                        <input type="hidden" name="sport" value={sport} />
                        <input type="hidden" name="start" value={s} />
                        <button type="submit" className="slot-btn">{formatTime(s)}</button>
                      </form>
                    ))}
                  </div>
                )}
              </div>
              {!session && <p className="hint">You&apos;ll sign in or create an account to hold the time.</p>}
            </section>
            <aside className="app-stack">
              <section className="app-card">
                <h3>Price</h3>
                {court && <p><strong>{peso(priceCents(court.hourly_rate_cents, dur))}</strong> for {formatDuration(dur)} on {court.name}</p>}
                <dl className="kv">
                  <dt>Deposit</dt><dd>{venue.deposit_percent}% to confirm{venue.allow_pay_at_venue ? " (or pay at the venue, if offered)" : ""}</dd>
                  <dt>Cancellation</dt><dd>Free up to {venue.free_cancel_hours} hours before</dd>
                </dl>
                <p className="hint">You pay {venue.name} directly. Playbook doesn&apos;t hold your money.</p>
              </section>
              <section className="app-card">
                <h3>About</h3>
                <p>{venue.description || `${venue.name} in ${venue.area}.`}</p>
                <p className="hint">{venue.address}{venue.phone ? ` · ${venue.phone}` : ""}</p>
              </section>
            </aside>
          </div>
        </div>
      </div>
    </main>
  );
}
