import { requireStaff } from "@/lib/server/admin-auth";
import { syncAirbnbCalendar } from "@/lib/server/airbnb-calendar";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  await requireStaff(["manager", "admin"]);
  try {
    const result = await syncAirbnbCalendar();
    return Response.json({ ok: true, data: result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Calendar sync failed." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
