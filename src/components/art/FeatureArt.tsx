// Product-specific illustrations for the feature cards. All figures shown
// are the same sample data used across the demo (Kalye Court Hub, Court A).
import type { ReactNode } from "react";

const C = { lime: "#D7FF3F", white: "#F5F7F0", mute: "#B7C2BA", dim: "#2E3A33", panel: "#18211C", orange: "#FF7648", bg: "#101713" };
const font = { fontFamily: "var(--font-body)", fontSize: 11 } as const;
const display = { fontFamily: "var(--font-display)", fontWeight: 800 } as const;

function Svg({ children, label }: { children: ReactNode; label: string }) {
  return (
    <svg viewBox="0 0 320 200" role="img" aria-label={label}>
      <rect width="320" height="200" fill={C.bg} />
      {children}
    </svg>
  );
}

export function CalendarArt() {
  const hours = ["4P", "5P", "6P", "7P", "8P", "9P"];
  return (
    <Svg label="Resource calendar for Court A with 6 PM to 8 PM selected">
      <rect x="20" y="20" width="280" height="160" rx="10" fill={C.panel} />
      <text x="34" y="44" fill={C.white} style={{ ...display, fontSize: 15 }}>COURT A · SAT</text>
      <text x="286" y="44" fill={C.mute} textAnchor="end" style={font}>Demo data</text>
      {hours.map((h, i) => (
        <g key={h}>
          <text x="34" y={74 + i * 18} fill={C.mute} style={font}>{h}</text>
          <line x1="60" x2="286" y1={70 + i * 18} y2={70 + i * 18} stroke={C.dim} />
        </g>
      ))}
      <rect x="64" y="72" width="220" height="16" rx="4" fill={C.dim} />
      <text x="72" y="84" fill={C.mute} style={font}>Booked</text>
      <rect x="64" y="108" width="220" height="34" rx="5" fill={C.lime} />
      <text x="74" y="122" fill={C.bg} style={{ ...font, fontWeight: 700 }}>6:00 PM – 8:00 PM</text>
      <text x="74" y="136" fill={C.bg} style={font}>Your selection · 2 hrs</text>
      <rect x="64" y="146" width="220" height="10" rx="3" fill="none" stroke={C.mute} strokeDasharray="3 3" />
      <text x="290" y="154" fill={C.mute} textAnchor="end" style={{ ...font, fontSize: 9 }}>15-min buffer</text>
    </Svg>
  );
}

export function PriceArt() {
  const rows: [string, string][] = [
    ["Court A · 2 hrs", "₱2,400"],
    ["Basketball rental", "₱100"],
    ["Subtotal", "₱2,500"],
    ["Deposit now (50%)", "₱1,250"],
  ];
  return (
    <Svg label="Price breakdown: rental, equipment, deposit and balance">
      <rect x="60" y="16" width="200" height="168" rx="10" fill={C.white} />
      <text x="76" y="42" fill={C.bg} style={{ ...display, fontSize: 15 }}>PRICE BREAKDOWN</text>
      {rows.map(([k, v], i) => (
        <g key={k}>
          <text x="76" y={70 + i * 22} fill="#5B665F" style={font}>{k}</text>
          <text x="244" y={70 + i * 22} fill={C.bg} textAnchor="end" style={{ ...font, fontWeight: 700 }}>{v}</text>
        </g>
      ))}
      <line x1="76" x2="244" y1="146" y2="146" stroke="#B7C2BA" strokeDasharray="3 3" />
      <rect x="70" y="152" width="180" height="24" rx="6" fill={C.lime} />
      <text x="80" y="168" fill={C.bg} style={{ ...font, fontWeight: 700 }}>Balance at venue</text>
      <text x="240" y="168" fill={C.bg} textAnchor="end" style={{ ...font, fontWeight: 700 }}>₱1,250</text>
    </Svg>
  );
}

export function InviteArt() {
  const people: [string, string, string][] = [
    ["Y", "You", "Owner"],
    ["M", "Migs", "Going"],
    ["A", "Ana", "Invited"],
    ["J", "JR", "Invited"],
  ];
  return (
    <Svg label="Booking invitation with participant list">
      <rect x="40" y="18" width="240" height="164" rx="10" fill={C.panel} />
      <text x="56" y="44" fill={C.white} style={{ ...display, fontSize: 15 }}>SAT GAME · COURT A</text>
      <text x="56" y="60" fill={C.mute} style={font}>6:00 – 8:00 PM · Kalye Court Hub</text>
      {people.map(([i, n, s], k) => (
        <g key={n} transform={`translate(56 ${76 + k * 24})`}>
          <circle cx="9" cy="8" r="9" fill={k === 0 ? C.lime : C.dim} />
          <text x="9" y="12" fill={k === 0 ? C.bg : C.white} textAnchor="middle" style={{ ...font, fontWeight: 700, fontSize: 10 }}>{i}</text>
          <text x="26" y="12" fill={C.white} style={font}>{n}</text>
          <text x="208" y="12" fill={s === "Invited" ? C.orange : C.mute} textAnchor="end" style={font}>{s}</text>
        </g>
      ))}
      <text x="56" y="176" fill={C.mute} style={{ ...font, fontSize: 9 }}>Invites don&apos;t include recording access</text>
    </Svg>
  );
}

export function LibraryArt() {
  // Real frames from the demo clips (public/assets/video/*-poster.jpg).
  const side: [string, string, string][] = [
    ["basketball", "Block at the rim", "0:05"],
    ["billiards", "Corner cut shot", "0:03"],
    ["padel", "Lob and smash", "0:08"],
  ];
  const poster = (n: string) => `/assets/video/highlight-${n}-poster.jpg`;
  return (
    <Svg label="Pickleball clip thumbnail and personal highlight library">
      <defs>
        <clipPath id="lib-main"><rect x="20" y="20" width="176" height="104" rx="8" /></clipPath>
        {side.map((_, i) => (
          <clipPath key={i} id={`lib-side-${i}`}><rect x="210" y={20 + i * 56} width="90" height="48" rx="6" /></clipPath>
        ))}
        <linearGradient id="lib-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.35" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.85" />
        </linearGradient>
      </defs>
      {/* main clip */}
      <rect x="20" y="20" width="176" height="104" rx="8" fill={C.panel} />
      <image href={poster("pickleball")} x="20" y="20" width="176" height="104" preserveAspectRatio="xMidYMid slice" clipPath="url(#lib-main)" />
      <rect x="20" y="20" width="176" height="104" rx="8" fill="none" stroke={C.lime} strokeWidth="1.5" />
      <rect x="28" y="28" width="54" height="13" rx="6.5" fill={C.bg} fillOpacity="0.75" />
      <text x="55" y="37.5" fill={C.lime} textAnchor="middle" style={{ ...font, fontSize: 7, fontWeight: 700, letterSpacing: 0.6 }}>DEMO CLIP</text>
      <circle cx="108" cy="72" r="15" fill={C.bg} fillOpacity="0.55" stroke={C.white} strokeOpacity="0.8" />
      <path d="M103 64 L116 72 L103 80 Z" fill={C.white} />
      <rect x="160" y="106" width="28" height="12" rx="3" fill={C.bg} fillOpacity="0.75" />
      <text x="174" y="115" fill={C.white} textAnchor="middle" style={{ ...font, fontSize: 8, fontWeight: 700 }}>0:05</text>
      {/* scrubber with clip markers and playhead */}
      <rect x="20" y="134" width="176" height="6" rx="3" fill={C.dim} />
      <rect x="20" y="134" width="70" height="6" rx="3" fill={C.lime} fillOpacity="0.35" />
      <rect x="60" y="134" width="22" height="6" rx="3" fill={C.lime} />
      <rect x="120" y="134" width="14" height="6" rx="3" fill={C.lime} />
      <rect x="89" y="131" width="2.5" height="12" rx="1" fill={C.orange} />
      <text x="20" y="160" fill={C.white} style={{ ...font, fontWeight: 700 }}>Doubles rally at the net</text>
      <text x="20" y="176" fill={C.mute} style={font}>0:05 · Pickleball Court 1 · Demo clip</text>
      {/* library */}
      {side.map(([n, title, len], i) => {
        const y = 20 + i * 56;
        return (
          <g key={n}>
            <rect x="210" y={y} width="90" height="48" rx="6" fill={C.panel} />
            <image href={poster(n)} x="210" y={y} width="90" height="48" preserveAspectRatio="xMidYMid slice" clipPath={`url(#lib-side-${i})`} />
            <rect x="210" y={y} width="90" height="48" rx="6" fill="url(#lib-fade)" />
            <text x="216" y={y + 42} fill={C.white} style={{ ...font, fontSize: 8, fontWeight: 700 }}>{title}</text>
            <rect x="276" y={y + 5} width="19" height="10" rx="2.5" fill={C.bg} fillOpacity="0.75" />
            <text x="285.5" y={y + 12.5} fill={C.white} textAnchor="middle" style={{ ...font, fontSize: 6.5, fontWeight: 700 }}>{len}</text>
          </g>
        );
      })}
    </Svg>
  );
}

export function VenueCalArt() {
  const rows = ["Court A", "Court B", "Table 1", "Pitch"];
  const blocks: [number, number, number, "b" | "m" | "h"][] = [
    [0, 20, 60, "b"], [0, 100, 50, "m"], [0, 170, 60, "b"],
    [1, 40, 70, "b"], [1, 150, 40, "h"],
    [2, 10, 40, "b"], [2, 60, 40, "b"], [2, 130, 90, "b"],
    [3, 0, 60, "m"], [3, 90, 80, "b"],
  ];
  return (
    <Svg label="Venue calendar showing bookings, holds and maintenance blocks">
      <rect x="14" y="16" width="292" height="168" rx="10" fill={C.panel} />
      <text x="28" y="40" fill={C.white} style={{ ...display, fontSize: 15 }}>TODAY · ALL RESOURCES</text>
      {rows.map((r, i) => (
        <g key={r} transform={`translate(0 ${56 + i * 30})`}>
          <text x="28" y="16" fill={C.mute} style={font}>{r}</text>
          <rect x="80" y="2" width="214" height="20" rx="4" fill="#0f1612" />
        </g>
      ))}
      {blocks.map(([r, x, w, t], i) => (
        <rect
          key={i}
          x={80 + x * 0.95}
          y={58 + r * 30}
          width={w * 0.95}
          height="16"
          rx="3"
          fill={t === "b" ? C.lime : t === "m" ? "#5a3a2e" : "none"}
          stroke={t === "h" ? C.lime : "none"}
          strokeDasharray="3 2"
        />
      ))}
      <g style={{ ...font, fontSize: 9 }}>
        <rect x="80" y="176" width="8" height="8" fill={C.lime} />
        <text x="92" y="183" fill={C.mute}>Booked</text>
        <rect x="140" y="176" width="8" height="8" fill="#5a3a2e" />
        <text x="152" y="183" fill={C.mute}>Maintenance</text>
        <rect x="222" y="176" width="8" height="8" fill="none" stroke={C.lime} strokeDasharray="2 1" />
        <text x="234" y="183" fill={C.mute}>Hold</text>
      </g>
    </Svg>
  );
}

export function LedgerArt() {
  const rows: [string, string, string, string][] = [
    ["PB-7KQ2", "₱1,250", "Deposit paid", C.lime],
    ["PB-M3XA", "₱2,000", "Paid", C.lime],
    ["PB-R8TN", "₱600", "Pending", "#FFC94A"],
    ["PB-2HDW", "₱1,500", "Failed", C.orange],
    ["PB-9PLC", "₱400", "Refunded", C.mute],
  ];
  return (
    <Svg label="Payment ledger with clear statuses">
      <rect x="14" y="16" width="292" height="168" rx="10" fill={C.white} />
      <text x="28" y="40" fill={C.bg} style={{ ...display, fontSize: 15 }}>PAYMENTS</text>
      {rows.map(([ref, amt, st, col], i) => (
        <g key={ref} transform={`translate(0 ${56 + i * 24})`}>
          <text x="28" y="12" fill={C.bg} style={{ ...font, fontWeight: 700 }}>{ref}</text>
          <text x="150" y="12" fill={C.bg} textAnchor="end" style={font}>{amt}</text>
          <rect x="196" y="0" width="94" height="17" rx="8.5" fill={col} opacity={col === C.mute ? 0.4 : 1} />
          <text x="243" y="12" fill={C.bg} textAnchor="middle" style={{ ...font, fontSize: 10, fontWeight: 700 }}>{st}</text>
          <line x1="28" x2="290" y1="21" y2="21" stroke="#DFE5DC" />
        </g>
      ))}
    </Svg>
  );
}
