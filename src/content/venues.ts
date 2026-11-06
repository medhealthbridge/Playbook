// DEMO DATA — fictional venues, prices and schedules for the Playbook demo.
// Replace with real venue inventory (or a VenueAdapter) before launch.
import type { EventSession, MaintenanceBlock, Venue } from "../lib/booking/types.ts";

const STANDARD_POLICY =
  "Free cancellation up to 24 hours before start. Within 24 hours, the amount paid online is non-refundable.";

export const VENUES: Venue[] = [
  {
    id: "kalye",
    name: "Kalye Court Hub",
    area: "Quezon City",
    address: "Demo address · Scout area, Quezon City",
    open: "06:00",
    close: "23:00",
    depositPercent: 50,
    freeCancelHours: 24,
    cancellationPolicy: STANDARD_POLICY,
    amenities: ["Showers", "Lockers", "Water refill", "Parking", "Scoreboard", "Bleachers"],
    equipment: [
      { id: "ball-bb", label: "Basketball rental", price: 100, sports: ["basketball"] },
      { id: "ball-vb", label: "Volleyball + net setup", price: 150, sports: ["volleyball"] },
      { id: "scoreboard", label: "Scoreboard operator", price: 300 },
    ],
    resources: [
      {
        id: "kalye-a",
        venueId: "kalye",
        name: "Court A · Main hardwood",
        kind: "court",
        // Shared court: one availability record for both sports.
        sports: ["basketball", "volleyball"],
        indoor: true,
        surface: "Hardwood",
        capacity: 20,
        hourlyRate: 1200,
        incrementMin: 60,
        minDurationMin: 60,
        maxDurationMin: 180,
        bufferMin: 15,
        recordingCapable: true,
        notes: "Volleyball net setup uses the 15-minute turnover buffer.",
      },
      {
        id: "kalye-b",
        venueId: "kalye",
        name: "Court B · Half court",
        kind: "court",
        sports: ["basketball"],
        indoor: false,
        surface: "Sport tiles (covered)",
        capacity: 10,
        hourlyRate: 600,
        incrementMin: 60,
        minDurationMin: 60,
        maxDurationMin: 120,
        bufferMin: 0,
        recordingCapable: false,
        notes: "Covered outdoor court. Heavy rain may pause play.",
      },
    ],
  },
  {
    id: "cue",
    name: "Cue & Co. Billiards Lounge",
    area: "Makati",
    address: "Demo address · Poblacion, Makati",
    open: "11:00",
    close: "23:30",
    depositPercent: 0,
    freeCancelHours: 24,
    cancellationPolicy: STANDARD_POLICY,
    amenities: ["Air-conditioned", "Café", "Cue racks", "Wi-Fi"],
    equipment: [
      { id: "cue-premium", label: "Premium cue rental", price: 80, sports: ["billiards"] },
      { id: "chalk", label: "Chalk + glove set", price: 40, sports: ["billiards"] },
    ],
    resources: ["1", "2", "3"].map((n) => ({
      id: `cue-t${n}`,
      venueId: "cue",
      name: `Table ${n} · 9-ft pool`,
      kind: "table" as const,
      sports: ["billiards" as const],
      indoor: true,
      surface: "Tournament cloth",
      capacity: 4,
      hourlyRate: n === "1" ? 320 : 250,
      incrementMin: 30,
      minDurationMin: 60,
      maxDurationMin: 240,
      bufferMin: 0,
      recordingCapable: n === "1",
    })),
  },
  {
    id: "rally",
    name: "Rally Point Sports Center",
    area: "Pasig",
    address: "Demo address · Kapitolyo, Pasig",
    open: "07:00",
    close: "22:00",
    depositPercent: 30,
    freeCancelHours: 24,
    cancellationPolicy: STANDARD_POLICY,
    amenities: ["Showers", "Pro shop", "Parking", "Café", "First-aid station"],
    equipment: [
      { id: "racket-bd", label: "Badminton rackets (pair)", price: 120, sports: ["badminton"] },
      { id: "shuttles", label: "Shuttlecock tube", price: 180, sports: ["badminton"] },
      { id: "paddles-pb", label: "Pickleball paddles (4)", price: 200, sports: ["pickleball"] },
      { id: "paddles-tt", label: "Table tennis paddles (pair)", price: 60, sports: ["table-tennis"] },
      { id: "rackets-pd", label: "Padel rackets (4)", price: 300, sports: ["padel"] },
      { id: "bibs", label: "Bibs set", price: 100, sports: ["futsal", "volleyball"] },
    ],
    resources: [
      {
        id: "rally-bd1", venueId: "rally", name: "Badminton Court 1", kind: "court",
        sports: ["badminton"], indoor: true, surface: "Synthetic mat", capacity: 4,
        hourlyRate: 400, incrementMin: 60, minDurationMin: 60, maxDurationMin: 120,
        bufferMin: 0, recordingCapable: true,
      },
      {
        id: "rally-bd2", venueId: "rally", name: "Badminton Court 2", kind: "court",
        sports: ["badminton"], indoor: true, surface: "Synthetic mat", capacity: 4,
        hourlyRate: 400, incrementMin: 60, minDurationMin: 60, maxDurationMin: 120,
        bufferMin: 0, recordingCapable: false,
      },
      {
        id: "rally-pb1", venueId: "rally", name: "Pickleball Court 1", kind: "court",
        sports: ["pickleball"], indoor: true, surface: "Acrylic hard court", capacity: 4,
        hourlyRate: 500, incrementMin: 30, minDurationMin: 60, maxDurationMin: 120,
        bufferMin: 0, recordingCapable: true,
      },
      {
        id: "rally-tt1", venueId: "rally", name: "Table Tennis Table 1", kind: "table",
        sports: ["table-tennis"], indoor: true, surface: "ITTF-style table", capacity: 4,
        hourlyRate: 200, incrementMin: 30, minDurationMin: 30, maxDurationMin: 120,
        bufferMin: 0, recordingCapable: false,
      },
      {
        id: "rally-pd1", venueId: "rally", name: "Padel Court 1", kind: "court",
        sports: ["padel"], indoor: true, surface: "Artificial grass, glass walls", capacity: 4,
        hourlyRate: 1500, incrementMin: 30, minDurationMin: 60, maxDurationMin: 120,
        bufferMin: 0, recordingCapable: true,
      },
      {
        id: "rally-fs1", venueId: "rally", name: "Futsal Pitch", kind: "pitch",
        sports: ["futsal"], indoor: false, surface: "Artificial turf", capacity: 14,
        hourlyRate: 2000, incrementMin: 60, minDurationMin: 60, maxDurationMin: 120,
        bufferMin: 15, recordingCapable: true,
        notes: "Outdoor pitch. Bookings stopped by lightning are rescheduled or refunded.",
      },
      {
        id: "rally-vb1", venueId: "rally", name: "Beach Volleyball Court", kind: "court",
        sports: ["volleyball"], indoor: false, surface: "Sand", capacity: 12,
        hourlyRate: 900, incrementMin: 60, minDurationMin: 60, maxDurationMin: 120,
        bufferMin: 0, recordingCapable: false,
        notes: "Outdoor sand court. Bring sun protection; heavy rain may pause play.",
      },
    ],
  },
];

/** Joinable sessions (pay per player) — separate from renting a whole resource. */
export const EVENTS: EventSession[] = [
  {
    id: "ev-pb-open", sportId: "pickleball", venueId: "rally", title: "Open play doubles",
    dayOffset: 1, startMin: 18 * 60, endMin: 20 * 60, feePerPlayer: 250, spots: 16, level: "All levels",
  },
  {
    id: "ev-st-intro", sportId: "sepak-takraw", venueId: "rally", title: "Sepak takraw intro session",
    dayOffset: 3, startMin: 17 * 60, endMin: 19 * 60, feePerPlayer: 200, spots: 12, level: "Beginner",
  },
  {
    id: "ev-bb-run", sportId: "basketball", venueId: "kalye", title: "Friday night pickup run",
    dayOffset: 2, startMin: 20 * 60, endMin: 22 * 60, feePerPlayer: 150, spots: 20, level: "Intermediate",
  },
];

/** Seeded maintenance blocks, relative to "today" in Manila. */
export const MAINTENANCE_SEED: (Omit<MaintenanceBlock, "date"> & { dayOffset: number })[] = [
  { id: "mt-1", resourceId: "kalye-a", dayOffset: 1, startMin: 14 * 60, endMin: 16 * 60, reason: "Floor cleaning" },
  { id: "mt-2", resourceId: "cue-t2", dayOffset: 0, startMin: 11 * 60, endMin: 13 * 60, reason: "Cloth replacement" },
  { id: "mt-3", resourceId: "rally-fs1", dayOffset: 2, startMin: 7 * 60, endMin: 10 * 60, reason: "Turf grooming" },
];

export const venueById = (id: string) => VENUES.find((v) => v.id === id)!;
export const resourceById = (id: string) => {
  for (const v of VENUES) {
    const r = v.resources.find((r) => r.id === id);
    if (r) return r;
  }
  throw new Error(`Unknown resource ${id}`);
};
