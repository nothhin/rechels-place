import { stayDateSchema, stayNights } from "@uppadar-hollie/shared/booking";
import { after } from "next/server";
import { syncAirbnbCalendarIfStale } from "@/lib/server/airbnb-calendar";
import { createPublicSupabaseClient } from "@/lib/supabase/public-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const noStoreHeaders = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  const url = new URL(request.url);
  const from = stayDateSchema.safeParse(url.searchParams.get("from"));
  const to = stayDateSchema.safeParse(url.searchParams.get("to"));

  if (!from.success || !to.success || from.data >= to.data || stayNights(from.data, to.data) > 93) {
    return Response.json({ requestId, error: { code: "INVALID_SCHEDULE_RANGE", message: "Choose a valid calendar range of up to 93 days." } }, { status: 400, headers: noStoreHeaders });
  }

  const supabase = createPublicSupabaseClient();
  if (!supabase) {
    return Response.json({ requestId, error: { code: "SERVICE_NOT_CONFIGURED", message: "Live availability is not configured yet." } }, { status: 503, headers: noStoreHeaders });
  }

  try {
    const { data, error } = await supabase.rpc("get_snowaz_schedule", {
      range_start: from.data,
      range_end: to.data,
    });
    if (error) throw error;

    // Keep availability fresh without delaying the public calendar response.
    // A Vercel cron can call the dedicated sync route as well; this fallback
    // keeps the calendar self-healing when the scheduler is unavailable.
    after(() => syncAirbnbCalendarIfStale().catch((syncError: unknown) => {
      console.warn("[airbnb-calendar] background sync failed", syncError instanceof Error ? syncError.message : "unknown error");
    }));

    return Response.json({ requestId, data: { from: from.data, to: to.data, ranges: [
      ...(data ?? []).map((range: { check_in: string; check_out: string; display_status: string; public_label: string | null }) => ({ checkIn: range.check_in, checkOut: range.check_out, status: range.display_status, label: range.public_label })),
    ] } }, { headers: noStoreHeaders });
  } catch {
    return Response.json({ requestId, error: { code: "SCHEDULE_UNAVAILABLE", message: "Availability could not be checked right now." } }, { status: 503, headers: noStoreHeaders });
  }
}
