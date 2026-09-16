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
  bedroomChoice: "both_bedrooms",
  baseNightlyRateMinor: 450_000,
  additionalGuestCount: 0,
  additionalGuestChargeMinor: 0,
  parkingType: "none",
  parkingNightlyRateMinor: 0,
  parkingChargeMinor: 0,
  earlyCheckInHours: 0,
  earlyCheckInTime: null,
  earlyCheckInFeeMinor: 0,
  lateCheckoutHours: 0,
  lateCheckoutTime: null,
  lateCheckoutFeeMinor: 0,
  accommodationSubtotalMinor: 450_000,
  extrasTotalMinor: 0,
  totalMinor: 450_000,
  depositAmountMinor: 100_000,
  downPaymentAmountMinor: 225_000,
  securityDepositAmountMinor: 100_000,
  balancePaidMinor: 0,
  remainingBalanceMinor: 225_000,
  balancePaymentMethod: null,
  balancePaymentReference: null,
  balancePaidAt: null,
};

describe("admin payment summary", () => {
  it("shows the 50% down payment and separate check-in security deposit", () => {
    const html = renderToStaticMarkup(<AdminPriceReceipt booking={booking} />);
    expect(html).toContain("Stay total</span><strong>₱4,500");
    expect(html).toContain("50% down payment</span><strong>₱2,250");
    expect(html).toContain("Verified and applied to the stay total");
    expect(html).toContain("Refundable security deposit");
    expect(html).toContain("It is not part of the stay total or down payment.");
    expect(html).toContain("Remaining stay balance</span><strong>₱2,250");
    expect(html).toContain("<details");
  });

  it("keeps later balance payments separate from the down payment", () => {
    const html = renderToStaticMarkup(<AdminPriceReceipt booking={{ ...booking, balancePaidMinor: 100_000, remainingBalanceMinor: 125_000 }} />);
    expect(html).not.toContain("Verified deposit applied");
    expect(html).toContain("₱1,000 in later balance payments recorded");
    expect(html).toContain("Later balance payments recorded</dt><dd>−₱1,000");
    expect(html).toContain("Remaining stay balance</span><strong>₱1,250");
  });

  it("does not describe an unverified down payment as paid", () => {
    const html = renderToStaticMarkup(<AdminPriceReceipt booking={{ ...booking, status: "pending", depositStatus: "submitted" }} />);
    expect(html).toContain("Down payment pending");
    expect(html).toContain("Submitted by guest · awaiting verification");
    expect(html).toContain("Balance after down payment</span><strong>₱2,250");
    expect(html).toContain("Due after the down payment is verified");
    expect(html).not.toContain("Verified and applied to the stay total");
  });
});
