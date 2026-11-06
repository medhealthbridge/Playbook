// Domain types shared by the booking flow, the player area and the venue admin.

export type SportId =
  | "basketball"
  | "billiards"
  | "volleyball"
  | "badminton"
  | "pickleball"
  | "table-tennis"
  | "futsal"
  | "tennis"
  | "padel"
  | "sepak-takraw";

export type PlayerPlanId = "play" | "replay" | "replay-plus";
export type VenuePlanId = "manage" | "capture" | "club";

export interface EquipmentOption {
  id: string;
  label: string;
  price: number; // PHP, per booking
  sports?: SportId[];
}

export interface Resource {
  id: string;
  venueId: string;
  name: string; // "Court A"
  kind: "court" | "table" | "pitch";
  /**
   * Sports this physical resource supports. Basketball and volleyball on the
   * same court share ONE availability record because they book the same resource.
   */
  sports: SportId[];
  indoor: boolean;
  surface: string;
  capacity: number;
  hourlyRate: number; // PHP
  incrementMin: number; // booking start granularity
  minDurationMin: number;
  maxDurationMin: number;
  bufferMin: number; // setup/turnover buffer required between bookings
  recordingCapable: boolean; // a camera covers this resource
  notes?: string;
}

export interface Venue {
  id: string;
  name: string;
  area: string; // "Quezon City"
  address: string;
  open: string; // "06:00"
  close: string; // "23:00"
  depositPercent: number; // 0 = pay in full now
  cancellationPolicy: string;
  freeCancelHours: number;
  amenities: string[];
  equipment: EquipmentOption[];
  resources: Resource[];
}

export interface MaintenanceBlock {
  id: string;
  resourceId: string;
  date: string;
  startMin: number;
  endMin: number;
  reason: string;
}

export type BookingStatus = "held" | "confirmed" | "cancelled" | "expired";
export type PaymentStatus =
  | "unpaid"
  | "pending"
  | "deposit_paid"
  | "paid"
  | "failed"
  | "refund_due"
  | "refunded";

export interface Participant {
  id: string;
  name: string;
  role: "owner" | "invitee";
  status: "accepted" | "invited";
  /** Invitations never grant recording access automatically. */
  recordingAccess: boolean;
}

export interface PriceBreakdown {
  rental: number;
  equipment: { id: string; label: string; price: number }[];
  subtotal: number;
  dueNow: number; // deposit or full amount
  balance: number; // remaining, paid at venue
  depositPercent: number;
}

export interface Booking {
  id: string;
  ref: string;
  venueId: string;
  resourceId: string;
  sportId: SportId;
  date: string;
  startMin: number;
  endMin: number;
  ownerId: string; // "demo-player" or another customer id
  ownerName: string;
  participants: Participant[];
  equipmentIds: string[];
  price: PriceBreakdown;
  status: BookingStatus;
  holdExpiresAt?: number;
  payment: { status: PaymentStatus; amountPaid: number; updatedAt: number };
  createdAt: number;
  cancellation?: { at: number; by: "player" | "venue"; refund: number; note: string };
}

export type RecordingStatus = "awaiting_upload" | "processing" | "ready" | "failed" | "expired";
export type RecordingSource = "cctv_export" | "camera_upload";
export type ClipKind = "basketball" | "rally" | "billiards" | "futsal" | "volleyball";

export interface Clip {
  id: string;
  title: string;
  kind: ClipKind;
  startSec: number;
  endSec: number;
  published: boolean;
}

export interface Recording {
  id: string;
  bookingId: string;
  source: RecordingSource;
  status: RecordingStatus;
  clips: Clip[];
  retainUntil: string; // date
  failureReason?: string;
}

export interface EventSession {
  id: string;
  sportId: SportId;
  venueId: string;
  title: string;
  dayOffset: number;
  startMin: number;
  endMin: number;
  feePerPlayer: number;
  spots: number;
  level: string;
}
