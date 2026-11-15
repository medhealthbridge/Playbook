import { NextResponse } from "next/server";
import { publicVenues } from "@/lib/server/bookings";

export const dynamic = "force-dynamic";

// Live venues for the homepage: only approved, active venues with at least one active court.
export async function GET() {
  const rows = await publicVenues();
  const venues = rows.map((v) => ({
    slug: v.slug, name: v.name, area: v.area, open: v.open_time, close: v.close_time, courts: v.courts, fromCents: v.from_cents,
    sports: v.sports ?? [], payOnline: !!v.paymongo_connected_at, depositPercent: v.deposit_percent,
  }));
  return NextResponse.json({ venues }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
}
