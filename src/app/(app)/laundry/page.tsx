import type { Metadata } from "next";
import Link from "next/link";
import { BookingScreen } from "@/components/booking/booking-screen";
import { NothingToBook } from "@/components/booking/nothing-to-book";
import { QuickBook } from "@/components/booking/quick-book";
import type { Resource } from "@/db/schema";
import { bookResource } from "@/lib/booking/actions";
import { refusalFor, slotsForDay } from "@/lib/booking/rules";
import { listDayBookings, listResources } from "@/lib/booking/service";
import { requireHousehold } from "@/lib/session";
import { clockTime } from "@/lib/time";

// This screen depends on who is signed in, so it is rendered per request.
export const instant = false;

export const metadata: Metadata = { title: "Laundry" };

export default async function LaundryPage({ searchParams }: PageProps<"/laundry">) {
  const { user, household, membership } = await requireHousehold();
  const params = await searchParams;
  const machines = (await listResources(household.id)).filter(
    (machine) => machine.enabled && machine.kind !== "shower",
  );
  if (machines.length === 0) return <NothingToBook what="washing machine" />;

  const active = machines.find((machine) => machine.kind === params.machine) ?? machines[0];
  const dryer = machines.find((machine) => machine.kind === "dryer");
  const day = typeof params.day === "string" ? params.day : undefined;

  return (
    <BookingScreen
      basePath="/laundry"
      query={active === machines[0] ? {} : { machine: active.kind }}
      room="laundry"
      label={active.name}
      theme={{ header: "bg-ochre text-ink", mine: "bg-ochre/30", pen: "var(--color-ink)" }}
      resource={active}
      household={household}
      userId={user.id}
      requestedDay={params.day}
      headerExtra={
        machines.length > 1 ? (
          <nav aria-label="Machine" className="flex gap-2 pt-1">
            {machines.map((machine) => {
              const query = new URLSearchParams();
              if (machine !== machines[0]) query.set("machine", machine.kind);
              if (day) query.set("day", day);
              const search = query.toString();
              return (
                <Link
                  key={machine.id}
                  href={search ? `/laundry?${search}` : "/laundry"}
                  aria-current={machine === active ? "page" : undefined}
                  className={`flex h-11 items-center rounded-full border-2 border-ink px-4 font-bold outline-none focus-visible:ring-4 focus-visible:ring-ink ${machine === active ? "bg-ink text-paper" : ""}`}
                >
                  {machine.name}
                </Link>
              );
            })}
          </nav>
        ) : null
      }
    >
      {({ day: shownDay, now }) =>
        active.kind === "washer" && dryer ? (
          <DryerSuggestion
            washer={active}
            dryer={dryer}
            household={household}
            userId={user.id}
            day={shownDay}
            now={now}
          />
        ) : active.kind === "washer" && !dryer && membership.role === "admin" ? (
          <p className="px-3 pb-1 text-sm text-ink-soft">
            Have a dryer too?{" "}
            <Link href="/settings" className="font-bold underline underline-offset-4">
              Switch it on under Household
            </Link>
            .
          </p>
        ) : null
      }
    </BookingScreen>
  );
}

/** After you book a wash, offer the dryer slot that follows it. */
async function DryerSuggestion(props: {
  washer: Resource;
  dryer: Resource;
  household: { id: string; timeZone: string };
  userId: string;
  day: string;
  now: Date;
}) {
  const { washer, dryer, household, userId, day, now } = props;
  const timeZone = household.timeZone;
  const [washes, drying] = await Promise.all([
    listDayBookings(washer.id, household.id, day, timeZone),
    listDayBookings(dryer.id, household.id, day, timeZone),
  ]);

  const myWashes = washes.filter((wash) => wash.userId === userId && wash.endsAt > now);
  const dryerSlots = slotsForDay(day, dryer, timeZone);

  for (const wash of myWashes) {
    // Already drying after this wash? Then say so, so nobody has to go and check.
    const booked = drying.find(
      (b) => b.userId === userId && b.startsAt >= wash.endsAt && b.startsAt.getTime() - wash.endsAt.getTime() < 3 * 3_600_000,
    );
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

    const slot = dryerSlots.find(
      (candidate) =>
        candidate.startsAt >= wash.endsAt &&
        refusalFor({ slot: candidate, rules: dryer, timeZone, now, dayBookings: drying, userId }) === null,
    );
    if (!slot) continue;

    const start = clockTime(slot.startsAt, timeZone);
    return (
      <aside className="mx-3 mb-2 flex flex-col gap-3 rounded-2xl border-2 border-ink p-4" data-testid="dryer-suggestion">
        <p className="font-semibold">
          Your wash ends at {clockTime(wash.endsAt, timeZone)}. Want the dryer after it?
        </p>
        <QuickBook
          label={`Book dryer at ${start}`}
          pendingLabel="Booking dryer…"
          book={bookResource.bind(null, dryer.id, slot.startsAt.toISOString())}
        />
      </aside>
    );
  }
  return null;
}
