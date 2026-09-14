import { describe, expect, it } from "vitest";
import {
  canTransitionBookingRequestStatus,
  isTerminalBookingRequestStatus,
  transitionBookingRequestStatus,
} from "./booking-lifecycle";

describe("booking request state machine", () => {
  it("allows the supported enquiry and cancellation paths", () => {
    expect(canTransitionBookingRequestStatus("pending", "contacted")).toBe(true);
    expect(canTransitionBookingRequestStatus("contacted", "confirmed")).toBe(true);
    expect(canTransitionBookingRequestStatus("confirmed", "cancelled")).toBe(true);
    expect(transitionBookingRequestStatus("contacted", "declined")).toBe("declined");
  });

  it("does not reopen terminal requests or decline a confirmed stay", () => {
    expect(canTransitionBookingRequestStatus("declined", "pending")).toBe(false);
    expect(canTransitionBookingRequestStatus("cancelled", "confirmed")).toBe(false);
    expect(canTransitionBookingRequestStatus("confirmed", "declined")).toBe(false);
    expect(isTerminalBookingRequestStatus("declined")).toBe(true);
    expect(isTerminalBookingRequestStatus("cancelled")).toBe(true);
    expect(isTerminalBookingRequestStatus("confirmed")).toBe(false);
  });

  it("fails loudly for an invalid transition while allowing an idempotent no-op", () => {
    expect(transitionBookingRequestStatus("pending", "pending")).toBe("pending");
    expect(() => transitionBookingRequestStatus("declined", "cancelled")).toThrow(
      "Booking request cannot move from declined to cancelled.",
    );
  });
});
