import type { Metadata } from "next";
import Link from "next/link";
import { AutoRefresh } from "@/components/booking/auto-refresh";
import { SlotList, type SlotRow } from "@/components/booking/slot-list";
import { RoomArt } from "@/components/illustrations/room-art";
import { refusalFor, slotsForDay } from "@/lib/booking/rules";
import { findResource, listDayBookings } from "@/lib/booking/service";
import { requireHousehold } from "@/lib/session";
import { addDays, clockTime, dayInZone, describeDay, instantInZone, isDay } from "@/lib/time";
import { bookShower, cancelShower } from "./actions";

// This screen depends on who is signed in, so it is rendered per request.
export const instant = false;

export const metadata: Metadata = { title: "Shower" };

const focusRing = "outline-none focus-visible:ring-4 focus-visible:ring-fjord/35";

export default async function ShowerPage({ searchParams }: PageProps<"/shower">) {
  const { user, household } = await requireHousehold();
  const shower = await findResource(household.id, "shower");
  const timeZone = household.timeZone;

  if (!shower) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 p-6 pt-10">
        <h1 className="type-display text-5xl">No shower to book</h1>
        <p>This household has its shower switched off. An admin can switch it on.</p>
        <Link href="/home" className="font-bold underline underline-offset-4">
          Back to {household.name}
        </Link>
      </main>
    );
  }

  const now = new Date();
  const today = dayInZone(now, timeZone);
  const lastDay = addDays(today, shower.bookAheadDays);
  const requested = (await searchParams).day;
  const day = isDay(requested) && requested >= today && requested <= lastDay ? requested : today;
  const isToday = day === today;

  const bookings = await listDayBookings(shower.id, household.id, day, timeZone);
  const upcoming = slotsForDay(day, shower, timeZone).filter((slot) => slot.endsAt > now);

  const rows: SlotRow[] = upcoming.map((slot) => {
    const key = slot.startsAt.toISOString();
    const time = clockTime(slot.startsAt, timeZone);
    const booked = bookings.find((b) => b.startsAt < slot.endsAt && b.endsAt > slot.startsAt);
    if (booked?.userId === user.id) {
      return { key, time, state: "mine", bookingId: booked.id, cancellable: booked.endsAt > now };
    }
    if (booked) return { key, time, state: "taken", name: booked.name, colour: booked.colour };

    const refusal = refusalFor({ slot, rules: shower, timeZone, now, dayBookings: bookings, userId: user.id });
    if (refusal === "back-to-back") return { key, time, state: "blocked", reason: "Right next to your slot" };
    if (refusal === "daily-limit") return { key, time, state: "blocked", reason: "You've used your slots" };
    return { key, time, state: "free" };
  });

  // The headline says what matters right now: who is in there, or how long it is free.
  const describe = describeDay(day);
  let headline = describe.weekday;
  if (isToday) {
    const current = bookings.find((b) => b.startsAt <= now && b.endsAt > now);
    const next = bookings.find((b) => b.startsAt > now);
    const opens = instantInZone(day, shower.opensAt, timeZone);
    const closes = instantInZone(day, shower.closesAt, timeZone);
    if (current) {
      headline = `${current.userId === user.id ? "Yours" : current.name} until ${clockTime(current.endsAt, timeZone)}`;
    } else if (now < opens) {
      headline = `Opens ${clockTime(opens, timeZone)}`;
    } else if (now >= closes || upcoming.length === 0) {
      headline = "Closed for today";
    } else if (next) {
      headline = `Free until ${clockTime(next.startsAt, timeZone)}`;
    } else {
      headline = "Free all day";
    }
  }

  const days = Array.from({ length: shower.bookAheadDays + 1 }, (_, index) => addDays(today, index));
  const rules = [
    `${shower.slotMinutes} minute slots`,
    `up to ${shower.maxPerDay} a day`,
    shower.allowBackToBack ? null : "not back to back",
  ].filter(Boolean);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col">
      <AutoRefresh />

      <header className="flex flex-col gap-3 bg-fjord p-6 pt-8 text-paper">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-3">
            <Link href="/home" className={`w-fit rounded font-semibold underline underline-offset-4 ${focusRing}`}>
              {household.name}
            </Link>
            <p className="font-semibold">{isToday ? "Shower, today" : `Shower, ${describe.dayOfMonth} ${describe.monthShort}`}</p>
          </div>
          <RoomArt room="shower" animate className="size-24" />
        </div>
        <h1 className="type-display text-6xl" data-testid="headline">
          {headline}
        </h1>
      </header>

      <nav aria-label="Day" className="flex gap-2 overflow-x-auto px-4 py-4">
        {days.map((option) => {
          const label = describeDay(option);
          const active = option === day;
          return (
            <Link
              key={option}
              href={option === today ? "/shower" : `/shower?day=${option}`}
              aria-current={active ? "date" : undefined}
              className={`flex min-w-14 flex-col items-center rounded-2xl border-2 border-ink px-3 py-2 ${active ? "bg-ink text-paper" : ""} ${focusRing}`}
            >
              <span className="text-sm font-semibold">{option === today ? "Today" : label.weekdayShort}</span>
              <span className="type-display text-2xl">{label.dayOfMonth}</span>
            </Link>
          );
        })}
      </nav>

      <section className="flex flex-col gap-2 px-3 pb-10">
        <p className="px-3 text-sm text-ink-soft first-letter:uppercase">{rules.join(", ")}.</p>
        {rows.length > 0 ? (
          <SlotList key={day} rows={rows} book={bookShower} cancel={cancelShower} />
        ) : (
          <div className="flex flex-col items-start gap-3 px-3 pt-6">
            <h2 className="type-display text-3xl">No slots left today</h2>
            <Link href={`/shower?day=${addDays(today, 1)}`} className="font-bold underline underline-offset-4">
              Book for tomorrow
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
