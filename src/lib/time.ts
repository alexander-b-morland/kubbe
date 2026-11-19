// Time zone helpers. Timestamps are stored in UTC; a household thinks in its own zone.
// A "day" is always a calendar date string, YYYY-MM-DD, in the household's zone.

const partsFormat = new Map<string, Intl.DateTimeFormat>();

function wallClock(instant: Date, timeZone: string) {
  let format = partsFormat.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partsFormat.set(timeZone, format);
  }
  const parts: Record<string, number> = {};
  for (const part of format.formatToParts(instant)) {
    if (part.type !== "literal") parts[part.type] = Number(part.value);
  }
  return parts as { year: number; month: number; day: number; hour: number; minute: number; second: number };
}

/** How far the zone's clock is ahead of UTC at this instant, in milliseconds. */
function offsetAt(instant: Date, timeZone: string): number {
  const wall = wallClock(instant, timeZone);
  const asUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** The calendar date in the zone at this instant, as YYYY-MM-DD. */
export function dayInZone(instant: Date, timeZone: string): string {
  const wall = wallClock(instant, timeZone);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${wall.year}-${pad(wall.month)}-${pad(wall.day)}`;
}

/** The instant when the zone's clock shows this many minutes after midnight on that day. */
export function instantInZone(day: string, minutesAfterMidnight: number, timeZone: string): Date {
  const [year, month, date] = day.split("-").map(Number);
  const wallAsUtc = Date.UTC(year, month - 1, date, 0, minutesAfterMidnight);
  // The offset depends on the instant, which is what we are solving for: refine once.
  let instant = new Date(wallAsUtc - offsetAt(new Date(wallAsUtc), timeZone));
  instant = new Date(wallAsUtc - offsetAt(instant, timeZone));
  return instant;
}

/** How many minutes after midnight the zone's clock shows at this instant. */
export function minutesInZone(instant: Date, timeZone: string): number {
  const wall = wallClock(instant, timeZone);
  return wall.hour * 60 + wall.minute;
}

/** Move a calendar date by whole days. */
export function addDays(day: string, amount: number): string {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date + amount)).toISOString().slice(0, 10);
}

/** Whole days from one calendar date to another. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export function isDay(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

/** "07:30", on a 24-hour clock, in the zone. */
export function clockTime(instant: Date, timeZone: string): string {
  const wall = wallClock(instant, timeZone);
  return `${String(wall.hour).padStart(2, "0")}:${String(wall.minute).padStart(2, "0")}`;
}

/** Weekday and date parts for a calendar date, for labels. */
export function describeDay(day: string, locale = "en-GB") {
  const noon = new Date(`${day}T12:00:00Z`);
  const format = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, { timeZone: "UTC", ...options }).format(noon);
  return {
    weekday: format({ weekday: "long" }),
    weekdayShort: format({ weekday: "short" }),
    dayOfMonth: format({ day: "numeric" }),
    monthShort: format({ month: "short" }),
  };
}

/** "Mon 23 Nov": a day far enough off that the weekday alone would not say which. */
export function shortDate(day: string, locale = "en-GB"): string {
  const parts = describeDay(day, locale);
  return `${parts.weekdayShort} ${parts.dayOfMonth} ${parts.monthShort}`;
}

/** Does this text name a time zone this runtime knows? */
export function isTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** "just now", "5 min ago", "3 h ago", "yesterday", "4 days ago", then the date. */
export function timeAgo(then: Date, now: Date, timeZone: string): string {
  const minutes = Math.floor((now.getTime() - then.getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const days = daysBetween(dayInZone(then, timeZone), dayInZone(now, timeZone));
  if (days === 0) return `${Math.floor(minutes / 60)} h ago`;
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  const { dayOfMonth, monthShort } = describeDay(dayInZone(then, timeZone));
  return `${dayOfMonth} ${monthShort}`;
}
