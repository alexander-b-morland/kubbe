import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/avatar/avatar";
import type { PersonLike } from "@/components/avatar/person";
import { TabHeader } from "@/components/area/area-header";
import { AgendaItem } from "@/components/calendar/agenda";
import { areaOf, areasFor } from "@/lib/areas";
import { clockLabel } from "@/lib/booking/status";
import { isMonth, monthOf, monthSheet, pickDay, shiftMonth, type CalendarItem } from "@/lib/calendar";
import { loadCalendar } from "@/lib/calendar-service";
import { hasExtra } from "@/lib/extras";
import { listMembers } from "@/lib/households";
import { INTL_LOCALE, type Translate } from "@/lib/i18n";
import { getT } from "@/lib/i18n/server";
import { requireHousehold } from "@/lib/session";
import { addDays, dayInZone, describeDay, isDay } from "@/lib/time";

// This screen depends on who is signed in, so it is rendered per request.
export const instant = false;

export const metadata: Metadata = { title: "Calendar" };

const ring = "outline-none focus-visible:ring-4 focus-visible:ring-fjord";
const pill = `flex min-h-11 items-center gap-1.5 rounded-full border-2 border-ink px-4 font-bold ${ring}`;

type View = "month" | "week" | "day";
const VIEWS: readonly View[] = ["month", "week", "day"];
const isView = (value: unknown): value is View => VIEWS.includes(value as View);

/** The Monday of the week a day is in. */
const mondayOf = (day: string) => addDays(day, 1 - (new Date(`${day}T12:00:00Z`).getUTCDay() || 7));

/** At most this many things are written in a day's square; the rest are counted. */
const SHOWN_IN_SQUARE = 3;

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const t = await getT();
  const { user, household } = await requireHousehold();
  const params = await searchParams;
  const today = dayInZone(new Date(), household.timeZone);
  const view: View = isView(params.view) ? params.view : "month";
  // The day everything is about. An older link may name only a month.
  const day = isMonth(params.month) ? pickDay(params.month, params.day, today) : isDay(params.day) ? params.day : today;
  const month = monthOf(day);
  const sheet = monthSheet(month);
  const monday = mondayOf(day);
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(monday, index));
  const [fromDay, toDay] = view === "month" ? [sheet[0][0], sheet[sheet.length - 1][6]] : view === "week" ? [weekDays[0], weekDays[6]] : [day, day];

  // The reader first, then everyone in the order they moved in: the row never reshuffles.
  const everyone = await listMembers(household.id);
  const members = [...everyone.filter((member) => member.userId === user.id), ...everyone.filter((member) => member.userId !== user.id)];
  const people = new Map<string, PersonLike>(members.map((member) => [member.userId, member]));
  // Show one person's calendar, or everyone's. Only someone who lives here can be picked.
  const who = typeof params.who === "string" && people.has(params.who) ? params.who : null;
  const all = await loadCalendar({ household, me: user.id, nameOf: (userId) => people.get(userId)?.name ?? t("Someone"), fromDay, toDay, today, t });
  const items = who ? all.filter((item) => item.people.includes(who)) : all;
  const onDay = (date: string) => items.filter((item) => item.day === date);

  const href = (next: { day?: string; view?: View; who?: string | null; jump?: boolean }) => {
    const query = new URLSearchParams();
    const v = next.view ?? view;
    if (v !== "month") query.set("view", v);
    const d = next.day ?? day;
    if (d !== today) query.set("day", d);
    const w = next.who === undefined ? who : next.who;
    if (w) query.set("who", w);
    const text = query.toString();
    // Picking a day in the month lands on that day's list, which on a phone is below the month.
    return `${text ? `/calendar?${text}` : "/calendar"}${next.jump ? "#day" : ""}`;
  };

  const label = describeDay(day, t);
  const monthName = new Intl.DateTimeFormat(INTL_LOCALE[t.locale], { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-15T12:00:00Z`));
  const first = describeDay(weekDays[0], t);
  const last = describeDay(weekDays[6], t);
  // Norwegian writes months in lower case; a headline still starts with a capital.
  const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
  const title = capital(
    view === "month"
      ? monthName
      : view === "week"
        ? `${first.dayOfMonth} ${first.monthShort} – ${last.dayOfMonth} ${last.monthShort}`
        : day === today
          ? t("Today")
          : `${label.weekday} ${label.dayOfMonth} ${label.monthShort}`,
  );
  const step = {
    month: { back: t("Previous month"), on: t("Next month"), before: pickDay(shiftMonth(month, -1), null, today), after: pickDay(shiftMonth(month, 1), null, today) },
    week: { back: t("Previous week"), on: t("Next week"), before: addDays(day, -7), after: addDays(day, 7) },
    day: { back: t("Previous day"), on: t("Next day"), before: addDays(day, -1), after: addDays(day, 1) },
  }[view];
  const showsToday = view === "month" ? month === monthOf(today) && day === today : view === "week" ? weekDays.includes(today) && day === today : day === today;

  const quick = [
    { show: hasExtra(household, "shower"), href: `/shower?day=${day}`, label: t("Book the shower"), area: "shower" as const },
    { show: hasExtra(household, "laundry"), href: `/laundry?day=${day}`, label: t("Book laundry"), area: "laundry" as const },
    { show: hasExtra(household, "dinner"), href: `/dinner?day=${day}`, label: t("Plan a dinner"), area: "dinner" as const },
    { show: hasExtra(household, "happenings"), href: `/happenings?day=${day}`, label: t("Suggest something"), area: "happenings" as const },
  ].filter((link) => link.show && day >= today);

  const nothing =
    who === user.id ? t("Nothing on for you this day.") : who ? t`Nothing on for ${people.get(who)?.name ?? t("Someone")} this day.` : t("Nothing on this day.");

  const dayPanel = (
    <section id="day" data-quiet-target aria-labelledby="day-heading" className="flex scroll-mt-4 flex-col gap-2" data-testid="day">
      {view === "month" ? (
        <h2 id="day-heading" className="type-display text-4xl">
          {day === today ? t("Today") : `${label.weekday} ${label.dayOfMonth} ${label.monthShort}`}
        </h2>
      ) : (
        <h2 id="day-heading" className="sr-only">
          {title}
        </h2>
      )}
      {onDay(day).length > 0 ? (
        <ul className="flex flex-col">
          {onDay(day).map((item) => (
            <AgendaItem key={item.key} item={item} people={people} />
          ))}
        </ul>
      ) : (
        <p className="text-ink-soft">{nothing}</p>
      )}
      {quick.length > 0 ? (
        <ul className="flex flex-wrap gap-2 pt-2">
          {quick.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className={`flex min-h-11 items-center rounded-full px-4 text-sm font-bold ${areaOf(link.area).band} ${ring}`}>
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );

  return (
    <main className="mx-auto flex w-full max-w-md flex-col lg:max-w-6xl lg:pt-6">
      <TabHeader art="calendar" name={t("Calendar")} eyebrow={household.name}>
        {title}
      </TabHeader>

      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav aria-label={t("Move through the calendar")} className="flex flex-wrap items-center gap-2" data-testid="steps">
            <Link href={href({ day: step.before })} className={pill}>
              <Arrow back />
              {step.back}
            </Link>
            <Link href={href({ day: step.after })} className={pill}>
              {step.on}
              <Arrow />
            </Link>
            {showsToday ? null : (
              <Link href={href({ day: today })} className={`flex min-h-11 items-center rounded-full bg-ink px-4 font-bold text-paper ${ring}`}>
                {t("Today")}
              </Link>
            )}
          </nav>
          <nav aria-label={t("View")} className="flex rounded-full border-2 border-ink p-1" data-testid="views">
            {VIEWS.map((option) => (
              <Link
                key={option}
                href={href({ view: option })}
                aria-current={option === view ? "page" : undefined}
                className={`flex min-h-9 items-center rounded-full px-4 text-sm font-bold ${ring} ${option === view ? "bg-ink text-paper" : ""}`}
              >
                {option === "month" ? t("Month") : option === "week" ? t("Week") : t("Day")}
              </Link>
            ))}
          </nav>
        </div>

        <nav aria-label={t("Whose calendar")} className="flex flex-wrap items-center gap-2" data-testid="who">
          <Link
            href={href({ who: null })}
            aria-current={who ? undefined : "true"}
            className={`flex min-h-11 items-center rounded-full border-2 border-ink px-4 font-bold ${who ? "" : "bg-ink text-paper"} ${ring}`}
          >
            {t("Everyone")}
          </Link>
          {members.map((member) => (
            <Link
              key={member.userId}
              href={href({ who: member.userId })}
              aria-current={who === member.userId ? "true" : undefined}
              className={`flex min-h-11 items-center gap-2 rounded-full border-2 border-ink py-1 pr-4 pl-1 font-bold ${who === member.userId ? "bg-ink text-paper" : ""} ${ring}`}
            >
              <Avatar avatar={member.avatar} colour={member.colour} className="size-8" />
              {member.userId === user.id ? t("You") : member.name}
            </Link>
          ))}
        </nav>

        {view === "month" ? (
          <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[2fr_1fr] lg:items-start">
            <section aria-label={title}>
              <ol aria-hidden="true" className="grid grid-cols-7 pb-1 text-center text-sm font-semibold text-ink-soft">
                {sheet[0].map((date) => describeDay(date, t).weekdayShort).map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ol>
              <ol className="grid grid-cols-7 gap-1" data-testid="sheet">
                {sheet.flat().map((date) => (
                  <MonthSquare
                    key={date}
                    date={date}
                    // What comes round every day is on the day's list, not on the sheet.
                    held={onDay(date).filter((item) => !item.routine)}
                    selected={date === day}
                    today={today}
                    outside={monthOf(date) !== month}
                    people={people}
                    href={href({ day: date, jump: true })}
                    t={t}
                  />
                ))}
              </ol>
              <ul className="flex flex-wrap gap-x-4 gap-y-1 pt-3 text-sm" aria-label={t("What the colours mean")}>
                {areasFor(household)
                  .filter((area) => ["shower", "laundry", "cleaning", "dinner", "happenings"].includes(area.key))
                  .map((area) => (
                    <li key={area.key} className="flex items-center gap-1.5">
                      <span className={`size-2.5 rounded-full ${area.dot}`} /> {t(area.name)}
                    </li>
                  ))}
              </ul>
            </section>
            {dayPanel}
          </div>
        ) : view === "week" ? (
          <ol className="grid grid-cols-1 gap-3 lg:grid-cols-7 lg:gap-2" data-testid="week-view" aria-label={title}>
            {weekDays.map((date) => {
              const parts = describeDay(date, t);
              const held = onDay(date);
              return (
                <li key={date} data-day={date} className={`flex min-w-0 flex-col gap-2 rounded-xl border-2 p-2 lg:min-h-80 ${date === today ? "border-barn" : "border-ink/15"}`}>
                  <Link href={href({ day: date, view: "day" })} className={`flex items-baseline gap-2 rounded px-1 ${ring}`} aria-label={`${parts.weekday} ${parts.dayOfMonth} ${parts.monthShort}`}>
                    <span className="text-sm font-semibold text-ink-soft">{parts.weekdayShort}</span>
                    <span className={`type-display text-2xl ${date === today ? "rounded-full bg-barn px-2 text-paper" : ""}`}>{Number(date.slice(8))}</span>
                  </Link>
                  {held.length > 0 ? (
                    <ul className="flex flex-col gap-1.5">
                      {held.map((item) => (
                        <WeekItem key={item.key} item={item} people={people} t={t} />
                      ))}
                    </ul>
                  ) : (
                    <p className="px-1 text-sm text-ink-soft lg:sr-only">{t("Nothing on.")}</p>
                  )}
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="lg:max-w-3xl">{dayPanel}</div>
        )}
      </div>
    </main>
  );
}

function Arrow({ back = false }: { back?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`size-5 shrink-0 ${back ? "" : "rotate-180"}`}>
      <path d="M20 12C15 11.5 9 11.5 4 12M10 6C8 8 6 10 4 12C6 14 8 16 10 18" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * One day on the month's sheet. Every square is the same height: a few things are
 * written in it, one line each, and the rest are counted.
 */
function MonthSquare({
  date,
  held,
  selected,
  today,
  outside,
  people,
  href,
  t,
}: {
  date: string;
  held: CalendarItem[];
  selected: boolean;
  today: string;
  outside: boolean;
  people: Map<string, PersonLike>;
  href: string;
  t: Translate;
}) {
  const label = describeDay(date, t);
  const areas = [...new Set(held.map((item) => item.area))];
  // Three fit; with more, two are written and the rest counted, so the square never grows.
  const shown = held.length <= SHOWN_IN_SQUARE ? held : held.slice(0, SHOWN_IN_SQUARE - 1);
  const more = held.length - shown.length;
  const spoken = held.length === 0 ? t("nothing on") : `${held.slice(0, 3).map((item) => item.title).join(", ")}${held.length > 3 ? `, ${t`and ${held.length - 3} more`}` : ""}`;
  return (
    <li>
      <Link
        href={href}
        aria-current={selected ? "date" : undefined}
        aria-label={`${date === today ? `${t("Today")}, ` : ""}${label.weekday} ${label.dayOfMonth} ${label.monthShort}: ${spoken}`}
        data-day={date}
        // The grey days belong to the months beside this one: reachable by tapping, skipped by the Tab key.
        tabIndex={outside ? -1 : undefined}
        className={`flex h-16 flex-col gap-1 overflow-hidden rounded-xl border-2 p-1.5 lg:h-32 ${ring} ${
          selected ? "border-ink bg-ink text-paper" : date === today ? "border-barn" : "border-ink/15"
        } ${outside && !selected ? "opacity-45" : ""}`}
      >
        {/* Today keeps its red mark when it is also the day picked. */}
        <span className={`type-display w-fit shrink-0 text-xl ${date === today ? "rounded-full bg-barn px-2 text-paper" : ""}`}>{Number(date.slice(8))}</span>
        <span className="flex flex-wrap gap-1 lg:hidden">
          {areas.slice(0, 3).map((area) => (
            <span key={area} className={`size-2.5 rounded-full ${areaOf(area).dot} ${selected ? "ring-1 ring-paper" : ""}`} />
          ))}
        </span>
        <span className="hidden min-w-0 flex-col gap-0.5 lg:flex">
          {shown.map((item) => {
            // One person's booking or turn carries their face; a dinner is everyone's.
            const owner = item.people.length === 1 ? people.get(item.people[0]) : undefined;
            return (
              <span key={item.key} className={`flex h-5 min-w-0 items-center gap-1 rounded px-1 ${areaOf(item.area).band}`}>
                {owner ? <Avatar avatar={owner.avatar} colour={owner.colour} className="size-3.5 shrink-0" /> : null}
                <span className="type-display min-w-0 truncate text-[13px] leading-none">{item.title}</span>
              </span>
            );
          })}
          {more > 0 ? <span className="truncate text-xs font-semibold">{t`and ${more} more`}</span> : null}
        </span>
      </Link>
    </li>
  );
}

/** One thing in a week's column: its colour, when, what, and whose face. */
function WeekItem({ item, people, t }: { item: CalendarItem; people: Map<string, PersonLike>; t: Translate }) {
  const faces = item.people.map((id) => people.get(id)).filter((person) => person !== undefined);
  return (
    <li>
      <Link href={item.href} className={`flex flex-col gap-0.5 rounded-lg px-2 py-1.5 ${areaOf(item.area).band} ${ring}`} data-testid="week-item">
        <span className="text-xs font-semibold">{item.time === null ? t("By the end of the day") : clockLabel(item.time)}</span>
        <span className={`text-sm font-bold break-words ${item.done ? "line-through" : ""}`}>{item.title}</span>
        {faces.length > 0 ? (
          <span className="flex flex-wrap gap-0.5 pt-0.5">
            {faces.slice(0, 5).map((person) => (
              <Avatar key={person.userId} avatar={person.avatar} colour={person.colour} className="size-5" />
            ))}
          </span>
        ) : null}
      </Link>
    </li>
  );
}
