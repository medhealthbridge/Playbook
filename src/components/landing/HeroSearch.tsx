"use client";
import { useState, type FormEvent } from "react";
import { SPORTS } from "@/content/sports";
import { VENUES } from "@/content/venues";
import { addDays, manilaToday } from "@/lib/booking/time";
import type { SportId } from "@/lib/booking/types";
import { useBooking } from "@/lib/ui/BookingLauncher";

export function HeroSearch({ compact = false }: { compact?: boolean }) {
  const { open } = useBooking();
  const [sport, setSport] = useState<SportId | "">("pickleball");
  const [where, setWhere] = useState("");
  const [date, setDate] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const today = manilaToday();
    if (date && date < today) {
      setErr("That date has passed. Pick today or later.");
      return;
    }
    setErr(null);
    const venue = VENUES.find((v) => v.id === where);
    open({ sportId: sport || undefined, venueId: venue?.id, date: date || undefined });
  };

  return (
    <form className="search-card glass" onSubmit={submit} aria-label="Find a slot" noValidate>
      <h2>Find a slot</h2>
      <div className="field">
        <label htmlFor="hs-sport">Sport</label>
        <select id="hs-sport" className="select" value={sport} onChange={(e) => setSport(e.target.value as SportId | "")}>
          <option value="">Any sport</option>
          {SPORTS.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>
      {!compact && (
        <div className="field-row">
          <div className="field">
            <label htmlFor="hs-where">Location or venue</label>
            <select id="hs-where" className="select" value={where} onChange={(e) => setWhere(e.target.value)}>
              <option value="">Anywhere in Metro Manila</option>
              {VENUES.map((v) => (
                <option key={v.id} value={v.id}>{v.area} — {v.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="hs-date">Date</label>
            <input
              id="hs-date"
              className="input num"
              type="date"
              min={manilaToday()}
              max={addDays(manilaToday(), 30)}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-invalid={!!err}
              aria-describedby={err ? "hs-err" : undefined}
            />
          </div>
        </div>
      )}
      {err && <span id="hs-err" className="field-error" role="alert">{err}</span>}
      <button type="submit" className="btn">Book a slot</button>
      <span className="hint">Demo venues in Quezon City, Makati &amp; Pasig.</span>
    </form>
  );
}
