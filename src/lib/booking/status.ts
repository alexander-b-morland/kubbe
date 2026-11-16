import { clockTime, dayInZone, describeDay, instantInZone } from "@/lib/time";
import { slotsForDay, type ResourceRules } from "./rules";

type BookedSlot = { userId: string; name: string; startsAt: Date; endsAt: Date };

/**
 * One line about a resource right now: who has it, or how long it is free.
 * `bookings` are today's bookings of the resource, in time order.
 */
export function describeNow(input: {
  rules: ResourceRules;
  bookings: readonly BookedSlot[];
  now: Date;
  timeZone: string;
  userId: string;
}): string {
  const { rules, bookings, now, timeZone, userId } = input;
  const today = dayInZone(now, timeZone);
  const current = bookings.find((b) => b.startsAt <= now && b.endsAt > now);
  if (current) {
    return `${current.userId === userId ? "Yours" : current.name} until ${clockTime(current.endsAt, timeZone)}`;
  }

  const opens = instantInZone(today, rules.opensAt, timeZone);
  if (now < opens) return `Opens ${clockTime(opens, timeZone)}`;
  const slotsLeft = slotsForDay(today, rules, timeZone).some((slot) => slot.endsAt > now);
  if (!slotsLeft) return "Closed for today";

  const next = bookings.find((b) => b.startsAt > now);
  if (next) return `Free until ${clockTime(next.startsAt, timeZone)}`;
  // "All day" is the wrong thing to say when the day is nearly over.
  const closes = instantInZone(today, rules.closesAt, timeZone);
  const nearlyClosed = closes.getTime() - now.getTime() <= 3 * 3_600_000;
  return nearlyClosed ? `Free until ${clockTime(closes, timeZone)}` : "Free all day";
}

/** "07:00 today", "07:00 tomorrow", "07:00 on Thursday". */
export function describeWhen(startsAt: Date, now: Date, timeZone: string): string {
  const time = clockTime(startsAt, timeZone);
  const day = dayInZone(startsAt, timeZone);
  const today = dayInZone(now, timeZone);
  if (day === today) return `${time} today`;
  const tomorrow = dayInZone(new Date(instantInZone(today, 0, timeZone).getTime() + 36 * 3_600_000), timeZone);
  if (day === tomorrow) return `${time} tomorrow`;
  return `${time} on ${describeDay(day).weekday}`;
}

/** "20-minute" or "2-hour": the one way a slot length is written, wherever it shows. */
export function describeSlotLength(minutes: number): string {
  return minutes % 60 === 0 ? `${minutes / 60}-hour` : `${minutes}-minute`;
}

/** "06:00" from minutes after midnight. */
export function clockLabel(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/**
 * One line for several of the same thing, such as two showers. With one, it is that
 * one's own line. With more, it says how many are free right now.
 */
export function describeNowAcross(lines: readonly string[]): string {
  if (lines.length === 0) return "Switched off";
  if (lines.length === 1) return lines[0];
  const free = lines.filter((line) => line.startsWith("Free")).length;
  if (free > 0) return `${free} of ${lines.length} free`;
  // All closed, or all not open yet: they share one line.
  if (lines.every((line) => line === lines[0])) return lines[0];
  return "All taken right now";
}
