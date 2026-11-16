import type { Metadata } from "next";
import { Avatar } from "@/components/avatar/avatar";
import { ExtraHeader } from "@/components/extras/extra-header";
import { ActionButton } from "@/components/ui/action-button";
import { requireExtra } from "@/lib/extras-guard";
import { listUpcoming } from "@/lib/happenings";
import { listMembers } from "@/lib/households";
import { describeWhen } from "@/lib/booking/status";
import { listNames } from "@/lib/names";
import { clockTime, dayInZone, describeDay } from "@/lib/time";
import { removeHappeningAction, replyAction } from "./actions";
import { HappeningForm } from "./happening-form";

// This screen depends on who is signed in, so it is rendered per request.
export const instant = false;

export const metadata: Metadata = { title: "Happenings" };

export default async function HappeningsPage() {
  const { user, household, membership } = await requireExtra("happenings");
  const now = new Date();
  const timeZone = household.timeZone;
  const [upcoming, members] = await Promise.all([listUpcoming(household.id, now), listMembers(household.id)]);
  const person = new Map(members.map((member) => [member.userId, member]));
  const next = upcoming[0];

  return (
    <main className="mx-auto flex max-w-md flex-col gap-8 p-6 pt-10">
      <ExtraHeader art="happening" eyebrow={next ? `Next up, ${describeWhen(next.startsAt, now, timeZone)}` : "Happenings"}>
        {next ? next.title : "Nothing planned"}
      </ExtraHeader>

      {upcoming.length > 0 ? (
        <ul className="flex flex-col gap-4">
          {upcoming.map((item) => {
            const day = describeDay(dayInZone(item.startsAt, timeZone));
            const going = item.going.map((id) => person.get(id)).filter((member) => member !== undefined);
            const mine = item.going.includes(user.id) ? "in" : item.notGoing.includes(user.id) ? "out" : "unanswered";
            const mayRemove = item.createdBy === user.id || membership.role === "admin";
            return (
              <li key={item.id} data-testid="happening" data-reply={mine} className="flex flex-col gap-3 rounded-2xl border-2 border-ink p-5">
                <div className="flex flex-col gap-1">
                  <p className="font-semibold text-ink-soft">
                    {day.weekday} {day.dayOfMonth} {day.monthShort}, {clockTime(item.startsAt, timeZone)}
                    {item.place ? `, ${item.place}` : ""}
                  </p>
                  <h2 className="type-display text-4xl break-words">{item.title}</h2>
                </div>
                {item.details ? <p className="break-words whitespace-pre-line">{item.details}</p> : null}

                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex -space-x-2">
                    {going.map((member) => (
                      <Avatar key={member.userId} avatar={member.avatar} colour={member.colour} className="size-8 border-2 border-paper" />
                    ))}
                  </span>
                  <span className="font-semibold">
                    {going.length === 0
                      ? "Nobody is in yet"
                      : `${listNames(going.map((member) => member.userId), user.id, (id) => person.get(id)?.name ?? "Someone")} ${going.length === 1 && going[0].userId !== user.id ? "is" : "are"} in`}
                  </span>
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
                  ) : (
                    <span className="text-ink-soft">You can&apos;t make it.</span>
                  )}
                  {mayRemove ? (
                    <span className="ml-auto">
                      <ActionButton look="link" label={`Call off ${item.title}`} confirm={`Call off ${item.title}?`} action={removeHappeningAction.bind(null, item.id)}>
                        Call off
                      </ActionButton>
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-lg text-ink-soft">Film night, a hike, a party. Suggest something and see who is in.</p>
      )}

      <section aria-labelledby="suggest-heading" className="flex flex-col gap-4">
        <h2 id="suggest-heading" className="type-display text-3xl">
          Suggest something
        </h2>
        <HappeningForm count={upcoming.length} today={dayInZone(now, timeZone)} />
      </section>
    </main>
  );
}
