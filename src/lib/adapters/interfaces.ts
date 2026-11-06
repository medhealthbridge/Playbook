// Replaceable service boundaries. The demo ships localStorage-backed
// implementations (see ../demo/store.ts). Production swaps each for a real
// server-backed adapter WITHOUT changing UI components.
import type {
  Booking,
  MaintenanceBlock,
  PlayerPlanId,
  Recording,
  RecordingSource,
  SportId,
  VenuePlanId,
} from "../booking/types.ts";

export interface AuthAdapter {
  /** Production: real sessions with server-enforced roles + venue isolation. */
  currentUser(): Promise<{ id: string; name: string; role: "player" | "venue_staff"; venueIds: string[] } | null>;
}

export interface HoldRequest {
  venueId: string;
  resourceId: string;
  sportId: SportId;
  date: string;
  startMin: number;
  durationMin: number;
  equipmentIds: string[];
}

export interface BookingAdapter {
  /** Must atomically reject overlaps on the physical resource (DB exclusion constraint). */
  createHold(req: HoldRequest): Promise<Booking>;
  cancel(bookingId: string, by: "player" | "venue"): Promise<Booking>;
  addMaintenance(block: Omit<MaintenanceBlock, "id">): Promise<MaintenanceBlock>;
}

export interface PaymentAdapter {
  /** Production: redirect to PSP checkout. Confirmation ONLY via verified, idempotent webhooks. */
  startCheckout(bookingId: string): Promise<{ checkoutId: string }>;
  /** Webhook handler semantics: re-check the hold; if the slot is gone, mark refund_due. */
  handlePaymentEvent(evt: { bookingId: string; eventId: string; outcome: "succeeded" | "failed" | "pending" }): Promise<Booking>;
}

export interface MediaAdapter {
  /** Production: private bucket, signed short-lived upload/playback URLs, per-venue isolation. */
  startUpload(bookingId: string, source: RecordingSource): Promise<Recording>;
  playbackUrl(recordingId: string, clipId: string): Promise<{ url: string; expiresAt: number }>;
}

export interface ProcessingAdapter {
  status(recordingId: string): Promise<Recording["status"]>;
}

export interface CameraImportAdapter {
  /** Future: import exported CCTV files. Never expose live/raw feeds. */
  listExports(venueId: string, resourceId: string, date: string): Promise<{ id: string; label: string }[]>;
}

export interface SubscriptionAdapter {
  setPlayerPlan(userId: string, plan: PlayerPlanId): Promise<void>;
  setVenuePlan(venueId: string, plan: VenuePlanId): Promise<void>;
}
