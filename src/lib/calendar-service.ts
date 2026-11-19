import { listBookingsBetween } from "@/lib/booking/service";
import { buildCalendar, type CalendarItem } from "@/lib/calendar";
import { listTurnsBetween } from "@/lib/cleaning/service";
import { LOOK_AHEAD_DAYS, weekdayOf } from "@/lib/dinner/plan";
import { listDinnersBetween, listRules, listUpcomingDinners } from "@/lib/dinner/service";
import { hasExtra } from "@/lib/extras";
import type { Translate } from "@/lib/i18n";
import { listBetween } from "@/lib/happenings";
import { addDays, dayInZone, instantInZone, minutesInZone } from "@/lib/time";

/**
 * Everything on the household's calendar from one day to another, both included.
 * Scoped to the household the caller was found to be in.
 */
export async function loadCalendar(input: {
  household: { id: string; timeZone: string; extras: string[] };
  me: string;
  nameOf: (userId: string) => string;
  fromDay: string;
  toDay: string;
  today: string;
  t?: Translate;
}): Promise<CalendarItem[]> {
  const { household, fromDay, toDay, today } = input;
  const zone = household.timeZone;
  const from = instantInZone(fromDay, 0, zone);
  const to = instantInZone(addDays(toDay, 1), 0, zone);
  const dinnersOn = hasExtra(household, "dinner");

  const [bookings, turns, happenings, ahead, before, rules] = await Promise.all([
    listBookingsBetween(household.id, from, to),
    listTurnsBetween(household.id, fromDay, toDay),
    hasExtra(household, "happenings") ? listBetween(household.id, from, to) : [],
    // From today on, fixed dinner days are filled in as they are looked at.
    dinnersOn && toDay >= today ? listUpcomingDinners(household.id, today) : [],
    dinnersOn && fromDay < today ? listDinnersBetween(household.id, fromDay, addDays(today, -1) < toDay ? addDays(today, -1) : toDay) : [],
    dinnersOn ? listRules(household.id) : [],
  ]);

  // A fixed dinner day gets its dinner two weeks ahead. Further off, the calendar still shows the day is taken.
  const fixedDinners: { day: string; time: number }[] = [];
  const firstFar = addDays(today, LOOK_AHEAD_DAYS);
  for (let day = firstFar > fromDay ? firstFar : fromDay; rules.length > 0 && day <= toDay; day = addDays(day, 1)) {
    const rule = rules.find((found) => found.weekday === weekdayOf(day));
    if (rule && !ahead.some((dinner) => dinner.day === day)) fixedDinners.push({ day, time: rule.time });
  }

  return buildCalendar({
    me: input.me,
    nameOf: input.nameOf,
    bookings: bookings.map((booking) => ({
      id: booking.id,
      userId: booking.userId,
      kind: booking.kind,
      name: booking.name,
      day: dayInZone(booking.startsAt, zone),
      from: minutesInZone(booking.startsAt, zone),
      to: minutesInZone(booking.endsAt, zone),
    })),
    dinners: [...before, ...ahead].filter((dinner) => dinner.day >= fromDay && dinner.day <= toDay),
    happenings: happenings.map((happening) => ({
      id: happening.id,
      title: happening.title,
      day: dayInZone(happening.startsAt, zone),
      time: minutesInZone(happening.startsAt, zone),
      place: happening.place,
      going: happening.going,
      notGoing: happening.notGoing,
    })),
    turns,
    fixedDinners,
  }, input.t);
}
