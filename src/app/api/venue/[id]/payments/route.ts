import { NextResponse } from "next/server";
import { q } from "@/lib/server/db";
import { getSession, isPlatformAdmin, venueRole } from "@/lib/server/session";

export const dynamic = "force-dynamic";

// Online payments that reached this venue since `since` (ms). Polled by the payment bell on venue screens.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "sign in" }, { status: 401 });
  if (!isPlatformAdmin(session.user) && !(await venueRole(session.user.id, id))) return NextResponse.json({ error: "not your venue" }, { status: 403 });
  const raw = Number(new URL(req.url).searchParams.get("since"));
  const now = Date.now();
  // Never look back more than 10 minutes, whatever the client sends.
  const since = new Date(Number.isFinite(raw) && raw > now - 600_000 ? raw : now).toISOString();
  const items = await q<{ key: string; name: string; amount: number; kind: string; at: string }>(
    `SELECT * FROM (
       SELECT 'b-' || b.id AS key, b.customer_name AS name, b.paid_cents AS amount, 'Court booking ' || b.ref AS kind, b.confirmed_at AS at
         FROM booking b WHERE b.venue_id=$1 AND b.pay_method='online' AND b.confirmed_at > $2
       UNION ALL
       SELECT 'p-' || p.id, p.name, p.paid_cents, 'Open play · ' || s.title, p.paid_at
         FROM open_play_player p JOIN open_play_session s ON s.id=p.session_id WHERE s.venue_id=$1 AND p.paid_online AND p.paid_at > $2
     ) t ORDER BY at LIMIT 20`,
    [id, since],
  );
  return NextResponse.json({ now, items }, { headers: { "Cache-Control": "no-store" } });
}
