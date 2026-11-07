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
  // Pickleball court thumbnail: blue court, green surround, kitchen lines either side of the net.
  return (
    <Svg label="Pickleball clip thumbnail and personal highlight library">
      <rect x="20" y="20" width="176" height="104" rx="8" fill="#3c6b4a" />
      <rect x="32" y="32" width="152" height="80" fill="#2f63a8" />
      <g stroke={C.white} strokeOpacity="0.85" fill="none" strokeWidth="1.5">
        <rect x="32" y="32" width="152" height="80" />
        <line x1="83" y1="32" x2="83" y2="112" />
        <line x1="133" y1="32" x2="133" y2="112" />
        <line x1="32" y1="72" x2="83" y2="72" />
        <line x1="133" y1="72" x2="184" y2="72" />
      </g>
      <line x1="108" y1="28" x2="108" y2="116" stroke="#0b100d" strokeWidth="3" />
      <circle cx="146" cy="52" r="5" fill="#E8F24A" />
      <path d="M58 96 C 80 60, 112 44, 146 52" stroke={C.lime} strokeWidth="2" strokeDasharray="2 5" fill="none" />
      <rect x="20" y="134" width="176" height="6" rx="3" fill={C.dim} />
      <rect x="60" y="134" width="22" height="6" rx="3" fill={C.lime} />
      <rect x="120" y="134" width="14" height="6" rx="3" fill={C.lime} />
      <text x="20" y="160" fill={C.white} style={{ ...font, fontWeight: 700 }}>Doubles rally at the net</text>
      <text x="20" y="176" fill={C.mute} style={font}>0:05 · Pickleball Court 1 · Demo clip</text>
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(210 ${20 + i * 56})`}>
          <rect width="90" height="48" rx="6" fill={i === 1 ? "#1f6b45" : i === 2 ? "#2a5aa8" : "#6b4a2b"} />
          <text x="6" y="42" fill={C.white} style={{ ...font, fontSize: 9 }}>{["Block at the rim", "Cut shot to the corner", "Lob and smash"][i]}</text>
        </g>
      ))}
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
