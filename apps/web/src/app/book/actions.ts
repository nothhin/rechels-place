"use server";

import { redirect } from "next/navigation";
import { bookingEnquirySchema } from "@uppadar-hollie/shared/booking";
import { pricingConfigFromPayload, type RechelsPricingConfig } from "@uppadar-hollie/shared/pricing";
import {
  createDepositToken,
  hashDepositToken,
} from "@/lib/server/deposit-token";
import { createPublicSupabaseClient } from "@/lib/supabase/public-server";

const phpCurrency = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

export type BookingActionState = {
  status: "idle" | "success" | "error" | "stale";
  message?: string;
  bookingReference?: string;
  depositLink?: string;
  depositExpiresAt?: string;
  pricing?: RechelsPricingConfig;
  previousTotalMinor?: number;
  currentTotalMinor?: number;
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
      "submit_rechels_booking_request_v3",
      {
        request_idempotency: parsed.data.idempotencyKey,
        guest_name: parsed.data.fullName,
        guest_email: parsed.data.email,
        guest_phone: parsed.data.phone,
        arrival: parsed.data.checkIn,
        departure: parsed.data.checkOut,
        guests: parsed.data.guests,
        adult_count: parsed.data.adults,
        child_count: parsed.data.children,
        bedroom_selection: parsed.data.bedroomChoice,
        parking_selection: parsed.data.parkingType,
        early_check_in_hours: parsed.data.earlyCheckInHours,
        late_checkout_hours: parsed.data.lateCheckoutHours,
        requests: bookingRequests,
        contact_method: parsed.data.preferredContact,
        consent_version: "booking-request-v2",
        token_hash: hashDepositToken(depositToken),
        pricing_version: parsed.data.pricingVersion || null,
        client_total_minor: typeof parsed.data.clientTotalMinor === "number" ? parsed.data.clientTotalMinor : null,
      },
    );
    if (error) throw error;
    const booking = Array.isArray(data) ? data[0] : null;
    if (!booking) throw new Error("Booking request was not created.");
    if (booking.pricing_changed) {
      let pricing: RechelsPricingConfig | undefined;
      try {
        pricing = pricingConfigFromPayload(booking.current_pricing);
      } catch {
        return {
          ok: false as const,
          stale: true as const,
          message: "The prices changed while you were booking. Please review the updated total.",
        };
      }
      return {
        ok: false as const,
        stale: true as const,
        pricing,
        previousTotalMinor: Number(booking.previous_total_minor ?? parsed.data.clientTotalMinor ?? 0),
        currentTotalMinor: Number(booking.current_total_minor ?? 0),
        message: "The prices changed while you were booking. Please review the updated total.",
      };
    }
    const result = {
      bookingReference: booking.booking_reference as string,
      depositExpiresAt: booking.deposit_expires_at as string,
      totalMinor: Number(
        booking.current_total_minor ?? parsed.data.clientTotalMinor ?? 0,
      ),
    };

    const webhookUrl = process.env.N8N_BOOKING_WEBHOOK_URL;
    const notificationEmail = process.env.BOOKING_NOTIFICATION_EMAIL;
    let notificationDelivered = false;
    const checkInTime = Date.parse(`${parsed.data.checkIn}T00:00:00Z`);
    const checkOutTime = Date.parse(`${parsed.data.checkOut}T00:00:00Z`);
    const nights = Math.round((checkOutTime - checkInTime) / 86_400_000);
    const notificationPayload = {
      bookingReference: result.bookingReference,
      guestName: parsed.data.fullName,
      guestEmail: parsed.data.email || "Not provided",
      guestPhone: parsed.data.phone,
      checkIn: parsed.data.checkIn,
      checkOut: parsed.data.checkOut,
      nights,
      adults: parsed.data.adults,
      children: parsed.data.children,
      parking:
        parsed.data.parkingType === "car"
          ? "Car"
          : parsed.data.parkingType === "motorcycle"
            ? "Motorcycle"
            : "None",
      total: phpCurrency.format(result.totalMinor / 100),
      depositDue: phpCurrency.format(result.totalMinor / 200),
      specialRequests: parsed.data.specialRequests || "None",
    };

    if (webhookUrl) {
      try {
        const webhookResponse = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(notificationPayload),
          cache: "no-store",
        });
        notificationDelivered = webhookResponse.ok;
        if (!webhookResponse.ok)
          console.warn("[booking-request] n8n rejected the notification", {
            status: webhookResponse.status,
          });
      } catch {
        console.warn(
          "[booking-request] n8n notification failed; trying the email fallback",
        );
      }
    }

    if (!notificationDelivered && notificationEmail) {
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
              name: notificationPayload.guestName,
              email: notificationPayload.guestEmail,
              phone: notificationPayload.guestPhone,
              contact_method: "Phone call",
              check_in: notificationPayload.checkIn,
              check_out: notificationPayload.checkOut,
              guests: parsed.data.guests,
              adults: notificationPayload.adults,
              children: notificationPayload.children,
              bedroom_selection: bedroomLabel,
              total: notificationPayload.total,
              deposit_due: notificationPayload.depositDue,
              parking: notificationPayload.parking,
              special_requests: notificationPayload.specialRequests,
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
    const errorCode =
      typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "";
    const errorMessage =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null && "message" in error
          ? String(error.message)
          : "";
    const datesUnavailable = errorMessage
      .toLowerCase()
      .includes("dates unavailable");
    console.error("[booking-request] database insert failed", {
      code: errorCode || "unknown",
      message: errorMessage.slice(0, 160) || "unknown",
    });
    return {
      ok: false as const,
      message: datesUnavailable
        ? "Those dates may no longer be available. Refresh the calendar or contact Rechel's Place directly."
        : "Your booking request could not be submitted right now. Please refresh and try again, or contact Rechel's Place directly.",
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
    : result.stale
      ? {
          status: "stale",
          message: result.message,
          pricing: result.pricing,
          previousTotalMinor: result.previousTotalMinor,
          currentTotalMinor: result.currentTotalMinor,
        }
      : { status: "error", message: result.message };
}

export async function submitBookingRequest(formData: FormData) {
  const result = await saveBookingRequest(formData);
  if (!result.ok) redirect(result.stale ? "/#availability" : "/book?error=unavailable");
  redirect(
    `/deposit/${result.depositToken}?new=1&reference=${encodeURIComponent(result.bookingReference)}`,
  );
}
