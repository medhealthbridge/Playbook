// HTML info cards that accompany each chapter (readable, accessible copy —
// the 3D world shows the same story spatially). All values are demo data.
import { formatPHP } from "@/lib/booking/time";

export function BookCard() {
  const times: [string, "free" | "taken" | "sel"][] = [
    ["4 PM", "taken"], ["5 PM", "free"], ["6 PM", "sel"], ["7 PM", "free"], ["8 PM", "taken"], ["9 PM", "free"],
  ];
  return (
    <div className="info-card glass">
      <div className="row">
        <span className="badge on-dark">Kalye Court Hub · QC</span>
        <span className="badge badge-demo">Demo data</span>
      </div>
      <div>
        <div className="title">Court A · Main hardwood</div>
        <div className="meta">Indoor · Hardwood · Up to 20 · Basketball &amp; volleyball share this court</div>
      </div>
      <div className="mini-chips" aria-label="Sample start times">
        {times.map(([t, s]) => (
          <span key={t} className={`mini-chip ${s === "taken" ? "taken" : s === "sel" ? "sel" : ""}`}>
            {t}
            {s === "taken" && <span className="sr-only"> (booked)</span>}
            {s === "sel" && <span className="sr-only"> (selected)</span>}
          </span>
        ))}
      </div>
      <div className="receipt">
        <div className="line"><span>Sat · 6:00–8:00 PM</span><span>{formatPHP(2400)}</span></div>
        <div className="line"><span>Basketball rental</span><span>{formatPHP(100)}</span></div>
        <div className="line total"><span>Deposit now (50%)</span><span>{formatPHP(1250)}</span></div>
      </div>
    </div>
  );
}

export function PlayCard() {
  return (
    <div className="info-card glass">
      <div className="row">
        <span className="badge badge-lime">Confirmed</span>
        <span className="badge badge-demo">Demo data</span>
      </div>
      <div>
        <div className="title num">PB-7KQ2</div>
        <div className="meta">Court A · Sat 6:00–8:00 PM · ₱1,250 balance at venue</div>
      </div>
      <div className="row">
        <div className="people" aria-label="Squad: You, Migs, Ana, JR">
          {["Y", "M", "A", "J"].map((i) => (
            <span key={i} className="avatar" aria-hidden="true">{i}</span>
          ))}
        </div>
        <span className="meta">2 going · 2 invited</span>
      </div>
      <div className="amenities" aria-label="Amenities">
        {["Showers", "Lockers", "Water refill", "Parking", "Scoreboard"].map((a) => (
          <span key={a} className="badge on-dark">{a}</span>
        ))}
      </div>
    </div>
  );
}

export function ReplayCard() {
  return (
    <div className="info-card glass">
      <div className="row">
        <span className="badge badge-orange">Clip ready</span>
        <span className="badge badge-demo">Demo data</span>
      </div>
      <div>
        <div className="title">Block at the rim</div>
        <div className="meta">0:05 · Court A · Published by venue staff</div>
      </div>
      <div className="timeline" aria-hidden="true" style={{ flex: "none", height: 28 }}>
        <div className="mark" style={{ left: "12%", width: "12%" }} />
        <div className="mark" style={{ left: "44%", width: "9%" }} />
        <div className="mark" style={{ left: "78%", width: "7%" }} />
        <div className="head" style={{ left: "47%" }} />
      </div>
      <p className="meta">
        Needs: a venue that records · published footage · you&apos;re an authorised participant · a Replay plan.
      </p>
    </div>
  );
}
