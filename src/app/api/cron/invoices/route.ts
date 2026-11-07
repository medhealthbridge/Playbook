import { NextResponse } from "next/server";
import { addDays, manilaToday } from "@/lib/booking/time";
import { generateInvoices } from "@/lib/server/billing";

export const dynamic = "force-dynamic";

// Runs on the 1st of each month (vercel.json) and invoices the previous month.
// Vercel Cron sends "Authorization: Bearer $CRON_SECRET".
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const today = manilaToday();
  const lastMonth = addDays(`${today.slice(0, 7)}-01`, -1).slice(0, 7);
  const result = await generateInvoices(lastMonth, null);
  return NextResponse.json({ month: lastMonth, ...result });
}
