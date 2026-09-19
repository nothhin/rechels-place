import { requireStaff } from "@/lib/server/admin-auth";
import { syncAirbnbCalendar } from "@/lib/server/airbnb-calendar";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return origin === new URL(request.url).origin;
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ ok: false, error: "Invalid request origin." }, { status: 403 });
  await requireStaff(["manager", "admin"]);
  try {
    const result = await syncAirbnbCalendar({ trigger: "manual" });
    return Response.json({ ok: true, data: result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Calendar sync failed." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
