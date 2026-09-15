import { describe, expect, it } from "vitest";
import { parsePriceInputMinor, parsePriceInputPercentage } from "./pricing-input";

describe("price input validation", () => {
  it("converts valid PHP values to exact minor units", () => {
    expect(parsePriceInputMinor("4500")).toBe(450_000);
    expect(parsePriceInputMinor("12.5")).toBe(1_250);
    expect(parsePriceInputMinor("0.05")).toBe(5);
  });

  it("rejects blank, negative, text, and over-precise values", () => {
    expect(parsePriceInputMinor("")).toBeNull();
    expect(parsePriceInputMinor("-1")).toBeNull();
    expect(parsePriceInputMinor("not-a-number")).toBeNull();
    expect(parsePriceInputMinor("12.345")).toBeNull();
  });

  it("limits percentage input to two decimals and 100 percent", () => {
    expect(parsePriceInputPercentage("50")).toBe(5_000);
    expect(parsePriceInputPercentage("50.25")).toBe(5_025);
    expect(parsePriceInputPercentage("100.01")).toBeNull();
    expect(parsePriceInputPercentage("NaN")).toBeNull();
  });
});
