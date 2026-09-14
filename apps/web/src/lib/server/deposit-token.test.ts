import { describe, expect, it } from "vitest";
import { createDepositToken, hashDepositToken, isValidDepositToken } from "./deposit-token";

describe("deposit access tokens", () => {
  it("creates URL-safe high-entropy tokens", () => {
    const token = createDepositToken();
    expect(token).toHaveLength(43);
    expect(isValidDepositToken(token)).toBe(true);
  });

  it("stores a one-way deterministic hash", () => {
    const token = createDepositToken();
    expect(hashDepositToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashDepositToken(token)).toBe(hashDepositToken(token));
    expect(hashDepositToken(token)).not.toContain(token);
  });

  it("rejects malformed capability links", () => {
    expect(isValidDepositToken("short-token")).toBe(false);
    expect(isValidDepositToken("a".repeat(42) + ".")).toBe(false);
  });
});
