import { z } from "zod";

export const bookingRequestStatusSchema = z.enum([
  "pending",
  "contacted",
  "confirmed",
  "declined",
  "cancelled",
]);

export type BookingRequestStatus = z.infer<typeof bookingRequestStatusSchema>;

/** State transitions shared by admin controls and any future workflow UI. */
export const bookingRequestTransitions = {
  pending: ["contacted", "confirmed", "declined", "cancelled"],
  contacted: ["confirmed", "declined", "cancelled"],
  confirmed: ["cancelled"],
  declined: [],
  cancelled: [],
} as const satisfies Record<
  BookingRequestStatus,
  readonly BookingRequestStatus[]
>;

export function canTransitionBookingRequestStatus(
  from: BookingRequestStatus,
  to: BookingRequestStatus,
) {
  const allowedTransitions = bookingRequestTransitions[from] as readonly BookingRequestStatus[];
  return from === to || allowedTransitions.includes(to);
}

export function transitionBookingRequestStatus(
  from: BookingRequestStatus,
  to: BookingRequestStatus,
) {
  if (!canTransitionBookingRequestStatus(from, to)) {
    throw new RangeError(`Booking request cannot move from ${from} to ${to}.`);
  }
  return to;
}

export function isTerminalBookingRequestStatus(status: BookingRequestStatus) {
  return status === "declined" || status === "cancelled";
}
