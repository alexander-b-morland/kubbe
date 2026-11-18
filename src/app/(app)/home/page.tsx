import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/avatar/avatar";
import { Person, type PersonLike } from "@/components/avatar/person";
import { Sticky } from "@/components/board/sticky";
import { AutoRefresh } from "@/components/booking/auto-refresh";
import { AgendaItem, AnswerButtons } from "@/components/calendar/agenda";
import { RoomArt } from "@/components/illustrations/room-art";
import { areaOf, areasFor, type AreaKey } from "@/lib/areas";
import { listNotes } from "@/lib/board";
import { listDayBookings, listMyUpcoming, listResources } from "@/lib/booking/service";
import { clockLabel, describeNow, describeNowAcross, describeWhen } from "@/lib/booking/status";
import { buildCalendar } from "@/lib/calendar";
import { describeDue } from "@/lib/cleaning/rota";
import { getRota } from "@/lib/cleaning/service";
import { buildToDos } from "@/lib/dashboard";
import { describeDinnerDay } from "@/lib/dinner/plan";
import { listUpcomingDinners } from "@/lib/dinner/service";
import { hasExtra } from "@/lib/extras";
import { listUpcoming } from "@/lib/happenings";
import { listMembers } from "@/lib/households";
import { formatJoinCode } from "@/lib/join-code";
import { balances, formatAmount, mySettlements, settleUp } from "@/lib/money";
import { requireHousehold } from "@/lib/session";
import { listExpenses, listToBuy } from "@/lib/shopping";
import { addDays, dayInZone, describeDay, minutesInZone } from "@/lib/time";
import { ShareCode } from "./share-code";

// This screen depends on who is signed in, so it is rendered per request.
export const instant = false;

export const metadata: Metadata = { title: "Home" };

const ring = "outline-none focus-visible:ring-4 focus-visible:ring-fjord";
const more = `flex min-h-11 w-fit items-center rounded font-bold underline underline-offset-4 ${ring}`;

type Tile = { status: string; detail?: string };

export default async function HomePage() {
  const { user, household, membership } = await requireHousehold();
  const timeZone = household.timeZone;
  const now = new Date();
  const today = dayInZone(now, timeZone);
  const on = (key: Parameters<typeof hasExtra>[1]) => hasExtra(household, key);

  const [resources, members, upcoming, rota, notes, happenings, dinners, toBuy, expenses] = await Promise.all([
    listResources(household.id),
    listMembers(household.id),
    listMyUpcoming(household.id, user.id, now),
    getRota(household.id, today),
    on("board") ? listNotes(household.id, now) : [],
    on("happenings") ? listUpcoming(household.id, now) : [],
    on("dinner") ? listUpcomingDinners(household.id, today) : [],
    on("shopping") || on("dinner") ? listToBuy(household.id) : [],
    on("expenses") ? listExpenses(household.id) : [],
  ]);
  const people = new Map<string, PersonLike>(members.map((member) => [member.userId, member]));
  const me = people.get(user.id);
  const nameOf = (userId: string) => people.get(userId)?.name ?? "Someone who moved out";
  const money = (amount: number) => formatAmount(amount, household.currency);

  // With several showers or machines, the tile speaks for all of them.
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

  // ---- what each area's tile says
  const myTurns = rota.filter((row) => row.assignee?.userId === user.id && !row.done);
  const cleaning: Tile =
    rota.length === 0
      ? { status: "No turns yet", detail: membership.role === "admin" ? "Add the rooms and chores you share" : "An admin hasn't added any yet" }
      : myTurns.length === 1
        ? { status: `Your turn: ${myTurns[0].name}`, detail: describeDue(today, myTurns[0].lastDay) }
        : myTurns.length > 1
          ? { status: `${myTurns.length} turns are yours`, detail: myTurns.map((turn) => turn.name).join(", ") }
          : rota.every((row) => row.done)
            ? { status: "All clean" }
            : { status: "Nothing for you now" };

  const nextDinner = dinners.find((dinner) => !dinner.cancelled);
  const nextHappening = happenings[0];
  const net = balances(expenses);
  const balance = net.get(user.id) ?? 0;
  const { owe, owed } = mySettlements(settleUp(net), user.id);
  const openNotes = notes.filter((note) => !note.doneAt);
  const openTasks = openNotes.filter((note) => note.isTask).length;

  const tiles: Record<AreaKey, Tile> = {
    shower: { status: describeNowAcross(showerLines), detail: showers.length > 0 ? nextOf(["shower"]) : undefined },
    laundry: { status: describeNowAcross(machineLines), detail: machines.length > 0 ? nextOf(["washer", "dryer"]) : undefined },
    cleaning,
    dinner: nextDinner
      ? {
          status: nextDinner.chosenTitle ?? `${describeDinnerDay(nextDinner.day, today)} ${clockLabel(nextDinner.time)}`,
          detail: nextDinner.chosenTitle
            ? `${describeDinnerDay(nextDinner.day, today)} at ${clockLabel(nextDinner.time)}`
            : nextDinner.ideas === 0
              ? "Nothing suggested yet"
              : `${nextDinner.ideas === 1 ? "1 idea" : `${nextDinner.ideas} ideas`}, not decided`,
        }
      : { status: "Nothing planned", detail: "Plan a dinner" },
    shopping: { status: toBuy.length === 0 ? "Nothing to buy" : `${toBuy.length} to buy`, detail: toBuy.length > 0 ? toBuy.slice(0, 3).map((item) => item.name).join(", ") : undefined },
    expenses: { status: balance > 0 ? `You're owed ${money(balance)}` : balance < 0 ? `You owe ${money(balance)}` : "All square" },
    happenings: nextHappening
      ? { status: nextHappening.title, detail: describeWhen(nextHappening.startsAt, now, timeZone) }
      : { status: "Nothing planned", detail: "Suggest something" },
    board: { status: openNotes.length === 0 ? "Empty" : openTasks > 0 ? `${openTasks} to do` : openNotes.length === 1 ? "1 note" : `${openNotes.length} notes` },
  };

  // ---- what is yours to do
  const toDos = buildToDos({
    me: user.id,
    today,
    turns: myTurns.map((turn) => ({ id: turn.areaId, name: turn.name, lastDay: turn.lastDay })),
    dinners,
    buying: toBuy.filter((item) => item.claimedBy === user.id).map((item) => item.name),
    buyingHref: on("shopping") ? "/shopping" : "/dinner",
    tasks: openNotes.filter((note) => note.isTask && note.assigneeId === user.id).map((note) => ({ id: note.id, body: note.body })),
    unanswered: happenings
      .filter((happening) => !happening.going.includes(user.id) && !happening.notGoing.includes(user.id))
      .map((happening) => ({ id: happening.id, title: happening.title, when: describeWhen(happening.startsAt, now, timeZone) })),
  });

  // ---- the week ahead, from what is already loaded
  const weekEnd = addDays(today, 6);
  const kindName = (kind: string) => resources.find((resource) => resource.kind === kind)?.name ?? (kind === "shower" ? "Shower" : "Laundry");
  const week = buildCalendar({
    me: user.id,
    nameOf,
    bookings: upcoming.map((booking) => ({
      id: booking.id,
      userId: user.id,
      kind: booking.kind,
      name: kindName(booking.kind),
      day: dayInZone(booking.startsAt, timeZone),
      from: minutesInZone(booking.startsAt, timeZone),
      to: minutesInZone(booking.endsAt, timeZone),
    })),
    dinners,
    happenings: happenings.map((happening) => ({
      id: happening.id,
      title: happening.title,
      day: dayInZone(happening.startsAt, timeZone),
      time: minutesInZone(happening.startsAt, timeZone),
      place: happening.place,
      going: happening.going,
      notGoing: happening.notGoing,
    })),
    turns: myTurns.map((turn) => ({ areaId: turn.areaId, name: turn.name, day: turn.lastDay, assigneeId: user.id, done: false })),
  }).filter((item) => item.day >= today && item.day <= weekEnd);
  const dayLabel = (day: string) => (day === today ? "Today" : day === addDays(today, 1) ? "Tomorrow" : describeDay(day).weekday);

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-8 p-6 pt-10 lg:max-w-6xl">
      <AutoRefresh everySeconds={60} />
      <header className="flex items-center gap-4">
        <Link href="/profile" aria-label="Your profile" className={`rounded-full ${ring}`}>
          <Avatar avatar={me?.avatar} colour={me?.colour ?? membership.colour} className="size-16" />
        </Link>
        <div className="flex min-w-0 flex-col gap-1">
          <p className="font-semibold text-ink-soft break-words">{household.name}</p>
          <h1 className="type-display text-5xl break-words">Hi {user.name}</h1>
        </div>
      </header>

      {members.length === 1 ? (
        <section aria-labelledby="code-heading" className="flex flex-col gap-3 rounded-2xl border-2 border-ink p-5">
          <h2 id="code-heading" className="type-display text-2xl">
            Invite your roommates
          </h2>
          <p className="text-ink-soft">
            Send them the link, or the code{" "}
            <span className="type-display text-2xl tracking-widest text-ink" data-testid="join-code">
              {formatJoinCode(household.joinCode)}
            </span>
          </p>
          <ShareCode code={household.joinCode} />
        </section>
      ) : null}

      <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[1.7fr_1fr] lg:items-start lg:gap-10">
        <div className="flex flex-col gap-8">
          {members.length > 1 || toDos.length > 0 ? (
            <section aria-labelledby="todo-heading" className="flex flex-col gap-1" data-testid="todo">
              <h2 id="todo-heading" className="type-display text-3xl">
                {toDos.length === 0 ? "Nothing waiting on you" : "Yours to do"}
              </h2>
              {toDos.length > 0 ? (
                <ul className="flex flex-col">
                  {toDos.map((item) => {
                    const area = areaOf(item.area);
                    return (
                      <li key={item.key} className="flex gap-3 border-b-2 border-ink/15 py-3">
                        <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${area.band}`}>
                          <RoomArt room={area.art} className="size-7" />
                        </span>
                        <div className="flex min-w-0 flex-1 flex-col gap-2">
                          <Link href={item.href} className={`flex flex-col rounded ${ring}`}>
                            <span className="text-lg font-semibold break-words">{item.what}</span>
                            <span className="text-ink-soft">{item.detail}</span>
                          </Link>
                          {item.ask ? <AnswerButtons ask={item.ask} title={item.ask.title} /> : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="flex items-center gap-2 text-ink-soft">
                  <svg viewBox="0 0 24 24" className="tick-draw size-6 shrink-0 text-spruce" aria-hidden="true">
                    <path d="M4 13C7 15 9 17 10 19C13 13 17 8 21 5" pathLength={1} />
                  </svg>
                  No turns, to-dos, invitations or shopping with your name on.
                </p>
              )}
            </section>
          ) : null}

          <section aria-labelledby="areas-heading" className="flex flex-col gap-3">
            <h2 id="areas-heading" className="type-display text-3xl">
              The flat right now
            </h2>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {areasFor(household).map((area, index) => {
                const tile = tiles[area.key];
                return (
                  <li key={area.key}>
                    <Link
                      href={area.href}
                      data-testid={`band-${area.key}`}
                      className={`flex h-full min-h-40 flex-col gap-2 rounded-2xl p-4 outline-none transition-transform focus-visible:ring-4 active:scale-[0.98] ${area.band} ${area.ring}`}
                    >
                      <span className="flex items-start justify-between gap-2">
                        <span className="font-semibold">{area.name}</span>
                        <RoomArt room={area.art} animate delay={0.1 + index * 0.12} className="size-11 shrink-0" />
                      </span>
                      <span className="type-display mt-auto text-2xl break-words">{tile.status}</span>
                      {tile.detail ? <span className="text-sm font-semibold break-words">{tile.detail}</span> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        <div className="flex flex-col gap-8">
          {owe.length > 0 || owed.length > 0 ? (
            <section aria-labelledby="money-heading" className="flex flex-col gap-3 rounded-3xl bg-heather/30 p-5" data-testid="money">
              <h2 id="money-heading" className="type-display text-3xl">
                Money
              </h2>
              {owe.length > 0 ? (
                <div className="flex flex-col gap-1">
                  <h3 className="font-semibold text-ink-soft">You owe</h3>
                  <ul className="flex flex-col">
                    {owe.map((transfer) => (
                      <li key={transfer.to} className="flex items-center justify-between gap-3 py-1">
                        <Person person={people.get(transfer.to)} size="size-8" className="text-lg font-semibold" />
                        <span className="type-display text-2xl">{money(transfer.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {owed.length > 0 ? (
                <div className="flex flex-col gap-1">
                  <h3 className="font-semibold text-ink-soft">Owes you</h3>
                  <ul className="flex flex-col">
                    {owed.map((transfer) => (
                      <li key={transfer.from} className="flex items-center justify-between gap-3 py-1">
                        <Person person={people.get(transfer.from)} size="size-8" className="text-lg font-semibold" />
                        <span className="type-display text-2xl">{money(transfer.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <Link href="/expenses" className={more}>
                {owe.length > 0 ? "Pay up, or see what it was for" : "See what it was for"}
              </Link>
            </section>
          ) : null}

          <section aria-labelledby="week-heading" className="flex flex-col gap-1" data-testid="week">
            <h2 id="week-heading" className="type-display text-3xl">
              This week
            </h2>
            {week.length > 0 ? (
              <ul className="flex flex-col">
                {week.slice(0, 8).map((item) => (
                  <AgendaItem key={item.key} item={item} people={people} day={dayLabel(item.day)} answers={false} />
                ))}
              </ul>
            ) : (
              <p className="text-ink-soft">Nothing booked or planned for the next seven days.</p>
            )}
            <Link href="/calendar" className={more}>
              Open the calendar
            </Link>
          </section>

          {on("board") ? (
            <section aria-labelledby="board-heading" className="flex flex-col gap-3" data-testid="board-preview">
              <h2 id="board-heading" className="type-display text-3xl">
                On the board
              </h2>
              {openNotes.length > 0 ? (
                <ul className="grid grid-cols-2 gap-3 rounded-2xl border-4 border-ink bg-white p-3">
                  {openNotes.slice(0, 4).map((note, index) => (
                    <Sticky
                      key={note.id}
                      small
                      index={index}
                      author={people.get(note.authorId)}
                      line={note.isTask ? (note.assigneeId ? `For ${note.assigneeId === user.id ? "you" : nameOf(note.assigneeId)}` : "For anyone") : undefined}
                      note={{ id: note.id, body: note.body, isTask: note.isTask, done: false }}
                    />
                  ))}
                </ul>
              ) : (
                <p className="text-ink-soft">Nothing up. Notes for everyone go on the board.</p>
              )}
              <Link href="/board" className={more}>
                {openNotes.length > 4 ? `See all ${openNotes.length} notes, or write one` : "Write a note"}
              </Link>
            </section>
          ) : null}
        </div>
      </div>
    </main>
  );
}
