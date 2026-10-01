import { createHmac, timingSafeEqual } from "node:crypto";

export type BookingEmailDecision = "accept" | "decline";

type BookingEmailActionPayload = {
  v: 1;
  bookingId: string;
  decision: BookingEmailDecision;
  expiresAt: number;
};

const bookingIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function signingSecret() {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must contain at least 32 characters.");
  }
  return secret;
}

function signature(encodedPayload: string) {
  return createHmac("sha256", signingSecret())
    .update(`rechels-booking-email-action:${encodedPayload}`)
    .digest("base64url");
}

export function createBookingEmailActionToken(input: {
  bookingId: string;
  decision: BookingEmailDecision;
  expiresAt: Date | string;
}) {
  if (!bookingIdPattern.test(input.bookingId)) throw new Error("Invalid booking id.");
  const expiresAt = new Date(input.expiresAt).getTime();
  if (!Number.isFinite(expiresAt)) throw new Error("Invalid token expiry.");
  const payload: BookingEmailActionPayload = {
    v: 1,
    bookingId: input.bookingId,
    decision: input.decision,
    expiresAt,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encodedPayload}.${signature(encodedPayload)}`;
}

export function verifyBookingEmailActionToken(token: string, now = new Date()) {
  try {
    const [encodedPayload, suppliedSignature, extra] = token.split(".");
    if (!encodedPayload || !suppliedSignature || extra) return null;
    const expectedSignature = signature(encodedPayload);
    const supplied = Buffer.from(suppliedSignature, "base64url");
    const expected = Buffer.from(expectedSignature, "base64url");
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;

    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as Partial<BookingEmailActionPayload>;
    if (
      payload.v !== 1 ||
      typeof payload.bookingId !== "string" ||
      !bookingIdPattern.test(payload.bookingId) ||
      (payload.decision !== "accept" && payload.decision !== "decline") ||
      typeof payload.expiresAt !== "number" ||
      !Number.isFinite(payload.expiresAt) ||
      payload.expiresAt <= now.getTime()
    ) return null;
    return payload as BookingEmailActionPayload;
  } catch {
    return null;
  }
}
