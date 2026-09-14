export function normalizeAirbnbIcalUrl(value: string) {
  const input = value.trim();
  if (!input || input.length > 2048) return null;
  try {
    const url = new URL(input);
    if (url.protocol !== "https:" || url.hostname !== "www.airbnb.com" || url.port || url.username || url.password) return null;
    if (!/^\/calendar\/ical\/[0-9]+\.ics$/.test(url.pathname)) return null;
    if (!url.searchParams.has("t")) return null;
    return url.toString();
  } catch {
    return null;
  }
}
