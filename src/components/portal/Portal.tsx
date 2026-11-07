import Link from "next/link";
import type { ReactNode } from "react";

export function PortalHeader({ eyebrow, title, actions, tabs, active }: {
  eyebrow: string;
  title: string;
  actions?: ReactNode;
  tabs?: { key: string; label: string; href: string }[];
  active?: string;
}) {
  return (
    <div className="app-top">
      <div className="container">
        <div className="portal-head">
          <div>
            <p className="eyebrow" style={{ color: "var(--lime)" }}>{eyebrow}</p>
            <h1>{title}</h1>
          </div>
          {actions && <div className="portal-actions">{actions}</div>}
        </div>
        {tabs && (
          <nav className="role-switch" aria-label="Sections">
            {tabs.map((t) => (
              <Link key={t.key} href={t.href} role="tab" aria-selected={active === t.key} aria-current={active === t.key ? "page" : undefined}>
                {t.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </div>
  );
}

export function Flash({ ok, error }: { ok?: string | null; error?: string | null }) {
  if (error) return <div className="alert alert-error" role="alert">{error}</div>;
  if (ok) return <div className="alert alert-ok" role="status">{ok}</div>;
  return null;
}

const STATUS: Record<string, [string, string]> = {
  pending: ["Under review", "badge-warn"],
  active: ["Live", "badge-ok"],
  suspended: ["Suspended", "badge-bad"],
  rejected: ["Not approved", "badge-bad"],
};
export function VenueStatus({ status }: { status: string }) {
  const [label, cls] = STATUS[status] ?? [status, "badge-muted"];
  return <span className={`badge ${cls}`}>{label}</span>;
}

export const peso = (cents: number) => `₱${(cents / 100).toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
export const when = (d: string | Date | null | undefined) =>
  d ? new Date(d).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" }) : "—";
