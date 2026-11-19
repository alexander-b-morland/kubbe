import type { Metadata } from "next";
import Link from "next/link";
import { BookingScreen } from "@/components/booking/booking-screen";
import { NothingToBook } from "@/components/booking/nothing-to-book";
import { QuickBook } from "@/components/booking/quick-book";
import { Switcher, switcherItems } from "@/components/booking/switcher";
import type { Resource } from "@/db/schema";
import { bookResource } from "@/lib/booking/actions";
import { refusalFor, slotsForDay } from "@/lib/booking/rules";
import { listDayBookings, listEnabled } from "@/lib/booking/service";
import { requireHousehold } from "@/lib/session";
import { clockTime } from "@/lib/time";

// This screen depends on who is signed in, so it is rendered per request.
export const instant = false;

export const metadata: Metadata = { title: "Laundry" };

export default async function LaundryPage({ searchParams }: PageProps<"/laundry">) {
  const { user, household, membership } = await requireHousehold();
  const params = await searchParams;
  // Washing machines first, then dryers. A household can have several of each.
  const machines = await listEnabled(household.id, ["washer", "dryer"]);
  if (machines.length === 0) return <NothingToBook what="washing machine" />;

  const active = machines.find((machine) => machine.id === params.machine) ?? machines[0];
  const dryers = machines.filter((machine) => machine.kind === "dryer");
  const washers = machines.filter((machine) => machine.kind === "washer");
  const day = typeof params.day === "string" ? params.day : undefined;

  return (
    <BookingScreen
      basePath="/laundry"
      query={active === machines[0] ? {} : { machine: active.id }}
      room="laundry"
      label={active.name}
      theme={{ mine: "bg-ochre/30", pen: "var(--color-ink)" }}
      manageHref={membership.role === "admin" ? `/settings/rules?from=laundry&open=${active.id}#${active.id}` : undefined}
      resource={active}
      household={household}
      userId={user.id}
      requestedDay={params.day}
      headerExtra={
        <Switcher
          label="Machine"
          tone="on-light"
          items={switcherItems({ basePath: "/laundry", param: "machine", all: machines, active, day })}
        />
      }
    >
      {({ day: shownDay, now }) =>
        active.kind === "washer" && dryers.length > 0 ? (
          <DryerSuggestion washer={active} dryers={dryers} household={household} userId={user.id} day={shownDay} now={now} />
        ) : active.kind === "dryer" && washers.length > 0 ? (
          <WashNote washers={washers} household={household} userId={user.id} day={shownDay} now={now} />
        ) : active.kind === "washer" && membership.role === "admin" ? (
          <p className="px-3 pb-1 text-sm text-ink-soft">
            Have a dryer too?{" "}
            <Link href="/settings/rules?from=laundry" className="font-bold underline underline-offset-4">
              Switch it on in the rules
            </Link>
            .
          </p>
        ) : null
      }
    </BookingScreen>
  );
}

/** On a dryer's sheet: when your wash that day ends, so you know which slot to take. */
async function WashNote(props: { washers: Resource[]; household: { id: string; timeZone: string }; userId: string; day: string; now: Date }) {
  const { washers, household, userId, day, now } = props;
  const booked = await Promise.all(washers.map((washer) => listDayBookings(washer.id, household.id, day, household.timeZone)));
  const mine = booked
    .flat()
    .filter((wash) => wash.userId === userId && wash.endsAt > new Date(now.getTime() - 3 * 3_600_000))
    .sort((a, b) => a.endsAt.getTime() - b.endsAt.getTime());
  if (mine.length === 0) return null;
  const ends = mine.map((wash) => clockTime(wash.endsAt, household.timeZone));
  return (
    <p className="mx-3 mb-2 rounded-2xl border-2 border-ink p-4 font-semibold" data-testid="wash-note">
      {mine.length === 1 ? `Your wash ends at ${ends[0]}.` : `Your washes end at ${ends.slice(0, -1).join(", ")} and ${ends.at(-1)}.`} Pick a slot after it.
    </p>
  );
}

/** After you book a wash, offer a dryer slot that follows it. */
async function DryerSuggestion(props: {
  washer: Resource;
  dryers: Resource[];
  household: { id: string; timeZone: string };
  userId: string;
  day: string;
  now: Date;
}) {
  const { washer, dryers, household, userId, day, now } = props;
  const timeZone = household.timeZone;
  const [washes, ...drying] = await Promise.all([
    listDayBookings(washer.id, household.id, day, timeZone),
    ...dryers.map((dryer) => listDayBookings(dryer.id, household.id, day, timeZone)),
  ]);
  const myWashes = washes.filter((wash) => wash.userId === userId && wash.endsAt > now);
  const soonAfter = (start: Date, wash: { endsAt: Date }) =>
    start >= wash.endsAt && start.getTime() - wash.endsAt.getTime() < 3 * 3_600_000;

  for (const wash of myWashes) {
    // Already drying after this wash? Then say so, so nobody has to go and check.
    const booked = drying.flat().find((b) => b.userId === userId && soonAfter(b.startsAt, wash));
    if (booked) {
      return (
        <aside className="mx-3 mb-2 flex items-center gap-2 rounded-2xl border-2 border-ink p-4 font-semibold" data-testid="dryer-booked">
          <svg viewBox="0 0 24 24" className="tick-draw size-6 shrink-0" aria-hidden="true">
            <path d="M4 13C7 15 9 17 10 19C13 13 17 8 21 5" pathLength={1} />
          </svg>
          Dryer booked for {clockTime(booked.startsAt, timeZone)}, after your wash.
        </aside>
      );
    }

    // The first dryer with a free slot after the wash.
    for (const [index, dryer] of dryers.entries()) {
      const slot = slotsForDay(day, dryer, timeZone).find(
        (candidate) =>
          candidate.startsAt >= wash.endsAt &&
          refusalFor({ slot: candidate, rules: dryer, timeZone, now, dayBookings: drying[index], userId }) === null,
      );
      if (!slot) continue;
      const start = clockTime(slot.startsAt, timeZone);
      const which = dryers.length > 1 ? dryer.name.toLowerCase() : "dryer";
      return (
        <aside className="mx-3 mb-2 flex flex-col gap-3 rounded-2xl border-2 border-ink p-4" data-testid="dryer-suggestion">
          <p className="font-semibold">
            Your wash ends at {clockTime(wash.endsAt, timeZone)}. Want the {which} after it?
          </p>
          <QuickBook
            label={`Book ${which} at ${start}`}
            pendingLabel="Booking dryer…"
            book={bookResource.bind(null, dryer.id, slot.startsAt.toISOString())}
          />
        </aside>
      );
    }
  }
  return null;
}
