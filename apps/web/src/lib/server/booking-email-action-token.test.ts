import { afterEach, beforeEach, describe, expect, it } from "vitest";

const originalSecret = process.env.AUTH_SECRET;

describe("booking email action tokens", () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = "test-secret-that-is-longer-than-thirty-two-characters";
  });

  afterEach(() => {
    process.env.AUTH_SECRET = originalSecret;
  });

  it("round-trips a valid signed decision", async () => {
    const { createBookingEmailActionToken, verifyBookingEmailActionToken } = await import("./booking-email-action-token");
    const token = createBookingEmailActionToken({
      bookingId: "11111111-1111-4111-8111-111111111111",
      decision: "accept",
      expiresAt: "2030-01-02T00:00:00.000Z",
    });
    expect(verifyBookingEmailActionToken(token, new Date("2030-01-01T00:00:00.000Z"))).toMatchObject({
      bookingId: "11111111-1111-4111-8111-111111111111",
      decision: "accept",
    });
  });

  it("rejects expired and tampered tokens", async () => {
    const { createBookingEmailActionToken, verifyBookingEmailActionToken } = await import("./booking-email-action-token");
    const token = createBookingEmailActionToken({
      bookingId: "11111111-1111-4111-8111-111111111111",
      decision: "decline",
      expiresAt: "2030-01-01T00:00:00.000Z",
    });
    expect(verifyBookingEmailActionToken(token, new Date("2030-01-01T00:00:00.001Z"))).toBeNull();
    expect(verifyBookingEmailActionToken(`${token}x`, new Date("2029-01-01T00:00:00.000Z"))).toBeNull();
  });
});
