/**
 * Company-timezone-aware day boundaries. Node/Vercel ship full ICU, so
 * Intl.DateTimeFormat already supports arbitrary IANA time zones without
 * pulling in a date library.
 */

/** The IANA time zone's offset from UTC, in ms, at the instant `date` falls on. */
function timezoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const wallClockAsUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return wallClockAsUtc - date.getTime();
}

/** Midnight of `date`'s calendar day in `timeZone`, returned as the real UTC instant it falls on. */
export function startOfDayInTimezone(date: Date, timeZone: string): Date {
  const offsetMs = timezoneOffsetMs(date, timeZone);
  const shifted = new Date(date.getTime() + offsetMs);
  const dayStartAsUtc = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
  return new Date(dayStartAsUtc - offsetMs);
}
