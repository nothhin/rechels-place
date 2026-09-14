import { createPublicSupabaseClient } from "@/lib/supabase/public-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const noStoreHeaders = { "Cache-Control": "no-store" };

export async function GET() {
  const supabase = createPublicSupabaseClient();
  if (!supabase) {
    return Response.json(
      {
        status: "not_ready",
        code: "REQUIRED_CONFIGURATION_MISSING",
        checks: { application: "ok", configuration: "failed", database: "not_checked" },
      },
      { status: 503, headers: noStoreHeaders },
    );
  }

  try {
    const { error } = await supabase.from("snowaz_calendar_ranges").select("source_id", { head: true, count: "exact" });
    if (error) throw error;
    return Response.json(
      { status: "ready", checks: { application: "ok", configuration: "ok", database: "ok" } },
      { headers: noStoreHeaders },
    );
  } catch {
    return Response.json(
      {
        status: "not_ready",
        code: "DATABASE_UNAVAILABLE",
        checks: { application: "ok", configuration: "ok", database: "failed" },
      },
      { status: 503, headers: noStoreHeaders },
    );
  }
}
