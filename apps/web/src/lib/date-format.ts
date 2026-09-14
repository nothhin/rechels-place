const stayDateFormatter = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

export function formatStayDate(value: string) {
  const isoDate = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value;
  const date = new Date(isoDate);
  return Number.isNaN(date.getTime()) ? value : stayDateFormatter.format(date);
}

export function formatStayRange(checkIn: string, checkOut: string) {
  return `${formatStayDate(checkIn)} → ${formatStayDate(checkOut)}`;
}
