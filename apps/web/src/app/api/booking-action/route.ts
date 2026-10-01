import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { verifyBookingEmailActionToken } from "@/lib/server/booking-email-action-token";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const formData = await request.formData();
  const token = formData.get("token");
  const fallback = new URL("/booking-action/invalid", request.url);
  if (typeof token !== "string") return NextResponse.redirect(fallback, 303);

  const payload = verifyBookingEmailActionToken(token);
  if (!payload) return NextResponse.redirect(fallback, 303);

  let result = "error";
  try {
    const admin = createSupabaseAdminClient();
    const response = await admin.rpc("apply_rechels_email_booking_decision", {
      target_id: payload.bookingId,
      decision: payload.decision,
    });
    if (response.error) throw response.error;
    result = typeof response.data === "string" ? response.data : "error";

    if (["accepted", "declined"].includes(result)) {
      for (const path of ["/", "/admin", "/admin/confirmed", "/admin/operations", "/booking-status"]) {
        revalidatePath(path);
      }
    }
  } catch (error) {
    console.error("[booking-email-action] decision failed", {
      decision: payload.decision,
      message: error instanceof Error ? error.message.slice(0, 160) : "unknown",
    });
  }

  const destination = new URL(`/booking-action/${encodeURIComponent(token)}`, request.url);
  destination.searchParams.set("result", result);
  return NextResponse.redirect(destination, 303);
}
