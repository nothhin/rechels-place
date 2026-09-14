import { syncAirbnbCalendar } from "@/lib/server/airbnb-calendar";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`
    || request.headers.get("x-cron-secret") === secret;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await syncAirbnbCalendar();
    return Response.json({ ok: true, data: result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Calendar sync failed." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
