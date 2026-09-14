"use server";

import { redirect } from "next/navigation";
import { bookingEnquirySchema } from "@uppadar-hollie/shared/booking";
import {
  createDepositToken,
  hashDepositToken,
} from "@/lib/server/deposit-token";
import { createPublicSupabaseClient } from "@/lib/supabase/public-server";

export type BookingActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  bookingReference?: string;
  depositLink?: string;
  depositExpiresAt?: string;
};

async function saveBookingRequest(formData: FormData) {
  const parsed = bookingEnquirySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success || parsed.data.website)
    return {
      ok: false as const,
      message: "Please check every required field and try again.",
    };
  const supabase = createPublicSupabaseClient();
  if (!supabase)
    return {
      ok: false as const,
      message:
        "Online requests are temporarily unavailable. Please contact Rechel's Place directly.",
    };
  const depositToken = createDepositToken();
  const bedroomLabel = "Entire two-bedroom condo";
  const bookingRequests = [
    `Stay selection: ${bedroomLabel}`,
    parsed.data.specialRequests,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const { data, error } = await supabase.rpc(
      "submit_snowaz_booking_request",
      {
        request_idempotency: parsed.data.idempotencyKey,
        guest_name: parsed.data.fullName,
        guest_email: parsed.data.email,
        guest_phone: parsed.data.phone,
        arrival: parsed.data.checkIn,
        departure: parsed.data.checkOut,
        guests: parsed.data.guests,
        bedroom_selection: parsed.data.bedroomChoice,
        parking_selection: parsed.data.parkingType,
        early_check_in_hours: parsed.data.earlyCheckInHours,
        late_checkout_hours: parsed.data.lateCheckoutHours,
        requests: bookingRequests,
        contact_method: parsed.data.preferredContact,
        consent_version: "booking-request-v2",
        token_hash: hashDepositToken(depositToken),
      },
    );
    if (error) throw error;
    const booking = Array.isArray(data) ? data[0] : null;
    if (!booking) throw new Error("Booking request was not created.");
    const result = {
      bookingReference: booking.booking_reference as string,
      depositExpiresAt: booking.deposit_expires_at as string,
    };

    const notificationEmail = process.env.BOOKING_NOTIFICATION_EMAIL;
    if (notificationEmail) {
      try {
        const notificationResponse = await fetch(
          `https://formsubmit.co/ajax/${encodeURIComponent(notificationEmail)}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({
              _subject: `New Rechel's Place booking request - ${result.bookingReference}`,
              name: parsed.data.fullName,
              email: parsed.data.email || "Not provided",
              phone: parsed.data.phone,
              contact_method: "Phone call",
              check_in: parsed.data.checkIn,
              check_out: parsed.data.checkOut,
              guests: parsed.data.guests,
              bedroom_selection: bedroomLabel,
              special_requests: parsed.data.specialRequests || "None",
            }),
          },
        );
        if (!notificationResponse.ok)
          console.warn(
            "[booking-request] FormSubmit rejected the notification",
            { status: notificationResponse.status },
          );
      } catch {
        console.warn(
          "[booking-request] email notification failed; request remains saved in admin",
        );
      }
    }
    return { ok: true as const, data: parsed.data, depositToken, ...result };
  } catch (error) {
    console.error("[booking-request] database insert failed", {
      error: error instanceof Error ? error.name : "unknown",
    });
    return {
      ok: false as const,
      message:
        "Those dates may no longer be available. Refresh the calendar or contact Rechel's Place directly.",
    };
  }
}

export async function submitBookingRequestInline(
  _previous: BookingActionState,
  formData: FormData,
): Promise<BookingActionState> {
  const result = await saveBookingRequest(formData);
  return result.ok
    ? {
        status: "success",
        bookingReference: result.bookingReference,
        depositLink: `/deposit/${result.depositToken}?reference=${encodeURIComponent(result.bookingReference)}`,
        depositExpiresAt: result.depositExpiresAt,
      }
    : { status: "error", message: result.message };
}

export async function submitBookingRequest(formData: FormData) {
  const result = await saveBookingRequest(formData);
  if (!result.ok) redirect("/book?error=unavailable");
  redirect(
    `/deposit/${result.depositToken}?new=1&reference=${encodeURIComponent(result.bookingReference)}`,
  );
}
