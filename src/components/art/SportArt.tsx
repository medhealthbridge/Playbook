// Original sport artwork: one consistent construction for every sport —
// a top-down court diagram in white line work on the sport's surface colour,
// the sport's equipment glyph, and a single lime accent (the "play route").
import type { SportId } from "@/lib/booking/types";
import type { ReactNode } from "react";

const W = 400;
const H = 300;
const LINE = "rgba(245,247,240,0.82)";
const LIME = "#D7FF3F";

function Frame({ bg, surface, children, id }: { bg: string; surface: string; children: ReactNode; id: string }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={`glow-${id}`} cx="50%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`surf-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={surface} />
          <stop offset="100%" stopColor={bg} />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill={bg} />
      <g transform="translate(200 150) rotate(-12) translate(-200 -150)">{children}</g>
      <rect width={W} height={H} fill={`url(#glow-${id})`} />
    </svg>
  );
}

/** The signature lime "play route": dotted X → arrow. */
function Route({ d }: { d: string }) {
  return (
    <g fill="none" stroke={LIME} strokeWidth="3" strokeLinecap="round">
      <path d={d} strokeDasharray="2 9" />
    </g>
  );
}

function Basketball({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <g>
      <ellipse cx={cx + 4} cy={cy + r * 0.95} rx={r * 0.95} ry={r * 0.22} fill="#000" opacity="0.45" />
      <circle cx={cx} cy={cy} r={r} fill="#E2702F" />
      <circle cx={cx - r * 0.3} cy={cy - r * 0.35} r={r * 0.55} fill="#F08A45" opacity="0.6" />
      <g fill="none" stroke="#1a0f08" strokeWidth={r * 0.06}>
        <circle cx={cx} cy={cy} r={r} />
        <path d={`M${cx - r} ${cy} H${cx + r}`} />
        <path d={`M${cx} ${cy - r} V${cy + r}`} />
        <path d={`M${cx - r * 0.7} ${cy - r * 0.72} Q${cx - r * 0.2} ${cy} ${cx - r * 0.7} ${cy + r * 0.72}`} />
        <path d={`M${cx + r * 0.7} ${cy - r * 0.72} Q${cx + r * 0.2} ${cy} ${cx + r * 0.7} ${cy + r * 0.72}`} />
      </g>
    </g>
  );
}

const ART: Record<SportId, (id: string) => ReactNode> = {
  basketball: (id) => (
    <Frame id={id} bg="#2a1a0e" surface="#8a5a30">
      {/* hardwood planks */}
      <g opacity="0.35">
        {Array.from({ length: 16 }).map((_, i) => (
          <line key={i} x1="-60" x2="460" y1={-40 + i * 26} y2={-40 + i * 26} stroke="#3a2412" strokeWidth="1.2" />
        ))}
      </g>
      <rect x="-40" y="-20" width="480" height="340" fill="#b07a45" opacity="0.28" />
      <g fill="none" stroke={LINE} strokeWidth="3">
        <rect x="-20" y="10" width="440" height="280" />
        <line x1="200" y1="10" x2="200" y2="290" />
        <circle cx="200" cy="150" r="36" />
        <rect x="-20" y="105" width="110" height="90" />
        <circle cx="90" cy="150" r="45" strokeDasharray="8 8" />
        <path d="M-20 30 H20 A150 150 0 0 1 20 270 H-20" />
      </g>
      <rect x="-20" y="105" width="110" height="90" fill={LIME} opacity="0.12" />
      <Route d="M330 240 C 270 230, 150 220, 110 175" />
      <path d="M100 180 l14 -2 -6 13z" fill={LIME} />
      <Basketball cx={292} cy={118} r={46} />
    </Frame>
  ),
  billiards: (id) => (
    <Frame id={id} bg="#0c1410" surface="#1b4d33">
      <ellipse cx="200" cy="150" rx="210" ry="150" fill="#f7e9b0" opacity="0.08" />
      <rect x="20" y="40" width="360" height="220" rx="18" fill="#3d2414" />
      <rect x="38" y="58" width="324" height="184" rx="6" fill="#1f6b45" />
      {[
        [40, 60], [200, 54], [360, 60], [40, 240], [200, 246], [360, 240],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="11" fill="#050806" />
      ))}
      <line x1="120" y1="58" x2="120" y2="242" stroke={LINE} strokeWidth="1.5" opacity="0.5" />
      {(() => {
        const colors = ["#f5d43b", "#2f5bd3", "#d63a2f", "#6b2fa3", "#f08a2f", "#1f8a4c", "#7a1f1f", "#111", "#f5d43b", "#2f5bd3", "#d63a2f", "#6b2fa3", "#f08a2f", "#1f8a4c", "#7a1f1f"];
        const balls: ReactNode[] = [];
        let k = 0;
        for (let row = 0; row < 5; row++) {
          for (let j = 0; j <= row; j++) {
            const x = 250 + row * 17;
            const y = 150 - row * 9.5 + j * 19;
            balls.push(<circle key={k} cx={x} cy={y} r="9" fill={colors[k % colors.length]} stroke="#000" strokeOpacity="0.3" />);
            k++;
          }
        }
        return balls;
      })()}
      <path d="M244 104 L 244 196 L 333 150 Z" fill="none" stroke="#e8d9a8" strokeWidth="2" opacity="0.7" />
      <circle cx="120" cy="150" r="9" fill="#f5f5ee" />
      <Route d="M128 150 H 230" />
      <line x1="-30" y1="190" x2="108" y2="156" stroke="#d8b679" strokeWidth="7" strokeLinecap="round" />
      <line x1="-30" y1="190" x2="20" y2="178" stroke="#2a1608" strokeWidth="8" strokeLinecap="round" />
    </Frame>
  ),
  volleyball: (id) => (
    <Frame id={id} bg="#1a1208" surface="#8a5a30">
      {/* indoor half */}
      <rect x="-40" y="-20" width="240" height="340" fill="#9b6a3a" />
      {/* beach half */}
      <rect x="200" y="-20" width="240" height="340" fill="#d9bf86" />
      <g opacity="0.25">
        {Array.from({ length: 40 }).map((_, i) => (
          <circle key={i} cx={210 + ((i * 53) % 220)} cy={(i * 37) % 300} r="1.5" fill="#6b5326" />
        ))}
      </g>
      <g fill="none" stroke={LINE} strokeWidth="3">
        <rect x="20" y="40" width="360" height="220" />
        <line x1="140" y1="40" x2="140" y2="260" />
        <line x1="260" y1="40" x2="260" y2="260" stroke="#1f4fa8" />
      </g>
      <line x1="200" y1="20" x2="200" y2="280" stroke="#f5f7f0" strokeWidth="6" />
      <line x1="200" y1="20" x2="200" y2="280" stroke="#101713" strokeWidth="2" strokeDasharray="4 4" />
      <text x="60" y="290" fill={LINE} fontSize="14" fontFamily="sans-serif" fontWeight="700" letterSpacing="2">INDOOR</text>
      <text x="270" y="290" fill="#3d2f12" fontSize="14" fontFamily="sans-serif" fontWeight="700" letterSpacing="2">BEACH</text>
      <Route d="M90 220 C 120 120, 180 80, 238 112" />
      <g>
        <ellipse cx="268" cy="160" rx="34" ry="8" fill="#000" opacity="0.25" />
        <circle cx="262" cy="118" r="36" fill="#f5f2e8" />
        <path d="M232 100 Q262 110 292 96" stroke="#2f5bd3" strokeWidth="9" fill="none" />
        <path d="M240 140 Q262 126 290 138" stroke="#f5c93b" strokeWidth="9" fill="none" />
        <circle cx="262" cy="118" r="36" fill="none" stroke="#1d2a40" strokeWidth="2" />
      </g>
    </Frame>
  ),
  badminton: (id) => (
    <Frame id={id} bg="#0b1d19" surface="#1d5a4d">
      <rect x="-40" y="-20" width="480" height="340" fill="#1a5246" />
      <g fill="none" stroke={LINE} strokeWidth="2.5">
        <rect x="10" y="40" width="380" height="220" />
        <line x1="10" y1="57" x2="390" y2="57" />
        <line x1="10" y1="243" x2="390" y2="243" />
        <line x1="150" y1="40" x2="150" y2="260" />
        <line x1="250" y1="40" x2="250" y2="260" />
        <line x1="32" y1="40" x2="32" y2="260" />
        <line x1="368" y1="40" x2="368" y2="260" />
        <line x1="10" y1="150" x2="150" y2="150" />
        <line x1="250" y1="150" x2="390" y2="150" />
      </g>
      <line x1="200" y1="28" x2="200" y2="272" stroke="#f5f7f0" strokeWidth="5" />
      <Route d="M60 210 C 120 60, 260 60, 300 100" />
      {/* shuttle */}
      <g transform="translate(300 112) rotate(35)">
        <path d="M-18 -40 L18 -40 L9 0 L-9 0 Z" fill="#f5f7f0" />
        <path d="M-14 -34 H14 M-11 -20 H11" stroke="#b7c2ba" strokeWidth="2" />
        <ellipse cx="0" cy="6" rx="10" ry="9" fill="#e8d9a8" />
      </g>
      {/* racket */}
      <g transform="translate(110 120) rotate(-30)">
        <ellipse cx="0" cy="0" rx="30" ry="40" fill="none" stroke="#101713" strokeWidth="6" />
        <ellipse cx="0" cy="0" rx="30" ry="40" fill="none" stroke={LIME} strokeWidth="3" />
        <g stroke="#f5f7f0" strokeWidth="0.8" opacity="0.6">
          {[-20, -10, 0, 10, 20].map((x) => <line key={x} x1={x} y1="-36" x2={x} y2="36" />)}
          {[-28, -14, 0, 14, 28].map((y) => <line key={y} x1="-28" y1={y} x2="28" y2={y} />)}
        </g>
        <line x1="0" y1="40" x2="0" y2="110" stroke="#101713" strokeWidth="6" />
      </g>
    </Frame>
  ),
  pickleball: (id) => (
    <Frame id={id} bg="#0e2416" surface="#2a6a3e">
      <rect x="-40" y="-20" width="480" height="340" fill="#2f6b40" />
      <rect x="30" y="50" width="340" height="200" fill="#1f4f86" />
      <rect x="150" y="50" width="100" height="200" fill="#2a64a3" />
      <g fill="none" stroke={LINE} strokeWidth="3">
        <rect x="30" y="50" width="340" height="200" />
        <line x1="150" y1="50" x2="150" y2="250" />
        <line x1="250" y1="50" x2="250" y2="250" />
        <line x1="30" y1="150" x2="150" y2="150" />
        <line x1="250" y1="150" x2="370" y2="150" />
      </g>
      <line x1="200" y1="38" x2="200" y2="262" stroke="#f5f7f0" strokeWidth="5" />
      <text x="160" y="270" fill={LINE} fontSize="11" fontFamily="sans-serif" fontWeight="700" letterSpacing="1.5">KITCHEN</text>
      <Route d="M80 210 C 110 160, 140 150, 168 150" />
      <g transform="translate(300 120) rotate(25)">
        <rect x="-30" y="-44" width="60" height="70" rx="22" fill="#101713" />
        <rect x="-26" y="-40" width="52" height="62" rx="19" fill={LIME} />
        <rect x="-7" y="24" width="14" height="44" rx="5" fill="#101713" />
      </g>
      <g>
        <circle cx="236" cy="186" r="20" fill="#f2e33a" />
        {[[-8, -8], [8, -8], [0, 0], [-8, 8], [8, 8], [0, -14], [0, 14], [-14, 0], [14, 0]].map(([x, y], i) => (
          <circle key={i} cx={236 + x} cy={186 + y} r="2.6" fill="#b8a71e" />
        ))}
      </g>
    </Frame>
  ),
  "table-tennis": (id) => (
    <Frame id={id} bg="#0b0f16" surface="#1c2a44">
      <rect x="-40" y="-20" width="480" height="340" fill="#16203a" />
      <rect x="40" y="70" width="320" height="170" rx="4" fill="#1d4f9a" />
      <g fill="none" stroke={LINE} strokeWidth="3">
        <rect x="40" y="70" width="320" height="170" rx="4" />
        <line x1="40" y1="155" x2="360" y2="155" strokeWidth="1.5" />
      </g>
      <rect x="196" y="58" width="8" height="194" fill="#f5f7f0" />
      <Route d="M90 210 C 150 110, 250 110, 300 140" />
      <circle cx="300" cy="140" r="7" fill="#ffffff" />
      <g transform="translate(110 210) rotate(-35)">
        <circle cx="0" cy="0" r="34" fill="#d63a2f" />
        <circle cx="0" cy="0" r="34" fill="none" stroke="#101713" strokeWidth="3" />
        <rect x="-7" y="30" width="14" height="44" rx="4" fill="#c49660" />
      </g>
    </Frame>
  ),
  futsal: (id) => (
    <Frame id={id} bg="#0c1f12" surface="#256b39">
      {Array.from({ length: 10 }).map((_, i) => (
        <rect key={i} x={-40 + i * 50} y="-20" width="50" height="340" fill={i % 2 ? "#2a7a40" : "#24703a"} />
      ))}
      <g fill="none" stroke={LINE} strokeWidth="3">
        <rect x="10" y="30" width="380" height="240" />
        <line x1="200" y1="30" x2="200" y2="270" />
        <circle cx="200" cy="150" r="34" />
        <path d="M10 90 A60 60 0 0 1 70 130 V170 A60 60 0 0 1 10 210" />
        <path d="M390 90 A60 60 0 0 0 330 130 V170 A60 60 0 0 0 390 210" />
      </g>
      <rect x="-6" y="125" width="16" height="50" fill="none" stroke="#f5f7f0" strokeWidth="4" />
      <rect x="390" y="125" width="16" height="50" fill="none" stroke="#f5f7f0" strokeWidth="4" />
      <Route d="M200 150 C 260 210, 320 200, 380 160" />
      <g>
        <ellipse cx="230" cy="138" rx="28" ry="7" fill="#000" opacity="0.3" />
        <circle cx="226" cy="106" r="30" fill="#f5f7f0" />
        <path d="M226 90 l12 9 -5 14 h-14 l-5 -14z" fill="#101713" />
        <circle cx="226" cy="106" r="30" fill="none" stroke="#101713" strokeWidth="2" />
      </g>
    </Frame>
  ),
  tennis: (id) => (
    <Frame id={id} bg="#0d1b26" surface="#22506e">
      <rect x="-40" y="-20" width="480" height="340" fill="#2a6a4a" />
      <rect x="10" y="40" width="380" height="220" fill="#24557d" />
      <g fill="none" stroke={LINE} strokeWidth="2.5">
        <rect x="10" y="40" width="380" height="220" />
        <line x1="10" y1="68" x2="390" y2="68" />
        <line x1="10" y1="232" x2="390" y2="232" />
        <line x1="110" y1="68" x2="110" y2="232" />
        <line x1="290" y1="68" x2="290" y2="232" />
        <line x1="110" y1="150" x2="290" y2="150" />
      </g>
      <line x1="200" y1="30" x2="200" y2="270" stroke="#f5f7f0" strokeWidth="5" />
      <rect x="110" y="68" width="90" height="82" fill={LIME} opacity="0.12" />
      <Route d="M370 220 C 300 120, 220 100, 160 110" />
      <circle cx="160" cy="110" r="13" fill="#d9ef3b" />
      <path d="M150 102 Q160 110 150 120 M170 100 Q160 110 170 120" stroke="#f5f7f0" strokeWidth="2" fill="none" />
      <g transform="translate(300 120) rotate(30)">
        <ellipse cx="0" cy="0" rx="34" ry="44" fill="none" stroke="#101713" strokeWidth="8" />
        <ellipse cx="0" cy="0" rx="34" ry="44" fill="none" stroke="#f5f7f0" strokeWidth="3" />
        <g stroke="#f5f7f0" strokeWidth="0.8" opacity="0.5">
          {[-24, -12, 0, 12, 24].map((x) => <line key={x} x1={x} y1="-40" x2={x} y2="40" />)}
          {[-30, -15, 0, 15, 30].map((y) => <line key={y} x1="-32" y1={y} x2="32" y2={y} />)}
        </g>
        <line x1="0" y1="44" x2="0" y2="110" stroke="#101713" strokeWidth="9" />
      </g>
    </Frame>
  ),
  padel: (id) => (
    <Frame id={id} bg="#0a1424" surface="#1d3f73">
      <rect x="-40" y="-20" width="480" height="340" fill="#13284a" />
      <rect x="30" y="50" width="340" height="200" fill="#2a5aa8" />
      {/* glass walls */}
      <rect x="22" y="42" width="356" height="216" fill="none" stroke="#bfe3ff" strokeOpacity="0.55" strokeWidth="8" />
      <rect x="22" y="42" width="356" height="216" fill="#bfe3ff" opacity="0.06" />
      <g fill="none" stroke={LINE} strokeWidth="2.5">
        <rect x="30" y="50" width="340" height="200" />
        <line x1="90" y1="50" x2="90" y2="250" />
        <line x1="310" y1="50" x2="310" y2="250" />
        <line x1="90" y1="150" x2="310" y2="150" />
      </g>
      <line x1="200" y1="44" x2="200" y2="256" stroke="#f5f7f0" strokeWidth="5" />
      <Route d="M60 220 C 30 160, 40 90, 120 80" />
      <g transform="translate(290 128) rotate(28)">
        <path d="M-32 -30 Q-32 -56 0 -56 Q32 -56 32 -30 V8 Q32 26 8 30 H-8 Q-32 26 -32 8 Z" fill="#101713" />
        <path d="M-28 -30 Q-28 -52 0 -52 Q28 -52 28 -30 V6 Q28 22 6 26 H-6 Q-28 22 -28 6 Z" fill={LIME} />
        {[[-14, -36], [0, -36], [14, -36], [-14, -20], [0, -20], [14, -20], [-14, -4], [0, -4], [14, -4], [-7, 10], [7, 10]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="3" fill="#101713" />
        ))}
        <rect x="-6" y="28" width="12" height="40" rx="4" fill="#101713" />
      </g>
    </Frame>
  ),
  "sepak-takraw": (id) => (
    <Frame id={id} bg="#1d1208" surface="#7a3f1f">
      <rect x="-40" y="-20" width="480" height="340" fill="#8a4a24" />
      <g fill="none" stroke={LINE} strokeWidth="3">
        <rect x="20" y="50" width="360" height="200" />
        <path d="M200 50 A44 44 0 0 1 156 94" />
        <path d="M200 250 A44 44 0 0 0 156 206" />
        <path d="M200 50 A44 44 0 0 0 244 94" />
        <path d="M200 250 A44 44 0 0 1 244 206" />
        <circle cx="110" cy="150" r="30" />
        <circle cx="290" cy="150" r="30" />
      </g>
      <line x1="200" y1="36" x2="200" y2="264" stroke="#f5f7f0" strokeWidth="5" />
      <Route d="M110 150 C 130 60, 220 40, 262 90" />
      <g transform="translate(270 104)">
        <circle r="34" fill="#e3c27a" />
        <g fill="none" stroke="#7a5a22" strokeWidth="3">
          <circle r="34" />
          {[0, 60, 120].map((a) => (
            <ellipse key={a} rx="34" ry="13" transform={`rotate(${a})`} />
          ))}
        </g>
      </g>
    </Frame>
  ),
};

export function SportArt({ sport, idSuffix = "" }: { sport: SportId; idSuffix?: string }) {
  return <>{ART[sport](sport + idSuffix)}</>;
}
