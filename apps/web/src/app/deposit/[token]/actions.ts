"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  hashDepositToken,
  isValidDepositToken,
} from "@/lib/server/deposit-token";
import { createPublicSupabaseClient } from "@/lib/supabase/public-server";

export type GuestCountState = {
  status: "idle" | "success" | "error";
  message: string;
};

export async function updatePendingGuestCount(
  _state: GuestCountState,
  formData: FormData,
): Promise<GuestCountState> {
  const parsed = z
    .object({
      token: z.string().refine(isValidDepositToken),
      guests: z.coerce.number().int().min(1).max(6),
      bedroom: z.enum(["bedroom_1", "bedroom_2"]),
      parkingType: z.enum(["none", "car", "motorcycle"]),
      earlyCheckInHours: z.coerce.number().int().min(0).max(5),
      lateCheckoutHours: z.coerce.number().int().min(0).max(5),
    })
    .refine(
      (value) =>
        (value.bedroom === "bedroom_1" && value.guests <= 2) ||
        (value.bedroom === "bedroom_2" && value.guests <= 6),
    )
    .safeParse({
      token: formData.get("token"),
      guests: formData.get("guests"),
      bedroom: formData.get("bedroom"),
      parkingType: formData.get("parkingType"),
      earlyCheckInHours: formData.get("earlyCheckInHours"),
      lateCheckoutHours: formData.get("lateCheckoutHours"),
    });
  if (!parsed.success)
    return {
      status: "error",
      message: "Choose a valid guest count and bedroom setup.",
    };
  const supabase = createPublicSupabaseClient();
  if (!supabase)
    return { status: "error", message: "The booking service is unavailable." };
  const { data, error } = await supabase.rpc(
    "update_snowaz_pending_guest_count",
    {
      token_hash: hashDepositToken(parsed.data.token),
      guests: parsed.data.guests,
      bedroom_selection: parsed.data.bedroom,
      parking_selection: parsed.data.parkingType,
      early_hours: parsed.data.earlyCheckInHours,
      late_hours: parsed.data.lateCheckoutHours,
    },
  );
  if (error || !data)
    return {
      status: "error",
      message:
        "This booking can no longer be edited because payment proof was submitted or the link expired.",
    };
  revalidatePath(`/deposit/${parsed.data.token}`);
  revalidatePath("/admin");
  revalidatePath("/admin/confirmed");
  revalidatePath("/admin/operations");
  return {
    status: "success",
    message: "Guest count, bedroom, parking, optional time, and booking total updated.",
  };
}

export async function submitDepositReference(formData: FormData) {
  const parsed = z
    .object({
      token: z.string().refine(isValidDepositToken),
      senderName: z.string().trim().min(2).max(120),
      reference: z.string().trim().min(6).max(80),
      confirmedAmount: z.literal("1000"),
    })
    .safeParse({
      token: formData.get("token"),
      senderName: formData.get("senderName"),
      reference: formData.get("reference"),
      confirmedAmount: formData.get("confirmedAmount"),
    });
  if (!parsed.success)
    redirect(
      `/deposit/${String(formData.get("token") || "invalid")}?error=invalid`,
    );
  const supabase = createPublicSupabaseClient();
  if (!supabase) throw new Error("Deposit service is unavailable.");
  const { data: updated, error } = await supabase.rpc(
    "submit_snowaz_deposit_reference",
    {
      token_hash: hashDepositToken(parsed.data.token),
      sender_name: parsed.data.senderName,
      payment_reference: parsed.data.reference,
    },
  );
  if (error || !updated)
    redirect(`/deposit/${parsed.data.token}?error=expired`);
  redirect(`/deposit/${parsed.data.token}?submitted=1`);
}
