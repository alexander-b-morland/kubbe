import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { AutoRefresh } from "@/components/booking/auto-refresh";
import { SlotList, type SlotRow } from "@/components/booking/slot-list";
import { RoomArt, type Room } from "@/components/illustrations/room-art";
import type { Resource } from "@/db/schema";
import { bookResource, cancelResourceBooking } from "@/lib/booking/actions";
import { refusalFor, slotsForDay } from "@/lib/booking/rules";
import { listDayBookings } from "@/lib/booking/service";
import { clockLabel, describeNow, describeSlotLength } from "@/lib/booking/status";
import { addDays, clockTime, dayInZone, describeDay, isDay } from "@/lib/time";

export type BookingTheme = {
  /** Classes for the coloured header band. */
  header: string;
  /** Class for the row of a slot you have. */
  mine: string;
  /** Colour of the pen circle. */
  pen: string;
};

type Props = {
  /** "/shower" or "/laundry". */
  basePath: string;
  /** Extra query parameters to keep when changing day, such as the chosen machine. */
  query?: Record<string, string>;
  room: Room;
  /** The word used in the small line above the headline: "Shower", "Washing machine". */
  label: string;
  theme: BookingTheme;
  resource: Resource;
  household: { id: string; name: string; timeZone: string };
  userId: string;
  requestedDay: unknown;
  /** Shown in the header under the headline, for example a machine switcher. */
  headerExtra?: ReactNode;
  /** Shown above the slots, and given the chosen day. */
  children?: (context: { day: string; now: Date }) => ReactNode;
};

const focusRing = "outline-none focus-visible:ring-4 focus-visible:ring-fjord";

/** The whole booking screen for one resource: header, day picker and slots. */
export async function BookingScreen(props: Props) {
  const { basePath, query = {}, room, label, theme, resource, household, userId } = props;
  const timeZone = household.timeZone;
  const now = new Date();
  const today = dayInZone(now, timeZone);
  const lastDay = addDays(today, resource.bookAheadDays);
  const requested = props.requestedDay;
  const day = isDay(requested) && requested >= today && requested <= lastDay ? requested : today;
  const isToday = day === today;

  const bookings = await listDayBookings(resource.id, household.id, day, timeZone);
  const upcoming = slotsForDay(day, resource, timeZone).filter((slot) => slot.endsAt > now);

  const rows: SlotRow[] = upcoming.map((slot) => {
    const key = slot.startsAt.toISOString();
    const time = clockTime(slot.startsAt, timeZone);
    // A slot that has started can still be taken, but say that part of it is gone.
    const underWay = slot.startsAt <= now ? `Now, until ${clockTime(slot.endsAt, timeZone)}` : undefined;
    const booked = bookings.find((b) => b.startsAt < slot.endsAt && b.endsAt > slot.startsAt);
    if (booked?.userId === userId) {
      return { key, time, state: "mine", bookingId: booked.id, cancellable: booked.endsAt > now, underWay };
    }
    if (booked) return { key, time, state: "taken", name: booked.name, colour: booked.colour, underWay };

    const refusal = refusalFor({ slot, rules: resource, timeZone, now, dayBookings: bookings, userId });
    if (refusal === "back-to-back") return { key, time, state: "blocked", reason: "Leave a gap next to your slot" };
    if (refusal === "daily-limit") {
      return { key, time, state: "blocked", reason: `You've booked your ${resource.maxPerDay} for ${isToday ? "today" : "this day"}` };
    }
    return { key, time, state: "free", underWay };
  });

  // A booking made before an admin changed the hours or slot length may no longer line
  // up with any slot. It is still a booking, so it gets a row of its own.
  for (const booked of bookings) {
    const onGrid = upcoming.some((slot) => booked.startsAt < slot.endsAt && booked.endsAt > slot.startsAt);
    if (onGrid || booked.endsAt <= now) continue;
    const key = booked.startsAt.toISOString();
    const time = clockTime(booked.startsAt, timeZone);
    rows.push(
      booked.userId === userId
        ? { key, time, state: "mine", bookingId: booked.id, cancellable: true }
        : { key, time, state: "taken", name: booked.name, colour: booked.colour },
    );
  }
  rows.sort((a, b) => a.key.localeCompare(b.key));

  // The headline says what matters right now: who has it, or how long it is free.
  const describe = describeDay(day);
  const headline = isToday
    ? describeNow({ rules: resource, bookings, now, timeZone, userId })
    : describe.weekday;

  const hrefFor = (option: string) => {
    const params = new URLSearchParams(query);
    if (option !== today) params.set("day", option);
    const search = params.toString();
    return search ? `${basePath}?${search}` : basePath;
  };
  const days = Array.from({ length: resource.bookAheadDays + 1 }, (_, index) => addDays(today, index));
  const rules = [
    `${describeSlotLength(resource.slotMinutes)} slots`,
    `up to ${resource.maxPerDay} a day`,
    resource.allowBackToBack ? null : "not two in a row",
  ]
    .filter(Boolean)
    .join(", ");
  const canBookTomorrow = resource.bookAheadDays > 0;

  return (
    <main className="mx-auto flex max-w-md flex-col" style={{ "--pen": theme.pen } as CSSProperties}>
      <AutoRefresh />

      <header className={`flex flex-col gap-3 p-6 pt-8 ${theme.header}`}>
        <div className="flex items-start justify-between">
          <p className="pt-2 font-semibold">
            {label}, {isToday ? "today" : `${describe.dayOfMonth} ${describe.monthShort}`}
          </p>
          <RoomArt room={room} animate className="size-24" />
        </div>
        <h1 className="type-display text-6xl" data-testid="headline">
          {headline}
        </h1>
        {props.headerExtra}
      </header>

      <nav aria-label="Day" className="flex gap-2 overflow-x-auto px-4 py-4">
        {days.map((option) => {
          const optionLabel = describeDay(option);
          const active = option === day;
          return (
            <Link
              key={option}
              href={hrefFor(option)}
              aria-current={active ? "date" : undefined}
              className={`flex min-w-14 flex-col items-center rounded-2xl border-2 border-ink px-3 py-2 ${active ? "bg-ink text-paper" : ""} ${focusRing}`}
            >
              <span className="text-sm font-semibold">{option === today ? "Today" : optionLabel.weekdayShort}</span>
              <span className="type-display text-2xl">{optionLabel.dayOfMonth}</span>
            </Link>
          );
        })}
      </nav>

      <section className="flex flex-col gap-2 px-3 pb-10">
        {props.children?.({ day, now })}
        <p className="px-3 text-sm text-ink-soft">{rules.charAt(0).toUpperCase() + rules.slice(1)}.</p>
        {rows.length > 0 ? (
          <SlotList
            key={`${resource.id}-${day}`}
            rows={rows}
            mineClassName={theme.mine}
            book={bookResource.bind(null, resource.id)}
            cancel={cancelResourceBooking}
          />
        ) : (
          <div className="flex flex-col items-start gap-3 px-3 pt-6">
            <h2 className="type-display text-3xl">No slots left {isToday ? "today" : "this day"}</h2>
            {canBookTomorrow && isToday ? (
              <Link href={hrefFor(addDays(today, 1))} className="flex h-11 items-center font-bold underline underline-offset-4">
                Book for tomorrow
              </Link>
            ) : (
              <p>Booking opens again at {clockLabel(resource.opensAt)} tomorrow.</p>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
