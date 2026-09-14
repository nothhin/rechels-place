import {
  buildWebsiteIcalFeed,
  getAirbnbCalendarConfiguration,
  isAirbnbExportTokenValid,
} from "@/lib/server/airbnb-calendar";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const configuration = getAirbnbCalendarConfiguration();
  const exportToken = token.endsWith(".ics") ? token.slice(0, -4) : token;
  if (!isAirbnbExportTokenValid(exportToken, configuration.exportToken)) {
    return new Response("Not found", { status: 404 });
  }
  try {
    const feed = await buildWebsiteIcalFeed();
    return new Response(feed, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "Content-Disposition": 'inline; filename="rechels-place-availability.ics"',
        "Content-Type": "text/calendar; charset=utf-8",
      },
    });
  } catch {
    // Never log the request URL or token: the calendar URL is a bearer secret.
    console.error("Airbnb export feed unavailable after calendar read");
    return new Response("Calendar temporarily unavailable", {
      status: 503,
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  }
}
