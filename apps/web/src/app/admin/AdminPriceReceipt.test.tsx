import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminPriceReceipt } from "./AdminPriceReceipt";
import type { AdminEnquiry } from "./BookingRequestsPanel";

const booking: AdminEnquiry = {
  id: "booking-1",
  fullName: "Test Guest",
  status: "confirmed",
  depositStatus: "verified",
  phone: "09123456789",
  email: "",
  preferredContact: "phone",
  depositSenderName: null,
  depositReference: null,
  depositSubmittedAt: null,
  depositRefundReference: null,
  roomTypeName: null,
  checkIn: "2026-09-13",
  checkOut: "2026-09-14",
  stayNights: 1,
  guestCount: 2,
  bedroomChoice: "bedroom_1",
  baseNightlyRateMinor: 170_000,
  additionalGuestCount: 0,
  additionalGuestChargeMinor: 0,
  parkingType: "car",
  parkingNightlyRateMinor: 35_000,
  parkingChargeMinor: 35_000,
  earlyCheckInHours: 3,
  earlyCheckInTime: "11:00",
  earlyCheckInFeeMinor: 45_000,
  lateCheckoutHours: 5,
  lateCheckoutTime: "16:00",
  lateCheckoutFeeMinor: 75_000,
  accommodationSubtotalMinor: 170_000,
  extrasTotalMinor: 155_000,
  totalMinor: 325_000,
  depositAmountMinor: 100_000,
  balancePaidMinor: 0,
  remainingBalanceMinor: 225_000,
  balancePaymentMethod: null,
  balancePaymentReference: null,
  balancePaidAt: null,
};

describe("admin payment summary", () => {
  it("shows the verified deposit deduction separately from other payments", () => {
    const html = renderToStaticMarkup(<AdminPriceReceipt booking={booking} />);
    expect(html).toContain("Verified deposit applied</dt><dd>−₱1,000");
    expect(html).toContain("Other payments recorded</dt><dd>₱0");
    expect(html).toContain("Remaining balance</dt><dd>₱2,250");
  });

  it("does not claim a deposit deduction when it is not applied", () => {
    const html = renderToStaticMarkup(<AdminPriceReceipt booking={{ ...booking, depositStatus: "refund_pending", balancePaidMinor: 100_000 }} />);
    expect(html).not.toContain("Verified deposit applied");
    expect(html).toContain("Other payments recorded</dt><dd>−₱1,000");
  });
});
