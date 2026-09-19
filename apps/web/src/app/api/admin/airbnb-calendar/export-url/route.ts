import { requireStaff } from "@/lib/server/admin-auth";
import {
  getAirbnbCalendarConfiguration,
  getAirbnbCalendarExportUrl,
} from "@/lib/server/airbnb-calendar";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  await requireStaff(["manager", "admin"]);
  const configuration = getAirbnbCalendarConfiguration();
  if (!configuration.exportToken || !configuration.serviceRoleKey) {
    return Response.json({ ok: false, error: "The website calendar feed is not configured." }, { status: 503 });
  }
  const configuredUrl = getAirbnbCalendarExportUrl();
  const url = configuredUrl?.startsWith("http")
    ? configuredUrl
    : getAirbnbCalendarExportUrl(new URL(request.url).origin);
  if (!url) return Response.json({ ok: false, error: "The website calendar feed is not configured." }, { status: 503 });
  return Response.json({ ok: true, url }, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Referrer-Policy": "no-referrer",
    },
  });
}
