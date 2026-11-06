"use client";
import type { DisplayStatus, VideoAccess } from "@/lib/booking/rules";
import type { PaymentStatus } from "@/lib/booking/types";

export function StatusBadge({ status }: { status: DisplayStatus }) {
  const cls: Record<DisplayStatus, string> = {
    Confirmed: "badge-ok",
    "Awaiting payment": "badge-warn",
    "Payment failed": "badge-bad",
    "Hold expired": "badge-muted",
    Cancelled: "badge-muted",
    Completed: "badge-muted",
    "Refund due": "badge-warn",
  };
  return <span className={`badge ${cls[status]}`}>{status}</span>;
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  const map: Record<PaymentStatus, [string, string]> = {
    unpaid: ["Unpaid", "badge-muted"],
    pending: ["Pending", "badge-warn"],
    deposit_paid: ["Deposit paid", "badge-ok"],
    paid: ["Paid", "badge-ok"],
    failed: ["Failed", "badge-bad"],
    refund_due: ["Refund due", "badge-warn"],
    refunded: ["Refunded", "badge-muted"],
  };
  const [l, c] = map[status];
  return <span className={`badge ${c}`}>{l}</span>;
}

export const ACCESS_LABEL: Record<Exclude<VideoAccess, { ok: true }>["code"], [string, string]> = {
  venue_no_video: ["Not recorded at this venue", "badge-muted"],
  not_recorded: ["Not recorded", "badge-muted"],
  awaiting_upload: ["Awaiting upload", "badge-warn"],
  processing: ["Processing", "badge-warn"],
  failed: ["Failed", "badge-bad"],
  expired: ["Expired", "badge-muted"],
  not_published: ["Not published yet", "badge-warn"],
  not_participant: ["No access", "badge-muted"],
  restricted_by_plan: ["Restricted by plan", "badge-muted"],
};

export function DateTile({ date }: { date: string }) {
  const [, m, d] = date.split("-").map(Number);
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  return (
    <div className="date-tile" aria-hidden="true">
      <div className="d num">{d}</div>
      <div className="m">{months[m - 1]}</div>
    </div>
  );
}

export const fmtSec = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
