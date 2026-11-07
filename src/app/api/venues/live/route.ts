import { NextResponse } from "next/server";
import { q1 } from "@/lib/server/db";

// How many venues are live, so the marketing pages know whether to send
// "Book a slot" to real venues or to the interactive demo. Cached briefly.
export const dynamic = "force-dynamic";
const cache = { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" };

export async function GET() {
  try {
    const r = await q1<{ n: number }>(
      "SELECT count(*)::int AS n FROM venue v WHERE v.status='active' AND EXISTS (SELECT 1 FROM resource r WHERE r.venue_id=v.id AND r.active)",
    );
    return NextResponse.json({ live: r?.n ?? 0 }, { headers: cache });
  } catch {
    return NextResponse.json({ live: 0 });
  }
}
