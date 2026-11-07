import { SPORTS } from "@/content/sports";

export function CourtFields({ i, required = false }: { i: number; required?: boolean }) {
  return (
    <div className="court-row">
      <input className="input" name={`court_name_${i}`} placeholder={i === 0 ? "e.g. Pickleball Court 1" : "Name (optional)"} aria-label={`Court ${i + 1} name`} required={required} maxLength={60} />
      <select className="select" name={`court_sport_${i}`} aria-label={`Court ${i + 1} sport`} defaultValue="">
        <option value="" disabled>Sport</option>
        {SPORTS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <input className="input" name={`court_rate_${i}`} inputMode="decimal" placeholder="₱ per hour" aria-label={`Court ${i + 1} hourly rate in pesos`} />
      <select className="select" name={`court_indoor_${i}`} aria-label={`Court ${i + 1} indoor or outdoor`} defaultValue="indoor">
        <option value="indoor">Indoor</option>
        <option value="outdoor">Outdoor</option>
      </select>
    </div>
  );
}
