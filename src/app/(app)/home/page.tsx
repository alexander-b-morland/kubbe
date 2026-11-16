import type { Metadata } from "next";
import Link from "next/link";
import { AutoRefresh } from "@/components/booking/auto-refresh";
import { RoomArt, type Room } from "@/components/illustrations/room-art";
import { listMyTasks } from "@/lib/board";
import { listDayBookings, listMyUpcoming, listResources } from "@/lib/booking/service";
import { describeNow, describeNowAcross, describeWhen } from "@/lib/booking/status";
import { describeDue } from "@/lib/cleaning/rota";
import { getRota } from "@/lib/cleaning/service";
import { buildToDos } from "@/lib/dashboard";
import { listUpcomingDinners } from "@/lib/dinner/service";
import { hasExtra } from "@/lib/extras";
import { listUpcoming } from "@/lib/happenings";
import { listMembers } from "@/lib/households";
import { formatJoinCode } from "@/lib/join-code";
import { balances, formatAmount, settleUp } from "@/lib/money";
import { requireHousehold } from "@/lib/session";
import { listExpenses, listToBuy } from "@/lib/shopping";
import { dayInZone } from "@/lib/time";
import { ShareCode } from "./share-code";

// This screen depends on who is signed in, so it is rendered per request.
export const instant = false;

export const metadata: Metadata = { title: "Home" };

/** "Ida and Knut live here", "Ida, Knut and 2 more live here". */
function peopleLine(names: string[]): string {
  const sorted = [...names].sort((a, b) => Number(b === "you") - Number(a === "you"));
  const [first, second, ...rest] = sorted.map((name) => (name === "you" ? "You" : name));
  if (rest.length === 0) return `${first} and ${second} live here`;
  if (rest.length === 1) return `${first}, ${second} and ${rest[0]} live here`;
  return `${first}, ${second} and ${rest.length} more live here`;
}

type Band = { room: Room; href: string; label: string; className: string; status: string; detail?: string };

export default async function HomePage() {
  const { user, household, membership } = await requireHousehold();
  const timeZone = household.timeZone;
  const now = new Date();
  const today = dayInZone(now, timeZone);

  const on = (key: Parameters<typeof hasExtra>[1]) => hasExtra(household, key);
  const [resources, members, upcoming, rota, tasks, happenings, dinners, toBuy, expenses] = await Promise.all([
    listResources(household.id),
    listMembers(household.id),
    listMyUpcoming(household.id, user.id, now),
    getRota(household.id, today),
    on("board") ? listMyTasks(household.id, user.id) : [],
    on("happenings") ? listUpcoming(household.id, now) : [],
    on("dinner") ? listUpcomingDinners(household.id, today) : [],
    on("shopping") || on("dinner") ? listToBuy(household.id) : [],
    on("expenses") ? listExpenses(household.id) : [],
  ]);
  // With several showers or machines, the band speaks for all of them.
  const showers = resources.filter((resource) => resource.kind === "shower" && resource.enabled);
  const washers = resources.filter((resource) => resource.kind === "washer" && resource.enabled);
  const machines = washers.length > 0 ? washers : resources.filter((resource) => resource.kind === "dryer" && resource.enabled);
  const nowLines = async (group: typeof resources) =>
    Promise.all(
      group.map(async (rules) =>
        describeNow({ rules, bookings: await listDayBookings(rules.id, household.id, today, timeZone), now, timeZone, userId: user.id }),
      ),
    );
  const [showerLines, machineLines] = await Promise.all([nowLines(showers), nowLines(machines)]);

  const nextOf = (kinds: string[]) => {
    const next = upcoming.find((booking) => kinds.includes(booking.kind));
    if (!next) return undefined;
    const what = next.kind === "dryer" ? "Your dryer slot" : next.kind === "washer" ? "Your wash" : "Your slot";
    return next.startsAt <= now ? `${what} is now` : `${what}: ${describeWhen(next.startsAt, now, timeZone)}`;
  };

  const myTurns = rota.filter((row) => row.assignee?.userId === user.id && !row.done);
  let cleaningStatus = "No turns yet";
  let cleaningDetail: string | undefined =
    membership.role === "admin" ? "Add the rooms and chores you share" : "An admin hasn't added any yet";
  if (rota.length > 0) {
    cleaningDetail = undefined;
    if (myTurns.length === 1) {
      cleaningStatus = `Your turn: ${myTurns[0].name}`;
      cleaningDetail = describeDue(today, myTurns[0].lastDay);
    } else if (myTurns.length > 1) {
      cleaningStatus = `${myTurns.length} turns are yours`;
      cleaningDetail = myTurns.map((turn) => turn.name).join(", ");
    } else if (rota.every((row) => row.done)) {
      cleaningStatus = "All clean";
    } else {
      cleaningStatus = "Nothing for you now";
    }
  }

  const memberName = (userId: string) => members.find((member) => member.userId === userId)?.name ?? "someone who moved out";
  const toDos = buildToDos({
    me: user.id,
    today,
    turns: myTurns.map((turn) => ({ id: turn.areaId, name: turn.name, lastDay: turn.lastDay })),
    dinners,
    buying: toBuy.filter((item) => item.claimedBy === user.id).map((item) => item.name),
    buyingHref: on("shopping") ? "/shopping" : "/dinner",
    tasks,
    unanswered: happenings
      .filter((happening) => !happening.going.includes(user.id) && !happening.notGoing.includes(user.id))
      .map((happening) => ({ id: happening.id, title: happening.title, when: describeWhen(happening.startsAt, now, timeZone) })),
    owes: settleUp(balances(expenses))
      .filter((transfer) => transfer.from === user.id)
      .map((transfer) => ({ to: memberName(transfer.to), amount: formatAmount(transfer.amount, household.currency) })),
  });

  // Everything you have booked, soonest first. The first of each kind is already on its band.
  const later = upcoming.slice(0, 6);
  const nameOf = (kind: string) =>
    resources.find((resource) => resource.kind === kind)?.name ?? (kind === "shower" ? "Shower" : "Laundry");

  const bands: Band[] = [
    {
      room: "shower",
      href: "/shower",
      label: showers.length === 1 ? showers[0].name : showers.length > 1 ? `${showers.length} showers` : "Shower",
      className: "bg-fjord text-paper",
      status: describeNowAcross(showerLines),
      detail: showers.length > 0 ? nextOf(["shower"]) : undefined,
    },
    {
      room: "laundry",
      href: "/laundry",
      label: machines.length === 1 ? machines[0].name : "Laundry",
      className: "bg-ochre text-ink",
      status: describeNowAcross(machineLines),
      detail: machines.length > 0 ? nextOf(["washer", "dryer"]) : undefined,
    },
    { room: "cleaning", href: "/cleaning", label: "Cleaning", className: "bg-spruce text-paper", status: cleaningStatus, detail: cleaningDetail },
  ];

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-6 pt-10">
      <AutoRefresh everySeconds={60} />
      <header className="flex flex-col gap-1">
        <p className="font-semibold text-ink-soft">Hi {user.name}</p>
        <h1 className="type-display text-6xl break-words">{household.name}</h1>
      </header>

      {members.length === 1 ? (
        <section aria-labelledby="code-heading" className="flex flex-col gap-3 rounded-2xl border-2 border-ink p-5">
          <h2 id="code-heading" className="font-semibold">
            Invite your roommates
          </h2>
          <p className="type-display text-6xl tracking-widest" data-testid="join-code">
            {formatJoinCode(household.joinCode)}
          </p>
          <ShareCode code={household.joinCode} />
        </section>
      ) : null}

      {members.length > 1 || toDos.length > 0 ? (
        <section aria-labelledby="todo-heading" className="flex flex-col gap-1" data-testid="todo">
          <h2 id="todo-heading" className="type-display text-3xl">
            {toDos.length === 0 ? "Nothing waiting on you" : "Yours to do"}
          </h2>
          {toDos.length > 0 ? (
            <ul className="flex flex-col">
              {toDos.map((item) => (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    className="flex items-center gap-3 border-b-2 border-ink/15 py-3 outline-none focus-visible:ring-4 focus-visible:ring-fjord"
                  >
                    <RoomArt room={item.art} className="size-9 shrink-0" />
                    <span className="flex min-w-0 flex-col">
                      <span className="text-lg font-semibold break-words">{item.what}</span>
                      <span className="text-ink-soft">{item.detail}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="flex items-center gap-2 text-ink-soft">
              <svg viewBox="0 0 24 24" className="tick-draw size-6 shrink-0 text-spruce" aria-hidden="true">
                <path d="M4 13C7 15 9 17 10 19C13 13 17 8 21 5" pathLength={1} />
              </svg>
              No turns, to-dos or shopping with your name on.
            </p>
          )}
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
                className={`flex items-center justify-between gap-3 rounded-2xl py-4 pr-3 pl-5 outline-none transition-transform focus-visible:ring-4 focus-visible:ring-ink active:scale-[0.98] ${band.className}`}
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

      {later.length > 0 ? (
        <section aria-labelledby="bookings-heading" className="flex flex-col gap-1">
          <h2 id="bookings-heading" className="type-display text-3xl">
            Your bookings
          </h2>
          <ul className="flex flex-col" data-testid="my-bookings">
            {later.map((booking) => (
              <li key={booking.id} className="flex items-baseline justify-between gap-3 border-b-2 border-ink/15 py-2">
                <span className="font-semibold">{nameOf(booking.kind)}</span>
                <span className="text-ink-soft">{describeWhen(booking.startsAt, now, timeZone)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {members.length > 1 ? (
        <p>
          <Link
            href="/settings"
            className="rounded font-semibold underline underline-offset-4 outline-none focus-visible:ring-4 focus-visible:ring-fjord"
          >
            {peopleLine(members.map((member) => (member.userId === user.id ? "you" : member.name)))}
          </Link>
        </p>
      ) : null}
    </main>
  );
}
