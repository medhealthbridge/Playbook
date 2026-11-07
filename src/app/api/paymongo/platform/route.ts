import { NextResponse } from "next/server";
import { verifyPaymongoSignature } from "@/lib/payments/paymongoSignature";
import { markInvoicePaid, platformPaymongo } from "@/lib/server/billing";
import { decrypt } from "@/lib/server/crypto";
import { q1 } from "@/lib/server/db";

export const dynamic = "force-dynamic";

// Webhook on Playbook's own PayMongo account: venue invoice payments.
export async function POST(req: Request) {
  const raw = await req.text();
  const pm = await platformPaymongo();
  if (!pm) return NextResponse.json({ error: "not configured" }, { status: 404 });
  if (!verifyPaymongoSignature(req.headers.get("paymongo-signature"), raw, decrypt(pm.webhook_secret_enc), pm.livemode)) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }
  const evt = JSON.parse(raw) as { data: { id: string; attributes: { type: string; data: { id: string; attributes: { metadata?: Record<string, string>; payments?: { id: string; attributes: { amount: number; status: string } }[] } } } } };
  const fresh = await q1<{ id: string }>("INSERT INTO payment_event (id, type, payload) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING RETURNING id", [evt.data.id, evt.data.attributes.type, raw]);
  if (!fresh) return NextResponse.json({ ok: true, duplicate: true });
  if (evt.data.attributes.type === "checkout_session.payment.paid") {
    const obj = evt.data.attributes.data;
    const invoiceId = obj.attributes.metadata?.invoice_id ?? (await q1<{ id: string }>("SELECT id FROM invoice WHERE checkout_session_id=$1", [obj.id]))?.id;
    const paid = (obj.attributes.payments ?? []).filter((p) => p.attributes.status === "paid");
    if (invoiceId) await markInvoicePaid(invoiceId, "PayMongo", null, paid[0]?.id);
  }
  return NextResponse.json({ ok: true });
}
