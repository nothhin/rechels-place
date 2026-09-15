const decimalPricePattern = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;

export function parsePriceInputMinor(value: FormDataEntryValue | null) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!decimalPricePattern.test(raw)) return null;
  const [major, fraction = ""] = raw.split(".");
  const amountMinor = Number(major) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(amountMinor) ? amountMinor : null;
}

export function parsePriceInputPercentage(value: FormDataEntryValue | null) {
  const amountMinor = parsePriceInputMinor(value);
  if (amountMinor === null || amountMinor > 10_000) return null;
  return amountMinor;
}
