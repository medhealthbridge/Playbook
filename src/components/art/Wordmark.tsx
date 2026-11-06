// Original PLAYBOOK wordmark: condensed caps where the two O's are drawn as
// play-diagram markers — a player (with lime centre) and a target — joined
// by a dotted lime route. Built from text + inline SVG so spacing always fits.
function PlayerO({ lime }: { lime?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9.4" fill="none" stroke="currentColor" strokeWidth="4.4" />
      {lime && <circle cx="12" cy="12" r="3" fill="#D7FF3F" />}
    </svg>
  );
}

export function Wordmark({ height = 26, title = "Playbook" }: { height?: number; title?: string }) {
  return (
    <span className="wm" role="img" aria-label={title} style={{ fontSize: height * 1.08 }}>
      <span aria-hidden="true">PLAYB</span>
      <span aria-hidden="true" style={{ position: "relative", display: "inline-flex" }}>
        <PlayerO lime />
        <PlayerO />
        <svg
          viewBox="0 0 40 10"
          aria-hidden="true"
          style={{ position: "absolute", left: "0.3em", bottom: "-0.32em", width: "0.9em", height: "0.24em" }}
        >
          <path d="M2 2 Q20 12 34 3" fill="none" stroke="#D7FF3F" strokeWidth="2.6" strokeLinecap="round" strokeDasharray="1.5 5" />
          <path d="M31 1 l7 1 -4 5z" fill="#D7FF3F" />
        </svg>
      </span>
      <span aria-hidden="true">K</span>
    </span>
  );
}
