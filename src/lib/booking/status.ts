import { clockTime, dayInZone, daysBetween, describeDay, instantInZone } from "@/lib/time";
import { slotsForDay, type ResourceRules } from "./rules";
import { en, type Translate } from "@/lib/i18n";

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
  t?: Translate;
}): string {
  const { rules, bookings, now, timeZone, userId, t = en } = input;
  const today = dayInZone(now, timeZone);
  const current = bookings.find((b) => b.startsAt <= now && b.endsAt > now);
  if (current) {
    return current.userId === userId ? t`Yours until ${clockTime(current.endsAt, timeZone)}` : t`${current.name} until ${clockTime(current.endsAt, timeZone)}`;
  }

  const opens = instantInZone(today, rules.opensAt, timeZone);
  if (now < opens) return t`Opens ${clockTime(opens, timeZone)}`;
  const slotsLeft = slotsForDay(today, rules, timeZone).some((slot) => slot.endsAt > now);
  if (!slotsLeft) return t("Closed for today");

  const next = bookings.find((b) => b.startsAt > now);
  if (next) return t`Free until ${clockTime(next.startsAt, timeZone)}`;
  // "All day" is the wrong thing to say when the day is nearly over.
  const closes = instantInZone(today, rules.closesAt, timeZone);
  const nearlyClosed = closes.getTime() - now.getTime() <= 3 * 3_600_000;
  return nearlyClosed ? t`Free until ${clockTime(closes, timeZone)}` : t("Free all day");
}

/** "07:00 today", "07:00 tomorrow", "07:00 on Thursday", and further off "07:00 on Sat 28 Nov". */
export function describeWhen(startsAt: Date, now: Date, timeZone: string, t: Translate = en): string {
  const time = clockTime(startsAt, timeZone);
  const day = dayInZone(startsAt, timeZone);
  const today = dayInZone(now, timeZone);
  if (day === today) return t`${time} today`;
  const tomorrow = dayInZone(new Date(instantInZone(today, 0, timeZone).getTime() + 36 * 3_600_000), timeZone);
  if (day === tomorrow) return t`${time} tomorrow`;
  const parts = describeDay(day, t);
  // Beyond a week, a weekday alone would be taken for the coming one.
  if (daysBetween(today, day) > 6) return t`${time} on ${`${parts.weekdayShort} ${parts.dayOfMonth} ${parts.monthShort}`}`;
  return t`${time} on ${parts.weekday}`;
}

/** "20-minute" or "2-hour": the one way a slot length is written, wherever it shows. */
export function describeSlotLength(minutes: number, t: Translate = en): string {
  return minutes % 60 === 0 ? t`${minutes / 60}-hour` : t`${minutes}-minute`;
}

/** "06:00" from minutes after midnight. */
export function clockLabel(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/**
 * One line for several of the same thing, such as two showers. With one, it is that
 * one's own line. With more, it says how many are free right now.
 */
export function describeNowAcross(lines: readonly string[], t: Translate = en): string {
  if (lines.length === 0) return t("Switched off");
  if (lines.length === 1) return lines[0];
  // Every line about something free starts with the same word, in either language.
  const free = lines.filter((line) => line.startsWith(t("Free"))).length;
  if (free > 0) return t`${free} of ${lines.length} free`;
  // All closed, or all not open yet: they share one line.
  if (lines.every((line) => line === lines[0])) return lines[0];
  return t("All taken right now");
}
