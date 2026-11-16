import type { Metadata } from "next";
import Link from "next/link";
import { AutoRefresh } from "@/components/booking/auto-refresh";
import { RoomArt, type Room } from "@/components/illustrations/room-art";
import { listDayBookings, listMyUpcoming, listResources } from "@/lib/booking/service";
import { describeNow, describeWhen } from "@/lib/booking/status";
import { describeDue } from "@/lib/cleaning/rota";
import { getRota } from "@/lib/cleaning/service";
import { listMembers } from "@/lib/households";
import { formatJoinCode } from "@/lib/join-code";
import { requireHousehold } from "@/lib/session";
import { dayInZone } from "@/lib/time";
import { ShareCode } from "./share-code";

// This screen depends on who is signed in, so it is rendered per request.
export const instant = false;

export const metadata: Metadata = { title: "Home" };

type Band = { room: Room; href: string; label: string; className: string; status: string; detail?: string };

export default async function HomePage() {
  const { user, household } = await requireHousehold();
  const timeZone = household.timeZone;
  const now = new Date();
  const today = dayInZone(now, timeZone);

  const [resources, members, upcoming, rota] = await Promise.all([
    listResources(household.id),
    listMembers(household.id),
    listMyUpcoming(household.id, user.id, now),
    getRota(household.id, today),
  ]);
  const shower = resources.find((resource) => resource.kind === "shower" && resource.enabled);
  const washer = resources.find((resource) => resource.kind === "washer" && resource.enabled);
  const [showerToday, washerToday] = await Promise.all([
    shower ? listDayBookings(shower.id, household.id, today, timeZone) : [],
    washer ? listDayBookings(washer.id, household.id, today, timeZone) : [],
  ]);

  const nextOf = (kinds: string[]) => {
    const next = upcoming.find((booking) => kinds.includes(booking.kind));
    if (!next) return undefined;
    const what = next.kind === "dryer" ? "Your dryer slot" : next.kind === "washer" ? "Your wash" : "Your slot";
    return next.startsAt <= now ? `${what} is now` : `${what}: ${describeWhen(next.startsAt, now, timeZone)}`;
  };

  const myTurns = rota.filter((row) => row.assignee?.userId === user.id && !row.done);
  let cleaningStatus = "No rooms yet";
  let cleaningDetail: string | undefined = "Add the rooms you share";
  if (rota.length > 0) {
    cleaningDetail = undefined;
    if (myTurns.length === 1) {
      cleaningStatus = `Your turn: ${myTurns[0].name}`;
      cleaningDetail = describeDue(today, myTurns[0].lastDay);
    } else if (myTurns.length > 1) {
      cleaningStatus = `${myTurns.length} rooms are yours`;
      cleaningDetail = myTurns.map((turn) => turn.name).join(", ");
    } else if (rota.every((row) => row.done)) {
      cleaningStatus = "All clean";
    } else {
      cleaningStatus = "Nothing for you now";
    }
  }

  const bands: Band[] = [
    {
      room: "shower",
      href: "/shower",
      label: shower?.name ?? "Shower",
      className: "bg-fjord text-paper",
      status: shower ? describeNow({ rules: shower, bookings: showerToday, now, timeZone, userId: user.id }) : "Switched off",
      detail: shower ? nextOf(["shower"]) : undefined,
    },
    {
      room: "laundry",
      href: "/laundry",
      label: washer?.name ?? "Laundry",
      className: "bg-ochre text-ink",
      status: washer ? describeNow({ rules: washer, bookings: washerToday, now, timeZone, userId: user.id }) : "Switched off",
      detail: washer ? nextOf(["washer", "dryer"]) : undefined,
    },
    { room: "cleaning", href: "/cleaning", label: "Cleaning", className: "bg-spruce text-paper", status: cleaningStatus, detail: cleaningDetail },
  ];

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-6 pt-10">
      <AutoRefresh everySeconds={60} />
      <header className="flex flex-col gap-1">
        <p className="font-semibold text-ink-soft">Hi {user.name}</p>
        <h1 className="type-display text-6xl break-words">{household.name}</h1>
      </header>

      {members.length === 1 ? (
        <section aria-labelledby="code-heading" className="flex flex-col gap-3 rounded-2xl border-2 border-ink p-5">
          <h2 id="code-heading" className="font-semibold">
            Share this code to get your roommates in
          </h2>
          <p className="type-display text-6xl tracking-widest" data-testid="join-code">
            {formatJoinCode(household.joinCode)}
          </p>
          <ShareCode code={household.joinCode} />
        </section>
      ) : null}

      <section aria-labelledby="now-heading">
        <h2 id="now-heading" className="sr-only">
          Right now
        </h2>
        <ul className="flex flex-col gap-3">
          {bands.map((band, index) => (
            <li key={band.room}>
              <Link
                href={band.href}
                data-testid={`band-${band.room}`}
                className={`flex items-center justify-between gap-3 rounded-2xl py-4 pr-3 pl-5 outline-none transition-transform focus-visible:ring-4 focus-visible:ring-ink/40 active:scale-[0.98] ${band.className}`}
              >
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="font-semibold">{band.label}</span>
                  <span className="type-display text-4xl break-words">{band.status}</span>
                  {band.detail ? <span className="font-semibold">{band.detail}</span> : null}
                </span>
                <RoomArt room={band.room} animate delay={0.2 + index * 0.35} className="size-20 shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {members.length > 1 ? (
        <Link
          href="/settings"
          aria-label={`${members.length} people live here. Open Household`}
          className="flex w-fit items-center gap-2 rounded-full outline-none focus-visible:ring-4 focus-visible:ring-fjord/35"
        >
          <span className="flex -space-x-2">
            {members.map((member) => (
              <span
                key={member.userId}
                aria-hidden="true"
                className="type-display flex size-10 items-center justify-center rounded-full border-2 border-paper text-xl text-paper"
                style={{ backgroundColor: member.colour }}
              >
                {member.name.slice(0, 1).toUpperCase()}
              </span>
            ))}
          </span>
          <span className="font-semibold text-ink-soft">{members.length} people live here</span>
        </Link>
      ) : null}
    </main>
  );
}
