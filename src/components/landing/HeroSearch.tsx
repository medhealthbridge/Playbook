"use client";
import { useState, type FormEvent } from "react";
import { SPORTS } from "@/content/sports";
import type { SportId } from "@/lib/booking/types";
import { useBooking } from "@/lib/ui/BookingLauncher";

export function HeroSearch() {
  const { open } = useBooking();
  const [sport, setSport] = useState<SportId | "">("pickleball");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    open({ sportId: sport || undefined });
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
      <button type="submit" className="btn">Book a slot</button>
      <span className="hint">Venues across Metro Manila. Pick your date and time on the venue page.</span>
    </form>
  );
}
