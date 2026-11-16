import { addDays, dayInZone, daysBetween, instantInZone } from "@/lib/time";

// The booking rules, as pure functions. The server runs them inside a transaction
// before every booking; screens may run them too, to explain why a slot is unavailable.

export type ResourceRules = {
  slotMinutes: number;
  /** Minutes after midnight in the household's zone. */
  opensAt: number;
  closesAt: number;
  maxPerDay: number;
  allowBackToBack: boolean;
  bookAheadDays: number;
};

export type Slot = { startsAt: Date; endsAt: Date };

export type Refusal =
  | "not-a-slot"
  | "over"
  | "too-far-ahead"
  | "taken"
  | "daily-limit"
  | "back-to-back";

/** Every slot of a day, in order. Slots that would run past closing time are left out. */
export function slotsForDay(day: string, rules: ResourceRules, timeZone: string): Slot[] {
  const opens = instantInZone(day, rules.opensAt, timeZone).getTime();
  const closes = instantInZone(day, rules.closesAt, timeZone).getTime();
  const length = rules.slotMinutes * 60_000;
  const slots: Slot[] = [];
  if (length <= 0) return slots;
  // Step in real elapsed time so a clock change never creates overlapping slots.
  for (let start = opens; start + length <= closes; start += length) {
    slots.push({ startsAt: new Date(start), endsAt: new Date(start + length) });
  }
  return slots;
}

/** The last day that can be booked today. */
export function lastBookableDay(now: Date, rules: ResourceRules, timeZone: string): string {
  return addDays(dayInZone(now, timeZone), rules.bookAheadDays);
}

type Check = {
  slot: Slot;
  rules: ResourceRules;
  timeZone: string;
  now: Date;
  /** Bookings of this resource on the slot's day, by anyone. */
  dayBookings: { userId: string; startsAt: Date; endsAt: Date }[];
  userId: string;
};

/** Why this person cannot book this slot, or null when they can. */
export function refusalFor({ slot, rules, timeZone, now, dayBookings, userId }: Check): Refusal | null {
  const day = dayInZone(slot.startsAt, timeZone);
  const onGrid = slotsForDay(day, rules, timeZone).some(
    (candidate) =>
      candidate.startsAt.getTime() === slot.startsAt.getTime() &&
      candidate.endsAt.getTime() === slot.endsAt.getTime(),
  );
  if (!onGrid) return "not-a-slot";

  // A slot that has started can still be taken until it ends.
  if (slot.endsAt.getTime() <= now.getTime()) return "over";
  if (daysBetween(dayInZone(now, timeZone), day) > rules.bookAheadDays) return "too-far-ahead";

  const overlaps = (other: Slot) => other.startsAt < slot.endsAt && other.endsAt > slot.startsAt;
  if (dayBookings.some(overlaps)) return "taken";

  const mine = dayBookings.filter((booking) => booking.userId === userId);
  if (mine.length >= rules.maxPerDay) return "daily-limit";

  const touches = (other: Slot) =>
    other.endsAt.getTime() === slot.startsAt.getTime() ||
    other.startsAt.getTime() === slot.endsAt.getTime();
  if (!rules.allowBackToBack && mine.some(touches)) return "back-to-back";

  return null;
}

/** A booking can be cancelled by its owner until it has ended. */
export function canCancel(booking: { userId: string; endsAt: Date }, userId: string, now: Date): boolean {
  return booking.userId === userId && booking.endsAt.getTime() > now.getTime();
}
