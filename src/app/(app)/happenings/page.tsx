import type { Metadata } from "next";
import { AreaPage } from "@/components/area/area-header";
import { Faces, Person, type PersonLike } from "@/components/avatar/person";
import { ActionButton } from "@/components/ui/action-button";
import { describeWhen } from "@/lib/booking/status";
import { requireExtra } from "@/lib/extras-guard";
import { listUpcoming } from "@/lib/happenings";
import { listMembers } from "@/lib/households";
import { listNames } from "@/lib/names";
import { clockTime, dayInZone, describeDay, isDay } from "@/lib/time";
import { removeHappeningAction, replyAction } from "./actions";
import { HappeningForm } from "./happening-form";

// This screen depends on who is signed in, so it is rendered per request.
export const instant = false;

export const metadata: Metadata = { title: "Happenings" };

export default async function HappeningsPage({ searchParams }: PageProps<"/happenings">) {
  const { user, household, membership } = await requireExtra("happenings");
  const params = await searchParams;
  const now = new Date();
  const timeZone = household.timeZone;
  const today = dayInZone(now, timeZone);
  // Coming from a day on the calendar, the form starts on that day.
  const startDay = isDay(params.day) && params.day >= today ? params.day : undefined;
  const [upcoming, members] = await Promise.all([listUpcoming(household.id, now), listMembers(household.id)]);
  const person = new Map<string, PersonLike>(members.map((member) => [member.userId, member]));
  const nameOf = (userId: string) => person.get(userId)?.name ?? "Someone";
  const next = upcoming[0];

  const form = (
    <section aria-labelledby="suggest-heading" className="flex flex-col gap-4 rounded-3xl bg-blush/30 p-5">
      <h2 id="suggest-heading" className="type-display text-3xl">
        Suggest something
      </h2>
      <HappeningForm today={today} day={startDay} />
    </section>
  );

  return (
    <AreaPage
      area="happenings"
      eyebrow={next ? `Next up: ${next.title}, ${describeWhen(next.startsAt, now, timeZone)}` : "Happenings"}
      title={upcoming.length === 0 ? "Nothing planned" : upcoming.length === 1 ? "1 thing planned" : `${upcoming.length} things planned`}
      aside={form}
    >
      {upcoming.length > 0 ? (
        <ul className="flex flex-col gap-4">
          {upcoming.map((item) => {
            const day = dayInZone(item.startsAt, timeZone);
            const label = describeDay(day);
            const time = clockTime(item.startsAt, timeZone);
            const known = (ids: readonly string[]) => ids.filter((id) => person.has(id));
            const going = known(item.going);
            const out = known(item.notGoing);
            const waiting = members.map((member) => member.userId).filter((id) => !item.going.includes(id) && !item.notGoing.includes(id));
            const mine = item.going.includes(user.id) ? "in" : item.notGoing.includes(user.id) ? "out" : "unanswered";
            const mayChange = item.createdBy === user.id || membership.role === "admin";
            return (
              <li key={item.id} id={item.id} data-testid="happening" data-reply={mine} className="flex flex-col gap-3 rounded-2xl border-2 border-ink p-5">
                <div className="flex flex-col gap-1">
                  <p className="font-semibold text-ink-soft">
                    {label.weekday} {label.dayOfMonth} {label.monthShort}, {time}
                    {item.place ? `, ${item.place}` : ""}
                  </p>
                  <h2 className="text-2xl font-bold break-words">{item.title}</h2>
                  <p className="flex flex-wrap items-center gap-x-2 text-ink-soft">
                    <Person person={person.get(item.createdBy)} me={user.id} size="size-6" className="font-semibold text-ink" /> suggested it
                  </p>
                </div>
                {item.details ? <p className="break-words whitespace-pre-line">{item.details}</p> : null}

                <div className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Faces people={going.map((id) => person.get(id)!)} />
                    <span className="font-semibold">
                      {going.length === 0 ? "Nobody is in yet" : `${listNames(going, user.id, nameOf)} ${going.length === 1 && going[0] !== user.id ? "is" : "are"} in`}
                    </span>
                  </div>
                  {out.length > 0 ? <p className="text-ink-soft">{listNames(out, user.id, nameOf)} can&apos;t make it.</p> : null}
                  {waiting.length > 0 ? <p className="text-ink-soft">No answer yet from {listNames(waiting, user.id, nameOf).replace(/^You\b/, "you")}.</p> : null}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {mine !== "in" ? (
                    <ActionButton look="filled" align="start" label={`I'm in for ${item.title}`} action={replyAction.bind(null, item.id, true)}>
                      I&apos;m in
                    </ActionButton>
                  ) : null}
                  {mine !== "out" ? (
                    <ActionButton align="start" label={`I can't make ${item.title}`} action={replyAction.bind(null, item.id, false)}>
                      {mine === "in" ? "Can't after all" : "Can't make it"}
                    </ActionButton>
                  ) : null}
                </div>

                {mayChange ? (
                  <div className="flex flex-wrap items-start gap-x-5 gap-y-1 border-t-2 border-ink/15 pt-2">
                    <details className="group min-w-0 flex-1">
                      <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center rounded font-bold underline underline-offset-4 outline-none focus-visible:ring-4 focus-visible:ring-fjord [&::-webkit-details-marker]:hidden">
                        <span className="group-open:hidden">Change the time or place</span>
                        <span className="hidden group-open:inline">Close</span>
                        <span className="sr-only">: {item.title}</span>
                      </summary>
                      <div className="rounded-2xl bg-blush/30 p-4">
                        <p className="pb-3 text-sm text-ink-soft">Everyone&apos;s answers stay as they are.</p>
                        <HappeningForm today={today} existing={{ id: item.id, title: item.title, day, time, place: item.place, details: item.details }} />
                      </div>
                    </details>
                    <ActionButton
                      look="link"
                      label={`Call off ${item.title}`}
                      confirm={going.filter((id) => id !== user.id).length > 0 ? `Call off ${item.title}? ${listNames(going.filter((id) => id !== user.id), user.id, nameOf)} said yes and will just see it gone.` : `Call off ${item.title}?`}
                      action={removeHappeningAction.bind(null, item.id)}
                    >
                      Call off
                    </ActionButton>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-lg">Film night, a hike, a party. Suggest something and see who is in.</p>
      )}
    </AreaPage>
  );
}
