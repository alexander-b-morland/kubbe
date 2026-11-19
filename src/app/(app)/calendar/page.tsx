import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/avatar/avatar";
import type { PersonLike } from "@/components/avatar/person";
import { TabHeader } from "@/components/area/area-header";
import { AgendaItem } from "@/components/calendar/agenda";
import { areaOf, areasFor } from "@/lib/areas";
import { isMonth, monthOf, monthSheet, pickDay, shiftMonth } from "@/lib/calendar";
import { loadCalendar } from "@/lib/calendar-service";
import { hasExtra } from "@/lib/extras";
import { listMembers } from "@/lib/households";
import { requireHousehold } from "@/lib/session";
import { dayInZone, describeDay } from "@/lib/time";

// This screen depends on who is signed in, so it is rendered per request.
export const instant = false;

export const metadata: Metadata = { title: "Calendar" };

const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const ring = "outline-none focus-visible:ring-4 focus-visible:ring-fjord";

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const { user, household } = await requireHousehold();
  const params = await searchParams;
  const today = dayInZone(new Date(), household.timeZone);
  const month = isMonth(params.month) ? params.month : monthOf(today);
  const day = pickDay(month, params.day, today);
  const sheet = monthSheet(month);

  // The reader first, then everyone in the order they moved in: the row never reshuffles.
  const everyone = await listMembers(household.id);
  const members = [...everyone.filter((member) => member.userId === user.id), ...everyone.filter((member) => member.userId !== user.id)];
  const people = new Map<string, PersonLike>(members.map((member) => [member.userId, member]));
  // Show one person's month, or everyone's. Only someone who lives here can be picked.
  const who = typeof params.who === "string" && people.has(params.who) ? params.who : null;
  const all = await loadCalendar({
    household,
    me: user.id,
    nameOf: (userId) => people.get(userId)?.name ?? "Someone",
    fromDay: sheet[0][0],
    toDay: sheet[sheet.length - 1][6],
    today,
  });
  const items = who ? all.filter((item) => item.people.includes(who)) : all;
  const onDay = (date: string) => items.filter((item) => item.day === date);
  const chosen = onDay(day);

  const href = (next: { month?: string; day?: string; who?: string | null }) => {
    const query = new URLSearchParams();
    const m = next.month ?? month;
    if (m !== monthOf(today)) query.set("month", m);
    const d = next.day ?? (next.month ? undefined : day);
    if (d && d !== today) query.set("day", d);
    const w = next.who === undefined ? who : next.who;
    if (w) query.set("who", w);
    const text = query.toString();
    // Picking a day lands on that day's list, which on a phone is below the whole month.
    return `${text ? `/calendar?${text}` : "/calendar"}${next.day ? "#day" : ""}`;
  };
  const title = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-15T12:00:00Z`));
  const chosenDay = describeDay(day);
  const quick = [
    { show: true, href: `/shower?day=${day}`, label: "Book the shower", area: "shower" as const },
    { show: true, href: `/laundry?day=${day}`, label: "Book laundry", area: "laundry" as const },
    { show: hasExtra(household, "dinner"), href: `/dinner?day=${day}`, label: "Plan a dinner", area: "dinner" as const },
    { show: hasExtra(household, "happenings"), href: `/happenings?day=${day}`, label: "Suggest something", area: "happenings" as const },
  ].filter((link) => link.show && day >= today);

  return (
    <main className="mx-auto flex w-full max-w-md flex-col lg:max-w-6xl lg:pt-6">
      <TabHeader art="calendar" name="Calendar" eyebrow={household.name}>
        {title}
      </TabHeader>

      <div className="flex flex-col gap-6 p-6">
      <nav aria-label="Month" className="flex flex-wrap items-center gap-2">
        <Link href={href({ month: shiftMonth(month, -1) })} className={`flex min-h-11 items-center rounded-full border-2 border-ink px-4 font-bold ${ring}`}>
          Earlier
        </Link>
        <Link href={href({ month: shiftMonth(month, 1) })} className={`flex min-h-11 items-center rounded-full border-2 border-ink px-4 font-bold ${ring}`}>
          Later
        </Link>
        {month !== monthOf(today) || day !== today ? (
          <Link href={who ? `/calendar?who=${who}` : "/calendar"} className={`flex min-h-11 items-center rounded-full bg-ink px-4 font-bold text-paper ${ring}`}>
            Today
          </Link>
        ) : null}
      </nav>

      <nav aria-label="Whose calendar" className="flex flex-wrap items-center gap-2" data-testid="who">
        <Link
          href={href({ who: null })}
          aria-current={who ? undefined : "true"}
          className={`flex min-h-11 items-center rounded-full border-2 border-ink px-4 font-bold ${who ? "" : "bg-ink text-paper"} ${ring}`}
        >
          Everyone
        </Link>
        {members.map((member) => (
          <Link
            key={member.userId}
            href={href({ who: member.userId })}
            aria-current={who === member.userId ? "true" : undefined}
            className={`flex min-h-11 items-center gap-2 rounded-full border-2 border-ink py-1 pr-4 pl-1 font-bold ${who === member.userId ? "bg-ink text-paper" : ""} ${ring}`}
          >
            <Avatar avatar={member.avatar} colour={member.colour} className="size-8" />
            {member.userId === user.id ? "You" : member.name}
          </Link>
        ))}
      </nav>

      <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[2fr_1fr] lg:items-start">
        <section aria-label={title}>
          <ol aria-hidden="true" className="grid grid-cols-7 pb-1 text-center text-sm font-semibold text-ink-soft">
            {weekdays.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ol>
          <ol className="grid grid-cols-7 gap-1" data-testid="sheet">
            {sheet.flat().map((date) => {
              // What comes round every day is on the day's list, not on the sheet.
              const held = onDay(date).filter((item) => !item.routine);
              const areas = [...new Set(held.map((item) => item.area))];
              const selected = date === day;
              const outside = monthOf(date) !== month;
              const label = describeDay(date);
              const names = held.slice(0, 3).map((item) => item.title).join(", ");
              const spoken = held.length === 0 ? "nothing on" : `${names}${held.length > 3 ? `, and ${held.length - 3} more` : ""}`;
              return (
                <li key={date}>
                  <Link
                    href={href({ month: monthOf(date), day: date })}
                    aria-current={selected ? "date" : undefined}
                    aria-label={`${date === today ? "Today, " : ""}${label.weekday} ${label.dayOfMonth} ${label.monthShort}: ${spoken}`}
                    data-day={date}
                    // The grey days belong to the months beside this one: reachable by tapping, skipped by the Tab key.
                    tabIndex={outside ? -1 : undefined}
                    className={`flex min-h-14 flex-col gap-1 rounded-xl border-2 p-1.5 lg:min-h-28 ${ring} ${
                      selected ? "border-ink bg-ink text-paper" : date === today ? "border-barn" : "border-ink/15"
                    } ${outside && !selected ? "opacity-45" : ""}`}
                  >
                    {/* Today keeps its red mark when it is also the day picked. */}
                    <span className={`type-display w-fit text-xl ${date === today ? "rounded-full bg-barn px-2 text-paper" : ""}`}>{label.dayOfMonth}</span>
                    <span className="flex flex-wrap gap-1 lg:hidden">
                      {areas.slice(0, 4).map((area) => (
                        <span key={area} className={`size-2.5 rounded-full ${areaOf(area).dot} ${selected ? "ring-1 ring-paper" : ""}`} />
                      ))}
                    </span>
                    <span className="hidden flex-col gap-0.5 lg:flex">
                      {held.slice(0, 3).map((item) => {
                        // One person's booking or turn carries their face; a dinner is everyone's.
                        const owner = item.people.length === 1 ? people.get(item.people[0]) : undefined;
                        return (
                          <span key={item.key} className={`flex items-center gap-1 overflow-hidden rounded px-1 py-0.5 ${areaOf(item.area).band}`}>
                            {owner ? <Avatar avatar={owner.avatar} colour={owner.colour} className="size-4 shrink-0" /> : null}
                            <span className="type-display line-clamp-2 min-w-0 text-[13px] leading-tight">{item.title}</span>
                          </span>
                        );
                      })}
                      {held.length > 3 ? <span className="text-xs font-semibold">and {held.length - 3} more</span> : null}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 pt-3 text-sm" aria-label="What the colours mean">
            {areasFor(household)
              .filter((area) => ["shower", "laundry", "cleaning", "dinner", "happenings"].includes(area.key))
              .map((area) => (
                <li key={area.key} className="flex items-center gap-1.5">
                  <span className={`size-2.5 rounded-full ${area.dot}`} /> {area.name}
                </li>
              ))}
          </ul>
        </section>

        <section id="day" data-quiet-target aria-labelledby="day-heading" className="flex scroll-mt-4 flex-col gap-2" data-testid="day">
          <h2 id="day-heading" className="type-display text-4xl">
            {day === today ? "Today" : `${chosenDay.weekday} ${chosenDay.dayOfMonth} ${chosenDay.monthShort}`}
          </h2>
          {chosen.length > 0 ? (
            <ul className="flex flex-col">
              {chosen.map((item) => (
                <AgendaItem key={item.key} item={item} people={people} />
              ))}
            </ul>
          ) : (
            <p className="text-ink-soft">
              {who === user.id ? "Nothing on for you this day." : who ? `Nothing on for ${people.get(who)?.name ?? "them"} this day.` : "Nothing on this day."}
            </p>
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
      </div>
      </div>
    </main>
  );
}
