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
import { addDays, dayInZone, daysBetween, describeDay, minutesInZone, shortDate } from "@/lib/time";
import { ShareCode } from "./share-code";
import { getT } from "@/lib/i18n/server";

// This screen depends on who is signed in, so it is rendered per request.
export const instant = false;

export const metadata: Metadata = { title: "Home" };

const ring = "outline-none focus-visible:ring-4 focus-visible:ring-fjord";
const more = `flex min-h-11 w-fit items-center rounded font-bold underline underline-offset-4 ${ring}`;

type Tile = { status: string; detail?: string };

export default async function HomePage() {
  const t = await getT();
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
    on("dinner") ? listUpcomingDinners(household.id, today, minutesInZone(now, timeZone)) : [],
    on("shopping") || on("dinner") ? listToBuy(household.id) : [],
    on("expenses") ? listExpenses(household.id) : [],
  ]);
  const people = new Map<string, PersonLike>(members.map((member) => [member.userId, member]));
  const me = people.get(user.id);
  const nameOf = (userId: string) => people.get(userId)?.name ?? t("Someone who moved out");
  const money = (amount: number) => formatAmount(amount, household.currency);

  // With several showers or machines, the tile speaks for all of them.
  const showers = resources.filter((resource) => resource.kind === "shower" && resource.enabled);
  const washers = resources.filter((resource) => resource.kind === "washer" && resource.enabled);
  const machines = washers.length > 0 ? washers : resources.filter((resource) => resource.kind === "dryer" && resource.enabled);
  const nowLines = async (group: typeof resources) =>
    Promise.all(
      group.map(async (rules) =>
        describeNow({ rules, bookings: await listDayBookings(rules.id, household.id, today, timeZone), now, timeZone, userId: user.id, t }),
      ),
    );
  const [showerLines, machineLines] = await Promise.all([nowLines(showers), nowLines(machines)]);

  const nextOf = (kinds: string[]) => {
    const next = upcoming.find((booking) => kinds.includes(booking.kind));
    if (!next) return undefined;
    const what = next.kind === "dryer" ? t("Your dryer slot") : next.kind === "washer" ? t("Your wash") : t("Your slot");
    return next.startsAt <= now ? t`${what} is now` : `${what}: ${describeWhen(next.startsAt, now, timeZone, t)}`;
  };

  // ---- what each area's tile says
  // A rota whose first turn has not begun is nobody's to do yet.
  const running = rota.filter((row) => !row.startsOn);
  const myTurns = running.filter((row) => row.assignee?.userId === user.id && !row.done);
  const firstStart = rota.map((row) => row.startsOn).filter((day) => day !== null).sort()[0];
  const cleaning: Tile =
    rota.length === 0
      ? { status: t("No turns yet"), detail: membership.role === "admin" ? t("Add the rooms and chores you share") : t("An admin hasn't added any yet") }
      : running.length === 0 && firstStart
        ? { status: t("Not started yet"), detail: t`First turn ${daysBetween(today, firstStart) === 1 ? t("tomorrow") : shortDate(firstStart, t)}` }
      : myTurns.length === 1
        ? { status: t`Your turn: ${myTurns[0].name}`, detail: describeDue(today, myTurns[0].lastDay, t) }
        : myTurns.length > 1
          ? { status: t`${myTurns.length} turns are yours`, detail: myTurns.map((turn) => turn.name).join(", ") }
          : running.every((row) => row.done)
            ? { status: t("All clean") }
            : { status: t("Nothing for you now") };

  const nextDinner = dinners.find((dinner) => !dinner.cancelled);
  // What you said no to is not what is next for you.
  const nextHappening = happenings.find((happening) => !happening.notGoing.includes(user.id));
  const net = balances(expenses);
  const balance = net.get(user.id) ?? 0;
  const { owe, owed } = mySettlements(settleUp(net), user.id);
  const openNotes = notes.filter((note) => !note.doneAt);
  const openTasks = openNotes.filter((note) => note.isTask).length;
  const myTasks = openNotes.filter((note) => note.isTask && note.assigneeId === user.id);

  const tiles: Record<AreaKey, Tile> = {
    shower: { status: describeNowAcross(showerLines, t), detail: showers.length > 0 ? nextOf(["shower"]) : undefined },
    laundry: { status: describeNowAcross(machineLines, t), detail: machines.length > 0 ? nextOf(["washer", "dryer"]) : undefined },
    cleaning,
    dinner: nextDinner
      ? {
          status: nextDinner.chosenTitle ?? `${describeDinnerDay(nextDinner.day, today, t)} ${clockLabel(nextDinner.time)}`,
          detail: nextDinner.chosenTitle
            ? t`${describeDinnerDay(nextDinner.day, today, t)} at ${clockLabel(nextDinner.time)}`
            : nextDinner.ideas === 0
              ? t("Nothing suggested yet")
              : nextDinner.ideas === 1
                ? t("1 idea, not decided")
                : t`${nextDinner.ideas} ideas, not decided`,
        }
      : { status: t("Nothing planned"), detail: t("Plan a dinner") },
    shopping: { status: toBuy.length === 0 ? t("Nothing to buy") : t`${toBuy.length} to buy`, detail: toBuy.length > 0 ? toBuy.slice(0, 3).map((item) => item.name).join(", ") : undefined },
    expenses: { status: balance > 0 ? t`You're owed ${money(balance)}` : balance < 0 ? t`You owe ${money(balance)}` : t("All square") },
    happenings: nextHappening
      ? { status: nextHappening.title, detail: describeWhen(nextHappening.startsAt, now, timeZone, t) }
      : { status: t("Nothing planned"), detail: t("Suggest something") },
    board: {
      status: openNotes.length === 0 ? t("Empty") : myTasks.length > 0 ? t`${myTasks.length} for you` : openTasks > 0 ? t`${openTasks} to do` : openNotes.length === 1 ? t("1 note") : t`${openNotes.length} notes`,
      detail: openNotes.length > 0 && (myTasks.length > 0 || openTasks > 0) ? (openNotes.length === 1 ? t("1 note up") : t`${openNotes.length} notes up`) : undefined,
    },
  };

  // ---- what is yours to do
  const toDos = buildToDos({
    me: user.id,
    today,
    nowMinutes: minutesInZone(now, timeZone),
    owe: on("expenses") ? owe.map((transfer) => ({ to: transfer.to, name: nameOf(transfer.to), amount: money(transfer.amount) })) : [],
    turns: myTurns.map((turn) => ({ id: turn.areaId, name: turn.name, lastDay: turn.lastDay })),
    dinners,
    buying: toBuy.filter((item) => item.claimedBy === user.id).map((item) => item.name),
    buyingHref: on("shopping") ? "/shopping" : "/dinner",
    tasks: myTasks.map((note) => ({ id: note.id, body: note.body })),
    unanswered: happenings
      .filter((happening) => !happening.going.includes(user.id) && !happening.notGoing.includes(user.id))
      .map((happening) => ({
        id: happening.id,
        title: happening.title,
        when: describeWhen(happening.startsAt, now, timeZone, t),
        day: dayInZone(happening.startsAt, timeZone),
      })),
  }, t);

  // ---- the week ahead, from what is already loaded
  const weekEnd = addDays(today, 6);
  const kindName = (kind: string) => resources.find((resource) => resource.kind === kind)?.name ?? (kind === "shower" ? t("Shower") : t("Laundry"));
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
  }, t).filter((item) => item.day >= today && item.day <= weekEnd);
  const dayLabel = (day: string) => (day === today ? t("Today") : day === addDays(today, 1) ? t("Tomorrow") : describeDay(day, t).weekday);

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-8 p-6 pt-10 lg:max-w-6xl">
      <AutoRefresh everySeconds={60} />
      <header className="flex items-center gap-4">
        <Link href="/profile" aria-label={t("Your profile")} className={`rounded-full ${ring}`}>
          <Avatar avatar={me?.avatar} colour={me?.colour ?? membership.colour} className="size-16" />
        </Link>
        <div className="flex min-w-0 flex-col gap-1">
          <p className="font-semibold text-ink-soft break-words">{household.name}</p>
          <h1 className="type-display text-5xl break-words">{t`Hi ${user.name}`}</h1>
        </div>
      </header>

      {members.length === 1 ? (
        <section aria-labelledby="code-heading" className="flex flex-col gap-3 rounded-2xl border-2 border-ink p-5">
          <h2 id="code-heading" className="type-display text-2xl">
            {t("Invite your roommates")}
          </h2>
          <p className="text-ink-soft">
            {t("Send them the link, or the code")}{" "}
            <span className="type-display text-2xl tracking-widest whitespace-nowrap text-ink" data-testid="join-code">
              {formatJoinCode(household.joinCode)}
            </span>
          </p>
          <ShareCode code={household.joinCode} />
        </section>
      ) : null}

      {/* On a phone the order is what needs you first: to-do, money, the week, then the flat and the board. */}
      <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[1.7fr_1fr] lg:items-start lg:gap-10">
        <div className="contents lg:flex lg:flex-col lg:gap-8">
          {members.length > 1 || toDos.length > 0 ? (
            <section aria-labelledby="todo-heading" className="order-1 flex flex-col gap-1 lg:order-none" data-testid="todo">
              <h2 id="todo-heading" className="type-display text-3xl">
                {toDos.length === 0 ? t("Nothing waiting on you") : t("Yours to do")}
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
                  {t("No turns, to-dos, invitations or shopping with your name on.")}
                </p>
              )}
            </section>
          ) : null}

          <section aria-labelledby="areas-heading" className="order-4 flex flex-col gap-3 lg:order-none">
            <h2 id="areas-heading" className="type-display text-3xl">
              {t("The flat right now")}
            </h2>
            <ul className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:grid-cols-3">
              {areasFor(household).map((area, index) => {
                const tile = tiles[area.key];
                return (
                  <li key={area.key} className="min-w-0">
                    <Link
                      href={area.href}
                      data-testid={`band-${area.key}`}
                      className={`flex h-full flex-col gap-2 rounded-2xl p-4 min-[360px]:min-h-40 outline-none transition-transform focus-visible:ring-4 active:scale-[0.98] ${area.band} ${area.ring}`}
                    >
                      <span className="flex items-start justify-between gap-2">
                        <span className="font-semibold">{t(area.name)}</span>
                        <RoomArt room={area.art} animate delay={0.1 + index * 0.12} className="size-11 shrink-0" />
                      </span>
                      <span className="type-display mt-1 text-2xl break-words">{tile.status}</span>
                      {tile.detail ? <span className="text-sm font-semibold break-words">{tile.detail}</span> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        <div className="contents lg:flex lg:flex-col lg:gap-8">
          {owe.length > 0 || owed.length > 0 ? (
            <section aria-labelledby="money-heading" className="order-2 flex flex-col gap-3 rounded-3xl bg-heather/30 p-5 lg:order-none" data-testid="money">
              <h2 id="money-heading" className="type-display text-3xl">
                {t("Money")}
              </h2>
              {owe.length > 0 ? (
                <div className="flex flex-col gap-1">
                  <h3 className="font-semibold text-ink-soft">{t("You owe")}</h3>
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
                  <h3 className="font-semibold text-ink-soft">{t("Owes you")}</h3>
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
                {owe.length > 0 ? t("Pay up, or see what it was for") : t("See what it was for")}
              </Link>
            </section>
          ) : null}

          <section aria-labelledby="week-heading" className="order-3 flex flex-col gap-1 lg:order-none" data-testid="week">
            <h2 id="week-heading" className="type-display text-3xl">
              {t("This week")}
            </h2>
            {week.length > 0 ? (
              <ul className="flex flex-col">
                {week.slice(0, 8).map((item) => (
                  <AgendaItem key={item.key} item={item} people={people} day={dayLabel(item.day)} answers={false} />
                ))}
              </ul>
            ) : (
              <p className="text-ink-soft">{t("Nothing booked or planned for the next seven days.")}</p>
            )}
            <Link href="/calendar" className={more}>
              {t("Open the calendar")}
            </Link>
          </section>

          {on("board") ? (
            <section aria-labelledby="board-heading" className="order-5 flex flex-col gap-3 lg:order-none" data-testid="board-preview">
              <h2 id="board-heading" className="type-display text-3xl">
                {t("On the board")}
              </h2>
              {openNotes.length > 0 ? (
                <ul className="grid grid-cols-2 items-start gap-3 rounded-2xl border-4 border-ink bg-white p-3">
                  {openNotes.slice(0, 4).map((note, index) => (
                    <Sticky
                      key={note.id}
                      small
                      index={index}
                      author={people.get(note.authorId)}
                      line={note.isTask ? (note.assigneeId ? (note.assigneeId === user.id ? t("For you") : t`For ${nameOf(note.assigneeId)}`) : t("For anyone")) : undefined}
                      note={{ id: note.id, body: note.body, isTask: note.isTask, done: false }}
                    />
                  ))}
                </ul>
              ) : (
                <p className="text-ink-soft">{t("Nothing up. Notes for everyone go on the board.")}</p>
              )}
              <Link href="/board" className={more}>
                {openNotes.length > 4 ? t`See all ${openNotes.length} notes, or write one` : t("Write a note")}
              </Link>
            </section>
          ) : null}
        </div>
      </div>
    </main>
  );
}
