import { createHash, randomBytes } from "node:crypto";

export function createDepositToken() {
  return randomBytes(32).toString("base64url");
}

export function hashDepositToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function isValidDepositToken(token: string) {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}
