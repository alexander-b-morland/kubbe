import type { AreaKey } from "@/lib/areas";
import { clockLabel } from "@/lib/booking/status";
import { addDays, isDay } from "@/lib/time";
import { en, type Translate } from "@/lib/i18n";

// What happens when in a household, gathered from every area into one list of days.
// Pure: the screens fetch, this decides what each day holds and how it is worded.

export type CalendarItem = {
  key: string;
  /** YYYY-MM-DD in the household's zone. */
  day: string;
  /** Minutes after midnight, or null for something that takes the day. */
  time: number | null;
  area: AreaKey;
  title: string;
  detail: string;
  href: string;
  /** Whose faces go with it: who booked, who is in, whose turn. */
  people: string[];
  /** The reader is part of it. */
  mine: boolean;
  /** The reader has not said whether they are in. */
  ask?: { kind: "dinner" | "happening"; id: string };
  /** What the reader answered, when it is an invitation they have answered. */
  answer?: { kind: "dinner" | "happening"; id: string; going: boolean };
  /** A cleaning turn that is ticked off. */
  done?: boolean;
  /**
   * Something that comes round every day or two, like emptying the dishwasher. It is
   * listed on its day, but left off the month's sheet, where it would fill every square.
   */
  routine?: boolean;
};

export type CalendarInput = {
  me: string;
  nameOf: (userId: string) => string;
  bookings: readonly { id: string; userId: string; kind: "shower" | "washer" | "dryer"; name: string; day: string; from: number; to: number }[];
  dinners: readonly {
    id: string;
    day: string;
    time: number;
    cancelled: boolean;
    cookId: string | null;
    chosenTitle: string | null;
    going: readonly string[];
    notGoing: readonly string[];
  }[];
  happenings: readonly { id: string; title: string; day: string; time: number; place: string; going: readonly string[]; notGoing: readonly string[] }[];
  /** Fixed dinner days too far off to have a dinner of their own yet. */
  fixedDinners?: readonly { day: string; time: number }[];
  turns: readonly { areaId: string; name: string; day: string; assigneeId: string | null; done: boolean; routine?: boolean }[];
};

export function buildCalendar(input: CalendarInput, t: Translate = en): CalendarItem[] {
  const { me, nameOf } = input;
  const who = (userId: string) => (userId === me ? t("You") : nameOf(userId));
  const items: CalendarItem[] = [];

  for (const booking of input.bookings) {
    const laundry = booking.kind !== "shower";
    items.push({
      key: `booking-${booking.id}`,
      day: booking.day,
      time: booking.from,
      area: laundry ? "laundry" : "shower",
      title: booking.name,
      detail: t`${who(booking.userId)}, until ${clockLabel(booking.to)}`,
      href: `${laundry ? "/laundry" : "/shower"}?day=${booking.day}`,
      people: [booking.userId],
      mine: booking.userId === me,
    });
  }

  for (const dinner of input.dinners) {
    if (dinner.cancelled) continue;
    const answered = dinner.going.includes(me) || dinner.notGoing.includes(me);
    items.push({
      key: `dinner-${dinner.id}`,
      day: dinner.day,
      time: dinner.time,
      area: "dinner",
      title: dinner.chosenTitle ? t`Dinner: ${dinner.chosenTitle}` : t("Dinner"),
      detail: dinner.cookId ? (dinner.cookId === me ? t("You cook") : t`${nameOf(dinner.cookId)} cooks`) : t("Nobody cooks yet"),
      href: `/dinner/${dinner.id}`,
      people: [...dinner.going],
      mine: dinner.going.includes(me) || dinner.cookId === me,
      ask: answered ? undefined : { kind: "dinner", id: dinner.id },
      answer: answered ? { kind: "dinner", id: dinner.id, going: dinner.going.includes(me) } : undefined,
    });
  }

  for (const fixed of input.fixedDinners ?? []) {
    items.push({
      key: `fixed-${fixed.day}`,
      day: fixed.day,
      time: fixed.time,
      area: "dinner",
      title: t("Dinner"),
      detail: t("A fixed dinner day. It opens for answers two weeks ahead."),
      href: "/dinner",
      people: [],
      mine: false,
    });
  }

  for (const happening of input.happenings) {
    const answered = happening.going.includes(me) || happening.notGoing.includes(me);
    items.push({
      key: `happening-${happening.id}`,
      day: happening.day,
      time: happening.time,
      area: "happenings",
      title: happening.title,
      detail: happening.place,
      href: `/happenings#${happening.id}`,
      people: [...happening.going],
      mine: happening.going.includes(me),
      ask: answered ? undefined : { kind: "happening", id: happening.id },
      answer: answered ? { kind: "happening", id: happening.id, going: happening.going.includes(me) } : undefined,
    });
  }

  for (const turn of input.turns) {
    items.push({
      key: `turn-${turn.areaId}-${turn.day}`,
      day: turn.day,
      time: null,
      area: "cleaning",
      title: turn.name,
      detail: turn.done ? t("Done") : turn.assigneeId ? (turn.assigneeId === me ? t("Your turn") : t`${nameOf(turn.assigneeId)}'s turn`) : t("Nobody's turn"),
      href: "/cleaning",
      people: turn.assigneeId ? [turn.assigneeId] : [],
      mine: turn.assigneeId === me,
      done: turn.done,
      routine: turn.routine,
    });
  }

  // Through the day in order; what takes the whole day comes last.
  return items.sort((a, b) => a.day.localeCompare(b.day) || (a.time ?? 1440) - (b.time ?? 1440) || a.key.localeCompare(b.key));
}

/** "2026-11" from "2026-11-18". */
export const monthOf = (day: string) => day.slice(0, 7);

export function isMonth(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

/** Move a month by whole months: ("2026-12", 1) is "2027-01". */
export function shiftMonth(month: string, by: number): string {
  const [year, index] = month.split("-").map(Number);
  return new Date(Date.UTC(year, index - 1 + by, 1)).toISOString().slice(0, 7);
}

/**
 * The days a month's sheet shows, in whole weeks from Monday to Sunday. The first and
 * last week reach into the months on either side.
 */
export function monthSheet(month: string): string[][] {
  const first = `${month}-01`;
  const weekday = new Date(`${first}T12:00:00Z`).getUTCDay() || 7; // 1 is Monday
  let day = addDays(first, 1 - weekday);
  const weeks: string[][] = [];
  do {
    const week: string[] = [];
    for (let index = 0; index < 7; index++, day = addDays(day, 1)) week.push(day);
    weeks.push(week);
  } while (monthOf(day) === month);
  return weeks;
}

/** The day to show when a month is opened: the one asked for if it is on the sheet, else today or the 1st. */
export function pickDay(month: string, requested: unknown, today: string): string {
  if (isDay(requested) && monthOf(requested) === month) return requested;
  return monthOf(today) === month ? today : `${month}-01`;
}
