"use server";

import { createDatabase, auditLog, roomTypes, rooms } from "@uppadar-hollie/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/server/admin-auth";
import { parseDatabaseEnvironment } from "@/lib/server/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createDepositToken,
  hashDepositToken,
} from "@/lib/server/deposit-token";

export type DepositActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  link?: string;
};
export type BalanceActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  changeMinor?: number;
};
export type OperationActionState = BalanceActionState;

const roomTypeSchema = z.object({
  id: z.string().uuid(),
  rate: z.coerce.number().int().min(0).max(1_000_000),
  status: z.enum(["draft", "published", "archived"]),
});

const roomSchema = z.object({
  roomNumber: z.string().trim().min(1).max(30),
  roomTypeId: z.string().uuid(),
  floor: z.string().trim().max(50).optional(),
  status: z.enum(["available", "maintenance", "out_of_service"]),
});

function databaseUrl() {
  const configuration = parseDatabaseEnvironment();
  if (!configuration.success)
    throw new Error("Database configuration is unavailable.");
  return configuration.data.DATABASE_URL;
}

export async function signIn(
  _state: { error?: string } | undefined,
  formData: FormData,
) {
  const parsed = z
    .object({ email: z.string().email(), password: z.string().min(8) })
    .safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
    });
  if (!parsed.success) return { error: "Enter a valid email and password." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "The email or password is incorrect." };
  redirect("/admin");
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

export async function updateRoomType(formData: FormData) {
  const staff = await requireStaff(["manager", "admin"]);
  const parsed = roomTypeSchema.safeParse({
    id: formData.get("id"),
    rate: formData.get("rate"),
    status: formData.get("status"),
  });
  if (!parsed.success)
    redirect("/admin?error=invalid-room-template#room-templates");
  const database = createDatabase(databaseUrl());
  const requestId = crypto.randomUUID();
  try {
    await database.db.transaction(async (tx) => {
      await tx
        .update(roomTypes)
        .set({
          baseNightlyRateMinor: parsed.data.rate * 100,
          status: parsed.data.status,
          updatedAt: new Date(),
        })
        .where(eq(roomTypes.id, parsed.data.id));
      await tx
        .insert(auditLog)
        .values({
          actorId: staff.id,
          actorType: "staff",
          action: "room_type.updated",
          entityType: "room_type",
          entityId: parsed.data.id,
          requestId,
          redactedMetadata: { status: parsed.data.status },
        });
    });
  } finally {
    await database.close();
  }
  revalidatePath("/admin");
  revalidatePath("/rooms");
  redirect("/admin?saved=room-template#room-templates");
}

export async function addPhysicalRoom(formData: FormData) {
  const staff = await requireStaff(["manager", "admin"]);
  const parsed = roomSchema.safeParse({
    roomNumber: formData.get("roomNumber"),
    roomTypeId: formData.get("roomTypeId"),
    floor: formData.get("floor") || undefined,
    status: formData.get("status"),
  });
  if (!parsed.success) redirect("/admin?error=invalid-room#physical-rooms");
  const database = createDatabase(databaseUrl());
  const id = crypto.randomUUID();
  try {
    await database.db.transaction(async (tx) => {
      await tx
        .insert(rooms)
        .values({ id, ...parsed.data, floor: parsed.data.floor || null });
      await tx
        .insert(auditLog)
        .values({
          actorId: staff.id,
          actorType: "staff",
          action: "room.created",
          entityType: "room",
          entityId: id,
          requestId: crypto.randomUUID(),
          redactedMetadata: { roomNumber: parsed.data.roomNumber },
        });
    });
  } finally {
    await database.close();
  }
  revalidatePath("/admin");
  revalidatePath("/rooms");
  redirect("/admin?saved=room#physical-rooms");
}

export async function updateRoomStatus(formData: FormData) {
  const staff = await requireStaff(["manager", "admin"]);
  const parsed = z
    .object({
      id: z.string().uuid(),
      status: z.enum(["available", "maintenance", "out_of_service"]),
    })
    .safeParse({ id: formData.get("id"), status: formData.get("status") });
  if (!parsed.success) redirect("/admin?error=invalid-room#physical-rooms");
  const database = createDatabase(databaseUrl());
  try {
    await database.db.transaction(async (tx) => {
      await tx
        .update(rooms)
        .set({ status: parsed.data.status, updatedAt: new Date() })
        .where(eq(rooms.id, parsed.data.id));
      await tx
        .insert(auditLog)
        .values({
          actorId: staff.id,
          actorType: "staff",
          action: "room.status_updated",
          entityType: "room",
          entityId: parsed.data.id,
          requestId: crypto.randomUUID(),
          redactedMetadata: { status: parsed.data.status },
        });
    });
  } finally {
    await database.close();
  }
  revalidatePath("/admin");
  revalidatePath("/rooms");
}

export async function startDepositRequest(
  _state: DepositActionState,
  formData: FormData,
): Promise<DepositActionState> {
  await requireStaff(["manager", "admin"]);
  const parsed = z.string().uuid().safeParse(formData.get("bookingId"));
  if (!parsed.success)
    return { status: "error", message: "Invalid booking request." };
  const token = createDepositToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const supabase = await createSupabaseServerClient();
  const { data: updated, error } = await supabase.rpc(
    "staff_start_snowaz_deposit",
    {
      target_id: parsed.data,
      token_hash: hashDepositToken(token),
      expires_at: expiresAt.toISOString(),
    },
  );
  if (error || !updated)
    return { status: "error", message: "Booking request was not found." };
  revalidatePath("/admin");
  return { status: "success", link: `/deposit/${token}` };
}

export async function verifyDeposit(
  _state: DepositActionState,
  formData: FormData,
): Promise<DepositActionState> {
  await requireStaff(["manager", "admin"]);
  const parsed = z.string().uuid().safeParse(formData.get("bookingId"));
  if (!parsed.success)
    return { status: "error", message: "Invalid booking request." };
  const supabase = await createSupabaseServerClient();
  const { data: updated, error } = await supabase.rpc(
    "staff_verify_snowaz_deposit",
    { target_id: parsed.data },
  );
  if (error || !updated)
    return {
      status: "error",
      message: "A submitted deposit is required before verification.",
    };
  revalidatePath("/admin");
  revalidatePath("/admin/confirmed");
  revalidatePath("/admin/operations");
  revalidatePath("/");
  return {
    status: "success",
    message: "Deposit verified and booking confirmed.",
  };
}

export async function recordAndVerifyDeposit(
  _state: DepositActionState,
  formData: FormData,
): Promise<DepositActionState> {
  await requireStaff(["manager", "admin"]);
  const parsed = z
    .object({
      bookingId: z.string().uuid(),
      senderName: z.string().trim().min(2).max(120),
      paymentReference: z.string().trim().min(6).max(80),
    })
    .safeParse({
      bookingId: formData.get("bookingId"),
      senderName: formData.get("senderName"),
      paymentReference: formData.get("paymentReference"),
    });
  if (!parsed.success)
    return {
      status: "error",
      message:
        "Enter the sender name and transaction reference shown on the receipt.",
    };
  const supabase = await createSupabaseServerClient();
  const { data: updated, error } = await supabase.rpc(
    "staff_record_and_verify_snowaz_deposit",
    {
      target_id: parsed.data.bookingId,
      sender_name: parsed.data.senderName,
      payment_reference: parsed.data.paymentReference,
    },
  );
  if (error || !updated)
    return {
      status: "error",
      message:
        "This payment hold expired or the booking can no longer be confirmed. Check the dates before proceeding.",
    };
  revalidatePath("/admin");
  revalidatePath("/admin/confirmed");
  revalidatePath("/admin/operations");
  revalidatePath("/");
  return {
    status: "success",
    message: "Messenger payment recorded, verified, and booking confirmed.",
  };
}

export async function markDepositRefunded(
  _state: DepositActionState,
  formData: FormData,
): Promise<DepositActionState> {
  await requireStaff(["manager", "admin"]);
  const parsed = z
    .object({
      bookingId: z.string().uuid(),
      refundReference: z.string().trim().min(6).max(80),
    })
    .safeParse({
      bookingId: formData.get("bookingId"),
      refundReference: formData.get("refundReference"),
    });
  if (!parsed.success)
    return { status: "error", message: "Enter a valid refund reference." };
  const supabase = await createSupabaseServerClient();
  const { data: updated, error } = await supabase.rpc(
    "staff_refund_snowaz_deposit",
    {
      target_id: parsed.data.bookingId,
      refund_reference: parsed.data.refundReference,
    },
  );
  if (error || !updated)
    return {
      status: "error",
      message: "Only verified deposits can be marked refunded.",
    };
  revalidatePath("/admin");
  return { status: "success", message: "Refund recorded." };
}

export async function updateBookingRequestStatus(
  _state: DepositActionState,
  formData: FormData,
): Promise<DepositActionState> {
  await requireStaff(["manager", "admin"]);
  const parsed = z
    .object({
      bookingId: z.string().uuid(),
      status: z.enum(["declined", "cancelled"]),
    })
    .safeParse({
      bookingId: formData.get("bookingId"),
      status: formData.get("status"),
    });
  if (!parsed.success)
    return { status: "error", message: "Invalid booking status change." };
  const supabase = await createSupabaseServerClient();
  const { data: updated, error } = await supabase.rpc(
    "staff_update_snowaz_booking_status",
    { target_id: parsed.data.bookingId, next_status: parsed.data.status },
  );
  if (error || !updated)
    return {
      status: "error",
      message: "This booking can no longer be changed to that status.",
    };
  revalidatePath("/admin");
  revalidatePath("/");
  return {
    status: "success",
    message:
      parsed.data.status === "declined"
        ? "Booking request declined."
        : "Booking cancelled. Any verified deposit is now awaiting refund.",
  };
}

export async function recordRemainingBalance(
  _state: BalanceActionState,
  formData: FormData,
): Promise<BalanceActionState> {
  await requireStaff(["manager", "admin"]);
  const parsed = z
    .object({
      bookingId: z.string().uuid(),
      paymentMethod: z.enum(["cash", "bank_transfer", "e_wallet"]),
      paymentReference: z.string().trim().max(80),
      remainingBalanceMinor: z.coerce.number().int().positive(),
      cashTendered: z.coerce.number().min(0).max(1_000_000),
    })
    .safeParse({
      bookingId: formData.get("bookingId"),
      paymentMethod: formData.get("paymentMethod"),
      paymentReference: formData.get("paymentReference") || "",
      remainingBalanceMinor: formData.get("remainingBalanceMinor"),
      cashTendered: formData.get("cashTendered") || 0,
    });
  if (!parsed.success)
    return {
      status: "error",
      message: "Choose a payment method and enter valid payment details.",
    };
  const amountTenderedMinor = Math.round(parsed.data.cashTendered * 100);
  if (
    parsed.data.paymentMethod === "cash" &&
    amountTenderedMinor < parsed.data.remainingBalanceMinor
  )
    return {
      status: "error",
      message:
        "Cash received must be equal to or greater than the remaining balance.",
    };
  if (
    parsed.data.paymentMethod !== "cash" &&
    parsed.data.paymentReference.length < 3
  )
    return {
      status: "error",
      message: "Enter a valid transfer or e-wallet reference.",
    };
  const reference =
    parsed.data.paymentMethod === "cash"
      ? `CASH-${Date.now()}`
      : parsed.data.paymentReference;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("staff_record_snowaz_payment", {
    target_id: parsed.data.bookingId,
    amount_minor: parsed.data.remainingBalanceMinor,
    payment_method: parsed.data.paymentMethod,
    payment_reference: reference,
  });
  if (error || !data)
    return {
      status: "error",
      message:
        "The remaining balance could not be recorded. Confirm that the down payment is verified and a balance is still due.",
    };
  revalidatePath("/admin");
  revalidatePath("/admin/confirmed");
  revalidatePath("/admin/operations");
  revalidatePath("/booking-status");
  const changeMinor =
    parsed.data.paymentMethod === "cash"
      ? amountTenderedMinor - parsed.data.remainingBalanceMinor
      : 0;
  return {
    status: "success",
    message:
      changeMinor > 0
        ? `Full balance recorded. Return ₱${(changeMinor / 100).toLocaleString("en-PH")} change to the guest.`
        : "Remaining balance recorded. This booking is fully paid.",
    changeMinor,
  };
}

export async function updateBookingOperations(
  _state: OperationActionState,
  formData: FormData,
): Promise<OperationActionState> {
  await requireStaff(["manager", "admin"]);
  const parsed = z
    .object({
      bookingId: z.string().uuid(),
      checkIn: z.string().date(),
      checkOut: z.string().date(),
      guests: z.coerce.number().int().min(1).max(6),
      bedroom: z.enum(["bedroom_1", "bedroom_2", "both_bedrooms"]),
      stayStatus: z.enum(["upcoming", "checked_in", "checked_out", "no_show"]),
      idType: z.string().trim().max(40).optional(),
      idLast4: z
        .union([
          z.literal(""),
          z
            .string()
            .trim()
            .regex(/^[A-Za-z0-9]{4}$/),
        ])
        .optional(),
    })
    .safeParse({
      bookingId: formData.get("bookingId"),
      checkIn: formData.get("checkIn"),
      checkOut: formData.get("checkOut"),
      guests: formData.get("guests"),
      bedroom: formData.get("bedroom"),
      stayStatus: formData.get("stayStatus"),
      idType: formData.get("idType") || "",
      idLast4: formData.get("idLast4") || "",
    });
  if (!parsed.success || parsed.data.checkOut <= parsed.data.checkIn)
    return {
      status: "error",
      message:
        "Check the dates, guest count, bedroom selection, stay status, and ID details.",
    };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("staff_update_snowaz_booking", {
    target_id: parsed.data.bookingId,
    arrival: parsed.data.checkIn,
    departure: parsed.data.checkOut,
    guests: parsed.data.guests,
    bedroom_selection: parsed.data.bedroom,
    next_stay_status: parsed.data.stayStatus,
    id_type: parsed.data.idType || null,
    id_last4: parsed.data.idLast4 || null,
  });
  if (error || !data)
    return {
      status: "error",
      message: error?.message.includes("unavailable")
        ? "Those dates conflict with a booking or maintenance block."
        : error?.message.includes("below payments")
          ? "The repriced total cannot be lower than payments already received."
          : "The booking could not be updated.",
    };
  revalidatePath("/admin");
  revalidatePath("/admin/operations");
  revalidatePath("/");
  return {
    status: "success",
    message:
      "Booking updated, repriced, audited, and queued for guest notification.",
  };
}

export async function recordPartialPayment(
  _state: OperationActionState,
  formData: FormData,
): Promise<OperationActionState> {
  await requireStaff(["manager", "admin"]);
  const parsed = z
    .object({
      bookingId: z.string().uuid(),
      amount: z.coerce.number().positive().max(1_000_000),
      method: z.enum(["cash", "bank_transfer", "e_wallet"]),
      reference: z.string().trim().max(80),
    })
    .safeParse({
      bookingId: formData.get("bookingId"),
      amount: formData.get("amount"),
      method: formData.get("method"),
      reference: formData.get("reference") || "",
    });
  if (
    !parsed.success ||
    (parsed.data.method !== "cash" && parsed.data.reference.length < 3)
  )
    return {
      status: "error",
      message:
        "Enter a valid amount and payment details. A reference is only required for transfers and e-wallets.",
    };
  const reference =
    parsed.data.method === "cash"
      ? `CASH-${Date.now()}`
      : parsed.data.reference;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("staff_record_snowaz_payment", {
    target_id: parsed.data.bookingId,
    amount_minor: Math.round(parsed.data.amount * 100),
    payment_method: parsed.data.method,
    payment_reference: reference,
  });
  if (error || !data)
    return {
      status: "error",
      message:
        "Payment exceeds the balance, duplicates a reference, or the booking is not confirmed.",
    };
  revalidatePath("/admin/operations");
  revalidatePath("/admin/confirmed");
  return {
    status: "success",
    message: "Payment recorded and the remaining balance recalculated.",
  };
}

export async function reversePayment(
  _state: OperationActionState,
  formData: FormData,
): Promise<OperationActionState> {
  await requireStaff(["manager", "admin"]);
  const parsed = z
    .object({
      paymentId: z.string().uuid(),
      reason: z.string().trim().min(5).max(240),
    })
    .safeParse({
      paymentId: formData.get("paymentId"),
      reason: formData.get("reason"),
    });
  if (!parsed.success)
    return { status: "error", message: "Enter a clear reversal reason." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("staff_reverse_snowaz_payment", {
    payment_id: parsed.data.paymentId,
    reason: parsed.data.reason,
  });
  if (error || !data)
    return { status: "error", message: "Payment could not be reversed." };
  revalidatePath("/admin/operations");
  return {
    status: "success",
    message: "Payment reversed with a permanent audit record.",
  };
}

export async function manageDateBlock(
  _state: OperationActionState,
  formData: FormData,
): Promise<OperationActionState> {
  await requireStaff(["manager", "admin"]);
  const release = formData.get("release") === "true";
  const parsed = z
    .object({
      blockId: z.union([z.literal(""), z.string().uuid()]),
      checkIn: z.union([z.literal(""), z.string().date()]),
      checkOut: z.union([z.literal(""), z.string().date()]),
      reason: z.string().trim().max(240),
    })
    .safeParse({
      blockId: formData.get("blockId") || "",
      checkIn: formData.get("checkIn") || "",
      checkOut: formData.get("checkOut") || "",
      reason: formData.get("reason") || "",
    });
  if (
    !parsed.success ||
    (!release &&
      (parsed.data.checkOut <= parsed.data.checkIn ||
        parsed.data.reason.length < 3))
  )
    return {
      status: "error",
      message: "Enter valid block dates and a reason.",
    };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("staff_manage_snowaz_date_block", {
    target_id: parsed.data.blockId || crypto.randomUUID(),
    arrival: parsed.data.checkIn || new Date().toISOString().slice(0, 10),
    departure:
      parsed.data.checkOut ||
      new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    block_reason: parsed.data.reason || "Released",
    release_block: release,
  });
  if (error || !data)
    return {
      status: "error",
      message: error?.message?.toLowerCase().includes("conflict")
        ? "This block overlaps an active booking."
      : "The date block could not be changed.",
    };
  revalidatePath("/admin/operations");
  revalidatePath("/admin");
  revalidatePath("/");
  return {
    status: "success",
    message: release
      ? "Date block released."
      : "Dates blocked from new bookings.",
  };
}
