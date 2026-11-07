import "server-only";

const API = "https://api.paymongo.com/v1";

export class PaymongoError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

async function pm<T>(secret: string, path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Basic ${Buffer.from(`${secret}:`).toString("base64")}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as { errors?: { detail?: string }[] } & T;
  if (!res.ok) throw new PaymongoError(json.errors?.[0]?.detail || `PayMongo error ${res.status}`, res.status);
  return json;
}

export const keyMode = (k: string) => (k.startsWith("sk_live_") || k.startsWith("pk_live_") ? "live" : k.startsWith("sk_test_") || k.startsWith("pk_test_") ? "test" : null);

/** Checks the secret key works (lists webhooks, a harmless read). */
export async function verifySecretKey(secret: string) {
  await pm(secret, "/webhooks");
}

type WebhookRes = { data: { id: string; attributes: { secret_key: string } } };
export async function createWebhook(secret: string, url: string) {
  const r = await pm<WebhookRes>(secret, "/webhooks", {
    method: "POST",
    body: { data: { attributes: { url, events: ["checkout_session.payment.paid", "payment.refunded", "payment.failed"] } } },
  });
  return { id: r.data.id, secretKey: r.data.attributes.secret_key };
}

export async function disableWebhook(secret: string, id: string) {
  await pm(secret, `/webhooks/${id}/disable`, { method: "POST" }).catch(() => {});
}

type CheckoutRes = {
  data: { id: string; attributes: { checkout_url: string; status: string; payments?: { id: string; attributes: { amount: number; status: string } }[]; payment_intent?: { id: string; attributes?: { status?: string } } | null } };
};

export async function createCheckout(secret: string, o: {
  amountCents: number; name: string; description: string; reference: string; successUrl: string; cancelUrl: string;
  customer: { name: string; email: string; phone?: string | null }; metadata: Record<string, string>;
}) {
  const r = await pm<CheckoutRes>(secret, "/checkout_sessions", {
    method: "POST",
    body: {
      data: {
        attributes: {
          line_items: [{ currency: "PHP", amount: o.amountCents, name: o.name, quantity: 1 }],
          payment_method_types: ["gcash", "paymaya", "card", "grab_pay", "qrph"],
          description: o.description,
          reference_number: o.reference,
          success_url: o.successUrl,
          cancel_url: o.cancelUrl,
          send_email_receipt: true,
          show_description: true,
          show_line_items: true,
          billing: { name: o.customer.name, email: o.customer.email, ...(o.customer.phone ? { phone: o.customer.phone } : {}) },
          metadata: o.metadata,
        },
      },
    },
  });
  return { id: r.data.id, url: r.data.attributes.checkout_url };
}

/** Paid payments on a checkout session. */
export async function checkoutPayments(secret: string, id: string) {
  const r = await pm<CheckoutRes>(secret, `/checkout_sessions/${id}`);
  const payments = (r.data.attributes.payments ?? []).filter((p) => p.attributes.status === "paid");
  return { paidCents: payments.reduce((s, p) => s + p.attributes.amount, 0), paymentId: payments[0]?.id ?? null };
}

export async function refund(secret: string, paymentId: string, amountCents: number, notes: string) {
  const r = await pm<{ data: { id: string; attributes: { status: string } } }>(secret, "/refunds", {
    method: "POST",
    body: { data: { attributes: { amount: amountCents, payment_id: paymentId, reason: "requested_by_customer", notes: notes.slice(0, 200) } } },
  });
  return { id: r.data.id, status: r.data.attributes.status };
}
