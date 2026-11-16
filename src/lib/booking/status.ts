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
  return next ? `Free until ${clockTime(next.startsAt, timeZone)}` : "Free all day";
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
