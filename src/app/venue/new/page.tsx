import Link from "next/link";
import type { Metadata } from "next";
import { CourtFields } from "@/components/portal/CourtFields";
import { Flash, PortalHeader } from "@/components/portal/Portal";
import { METRO_AREAS } from "@/lib/server/form";
import { requireUser } from "@/lib/server/session";
import { createVenue } from "../actions";

export const metadata: Metadata = { title: "Register your venue — Playbook", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function NewVenuePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  await requireUser("/venue/new");
  return (
    <main id="main" className="app-shell">
      <PortalHeader eyebrow="Venue onboarding" title="Register your venue" />
      <div className="app-body">
        <div className="container" style={{ maxWidth: 860 }}>
          <form action={createVenue} className="app-card form-grid">
            <Flash error={sp.error} />
            <p className="hint">We review every venue before it appears to players, usually within 1–2 business days. You can add more courts, staff and settings after approval.</p>

            <fieldset className="form-section">
              <legend><h2>Venue</h2></legend>
              <div className="field"><label htmlFor="name">Venue name</label><input id="name" name="name" className="input" required maxLength={80} /></div>
              <div className="field-row">
                <div className="field">
                  <label htmlFor="area">City</label>
                  <select id="area" name="area" className="select" required defaultValue="">
                    <option value="" disabled>Choose…</option>
                    {METRO_AREAS.map((a) => <option key={a}>{a}</option>)}
                  </select>
                </div>
                <div className="field"><label htmlFor="phone">Contact number</label><input id="phone" name="phone" className="input" inputMode="tel" placeholder="0917 123 4567" required /></div>
              </div>
              <div className="field"><label htmlFor="address">Full address</label><input id="address" name="address" className="input" required maxLength={200} /></div>
              <div className="field"><label htmlFor="description">About the venue (optional)</label><textarea id="description" name="description" className="input textarea" maxLength={600} /></div>
            </fieldset>

            <fieldset className="form-section">
              <legend><h2>Business details</h2></legend>
              <p className="hint">Used to verify the venue. Not shown to players.</p>
              <div className="field-row">
                <div className="field"><label htmlFor="business_name">Registered business name</label><input id="business_name" name="business_name" className="input" required maxLength={120} /></div>
                <div className="field"><label htmlFor="business_reg_no">DTI / SEC registration no.</label><input id="business_reg_no" name="business_reg_no" className="input" required maxLength={60} /></div>
              </div>
            </fieldset>

            <fieldset className="form-section">
              <legend><h2>Hours and policies</h2></legend>
              <div className="field-row">
                <div className="field"><label htmlFor="open_time">Opens</label><input id="open_time" name="open_time" type="time" className="input" defaultValue="07:00" required /></div>
                <div className="field"><label htmlFor="close_time">Closes</label><input id="close_time" name="close_time" type="time" className="input" defaultValue="22:00" required /></div>
              </div>
              <div className="field-row">
                <div className="field"><label htmlFor="deposit_percent">Deposit to confirm (%)</label><input id="deposit_percent" name="deposit_percent" type="number" min={0} max={100} className="input" defaultValue={50} /></div>
                <div className="field"><label htmlFor="free_cancel_hours">Free cancellation up to (hours before)</label><input id="free_cancel_hours" name="free_cancel_hours" type="number" min={0} max={168} className="input" defaultValue={24} /></div>
              </div>
            </fieldset>

            <fieldset className="form-section">
              <legend><h2>Courts, tables and pitches</h2></legend>
              <p className="hint">Add at least one. Leave a row's name empty to skip it.</p>
              {[0, 1, 2, 3, 4, 5].map((i) => <CourtFields key={i} i={i} required={i === 0} />)}
            </fieldset>

            <fieldset className="form-section">
              <label className="check">
                <input type="checkbox" name="agree" required />
                <span>I&apos;m authorised to list this venue and agree to the <Link href="/terms#venues">Venue Agreement</Link>, including the monthly subscription and per-booking platform fee.</span>
              </label>
              <button className="btn" type="submit">Submit for review</button>
            </fieldset>
          </form>
        </div>
      </div>
    </main>
  );
}
