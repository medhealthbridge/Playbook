import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Flash, peso, when } from "@/components/portal/Portal";
import { billingSettings, markInvoicePaid, platformPaymongo } from "@/lib/server/billing";
import { decrypt } from "@/lib/server/crypto";
import { q, q1 } from "@/lib/server/db";
import { checkoutPayments } from "@/lib/server/paymongo";
import { requireVenueRole } from "@/lib/server/session";
import { payInvoice } from "../../../actions";

export const metadata: Metadata = { title: "Invoice — Playbook", robots: { index: false } };
export const dynamic = "force-dynamic";

type Inv = {
  id: string; number: string; venue_id: string; period_start: string; period_end: string; plan: string; subscription_cents: number; booking_count: number;
  booking_fee_cents: number; total_cents: number; status: string; due_date: string; paid_at: string | null; paid_via: string | null; checkout_session_id: string | null;
  created_at: string; venue: string; business_name: string | null; address: string; area: string;
};

export default async function InvoicePage({ params, searchParams }: { params: Promise<{ id: string; invoiceId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id, invoiceId } = await params;
  const sp = await searchParams;
  await requireVenueRole(id, "owner");
  const load = () => q1<Inv>(
    `SELECT i.id, i.number, i.venue_id, to_char(i.period_start,'Mon DD, YYYY') AS period_start, to_char(i.period_end,'Mon DD, YYYY') AS period_end, i.plan,
            i.subscription_cents, i.booking_count, i.booking_fee_cents, i.total_cents, i.status, to_char(i.due_date,'Mon DD, YYYY') AS due_date, i.paid_at, i.paid_via,
            i.checkout_session_id, i.created_at, v.name AS venue, v.business_name, v.address, v.area
       FROM invoice i JOIN venue v ON v.id=i.venue_id WHERE i.id=$1 AND i.venue_id=$2`,
    [invoiceId, id],
  );
  let inv = await load();
  if (!inv) notFound();
  const [billing, pm] = await Promise.all([billingSettings(), platformPaymongo()]);
  let paidNote: string | null = null;
  if (sp.paid && inv.status === "open" && inv.checkout_session_id && pm) {
    try {
      const p = await checkoutPayments(decrypt(pm.secret_enc), inv.checkout_session_id);
      if (p.paidCents >= inv.total_cents && (await markInvoicePaid(inv.id, "PayMongo", null, p.paymentId ?? undefined))) {
        paidNote = "Payment received. Thank you!";
        inv = (await load())!;
      }
    } catch (e) {
      console.error("invoice payment check failed", e);
    }
  }
  const fees = await q<{ ref: string; date: string; fee: number }>(
    `SELECT ref, to_char(date,'Mon DD') AS date, platform_fee_cents AS fee FROM booking
      WHERE venue_id=$1 AND platform_fee_cents > 0 AND status IN ('confirmed','completed','no_show')
        AND (confirmed_at AT TIME ZONE 'Asia/Manila')::date BETWEEN to_date($2,'Mon DD, YYYY') AND to_date($3,'Mon DD, YYYY') ORDER BY date LIMIT 500`,
    [id, inv.period_start, inv.period_end],
  );
  return (
    <main id="main" className="app-shell">
      <div className="app-body">
        <div className="container app-stack" style={{ maxWidth: 820 }}>
          <p className="no-print"><Link href={`/venue/${id}?tab=billing`}>← Billing</Link></p>
          <Flash ok={paidNote ?? sp.ok} error={sp.error} />
          <article className="app-card invoice">
            <div className="inline-form">
              <div style={{ marginRight: "auto" }}>
                <p className="eyebrow">Playbook</p>
                <h1>Invoice {inv.number}</h1>
              </div>
              <span className={`badge ${inv.status === "paid" ? "badge-ok" : inv.status === "open" ? "badge-warn" : "badge-muted"}`}>{inv.status}</span>
            </div>
            <dl className="kv">
              <dt>Billed to</dt><dd>{inv.business_name || inv.venue}<br /><span className="hint">{inv.venue} · {inv.address}</span></dd>
              <dt>Period</dt><dd>{inv.period_start} – {inv.period_end}</dd>
              <dt>Issued</dt><dd>{when(inv.created_at)}</dd>
              <dt>Due</dt><dd>{inv.due_date}</dd>
              {inv.paid_at && (<><dt>Paid</dt><dd>{when(inv.paid_at)} · {inv.paid_via}</dd></>)}
            </dl>
            <table className="data-table">
              <thead><tr><th scope="col">Item</th><th scope="col" style={{ textAlign: "right" }}>Amount</th></tr></thead>
              <tbody>
                <tr><td>{inv.plan === "trial" ? "Free trial" : `${inv.plan[0].toUpperCase()}${inv.plan.slice(1)} plan`} · monthly subscription</td><td style={{ textAlign: "right" }}>{peso(inv.subscription_cents)}</td></tr>
                <tr><td>Booking fees · {inv.booking_count} bookings made through Playbook</td><td style={{ textAlign: "right" }}>{peso(inv.booking_fee_cents)}</td></tr>
                <tr><td><strong>Total</strong></td><td style={{ textAlign: "right" }}><strong>{peso(inv.total_cents)}</strong></td></tr>
              </tbody>
            </table>
            {fees.length > 0 && (
              <details>
                <summary>Booking fee details</summary>
                <table className="data-table">
                  <tbody>{fees.map((f) => <tr key={f.ref}><td>{f.date} · {f.ref}</td><td style={{ textAlign: "right" }}>{peso(f.fee)}</td></tr>)}</tbody>
                </table>
              </details>
            )}
          </article>
          {inv.status === "open" && (
            <section className="app-card no-print">
              <h2>Pay this invoice</h2>
              {pm ? (
                <form action={payInvoice}>
                  <input type="hidden" name="venue_id" value={id} />
                  <input type="hidden" name="id" value={inv.id} />
                  <button className="btn" type="submit">Pay {peso(inv.total_cents)} · GCash, Maya, card</button>
                </form>
              ) : null}
              {billing.manual_instructions && <p style={{ whiteSpace: "pre-line" }}>{pm ? "Or pay manually: " : ""}{billing.manual_instructions}</p>}
              {!pm && !billing.manual_instructions && <p className="hint">Payment instructions will be sent to you by Playbook.</p>}
            </section>
          )}
          <p className="no-print hint">Use your browser&apos;s Print to save this invoice as PDF.</p>
        </div>
      </div>
    </main>
  );
}
