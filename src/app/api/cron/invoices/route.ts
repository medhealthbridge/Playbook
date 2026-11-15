import { NextResponse } from "next/server";
import { addDays, manilaToday } from "@/lib/booking/time";
import { generateInvoices } from "@/lib/server/billing";

export const dynamic = "force-dynamic";

// Runs every Monday (vercel.json) and creates each venue's statement for the week before (Monday to Sunday).
// Vercel Cron sends "Authorization: Bearer $CRON_SECRET".
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // Any day in last week; generateInvoices bills the whole Monday-Sunday week containing it.
  const lastWeek = addDays(manilaToday(), -7);
  const result = await generateInvoices(lastWeek, null);
  return NextResponse.json(result);
}
