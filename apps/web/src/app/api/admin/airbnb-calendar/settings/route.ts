import { requireStaff } from "@/lib/server/admin-auth";
import { clearAirbnbImportUrl, saveAirbnbImportUrl } from "@/lib/server/airbnb-calendar";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return origin === new URL(request.url).origin;
}

export async function POST(request: Request) {
  await requireStaff(["manager", "admin"]);
  if (!sameOrigin(request)) return Response.json({ ok: false, error: "Invalid request origin." }, { status: 403 });
  try {
    const body = await request.text();
    if (body.length > 4096) return Response.json({ ok: false, error: "Calendar link is too long." }, { status: 413 });
    const input = JSON.parse(body) as { importUrl?: unknown };
    if (typeof input.importUrl !== "string") return Response.json({ ok: false, error: "Enter an Airbnb calendar link." }, { status: 400 });
    await saveAirbnbImportUrl(input.importUrl);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Could not save calendar link." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  await requireStaff(["manager", "admin"]);
  if (!sameOrigin(request)) return Response.json({ ok: false, error: "Invalid request origin." }, { status: 403 });
  try {
    await clearAirbnbImportUrl();
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false, error: "Could not restore the Vercel calendar link." }, { status: 503 });
  }
}
