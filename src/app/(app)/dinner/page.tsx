import type { Metadata } from "next";
import Link from "next/link";
import { AreaPage } from "@/components/area/area-header";
import { Faces, Person } from "@/components/avatar/person";
import { ActionButton } from "@/components/ui/action-button";
import { clockLabel } from "@/lib/booking/status";
import { describeDinnerDay, describeRuleDays, LOOK_AHEAD_DAYS } from "@/lib/dinner/plan";
import { listRules, listUpcomingDinners } from "@/lib/dinner/service";
import { requireExtra } from "@/lib/extras-guard";
import { listMembers } from "@/lib/households";
import { dayInZone } from "@/lib/time";
import { cancelDinnerAction } from "./actions";
import { AddDinnerForm, RulesForm } from "./dinner-forms";

// This screen depends on who is signed in, so it is rendered per request.
export const instant = false;

export const metadata: Metadata = { title: "Dinner" };

export default async function DinnersPage() {
  const { user, household, membership } = await requireExtra("dinner");
  const today = dayInZone(new Date(), household.timeZone);
  const [dinners, rules, members] = await Promise.all([
    listUpcomingDinners(household.id, today),
    listRules(household.id),
    listMembers(household.id),
  ]);
  const person = new Map(members.map((member) => [member.userId, member]));
  const next = dinners.find((dinner) => !dinner.cancelled);
  const admin = membership.role === "admin";
  const ruleTime = clockLabel(rules[0]?.time ?? 18 * 60);

  const plan = (
    <section aria-labelledby="plan-heading" className="flex flex-col gap-4 rounded-3xl bg-salmon/30 p-5" data-testid="plan">
      <h2 id="plan-heading" className="type-display text-3xl">
        Plan a dinner
      </h2>
      <AddDinnerForm today={today} />
    </section>
  );

  return (
    <AreaPage
      area="dinner"
      eyebrow={next ? `Next dinner, ${describeDinnerDay(next.day, today).toLowerCase()} at ${clockLabel(next.time)}` : "Dinner"}
      title={next ? (next.chosenTitle ?? "What's for dinner?") : "No dinner planned"}
    >
      {dinners.length === 0 ? (
        <>
          <p className="text-lg">Pick a day to eat together. Then everyone says if they are in, you vote on what to cook, and the shopping is split.</p>
          {plan}
        </>
      ) : (
        <ul className="flex flex-col gap-3">
          {dinners.map((dinner) => {
            const when = `${describeDinnerDay(dinner.day, today)}, ${clockLabel(dinner.time)}`;
            if (dinner.cancelled) {
              return (
                <li key={dinner.id} data-testid="dinner" data-state="off" className="flex flex-wrap items-center justify-between gap-3 px-5 py-2">
                  <span className="text-ink-soft">{when}. Called off.</span>
                  <ActionButton look="link" label={`Bring back dinner, ${when}`} action={cancelDinnerAction.bind(null, dinner.id, false)}>
                    Bring it back
                  </ActionButton>
                </li>
              );
            }
            const going = dinner.going.map((id) => person.get(id)).filter((member) => member !== undefined);
            const mine = dinner.going.includes(user.id) ? "in" : dinner.notGoing.includes(user.id) ? "out" : "unanswered";
            return (
              <li key={dinner.id} data-testid="dinner" data-state={dinner.chosenTitle ? "settled" : "open"} data-me={mine}>
                <Link
                  href={`/dinner/${dinner.id}`}
                  className="flex flex-col gap-2 rounded-2xl border-2 border-ink p-5 outline-none focus-visible:ring-4 focus-visible:ring-fjord"
                >
                  <span className="font-semibold text-ink-soft">{when}</span>
                  <span className="type-display text-4xl break-words">
                    {dinner.chosenTitle ?? (dinner.ideas === 0 ? "Nothing suggested yet" : dinner.ideas === 1 ? "1 idea, not decided" : `${dinner.ideas} ideas, not decided`)}
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    <Faces people={going} size="size-7" />
                    <span className="font-semibold">{going.length === 0 ? "Nobody is in yet" : `${going.length} in`}</span>
                    {mine === "unanswered" ? <span className="rounded-full bg-barn px-3 py-0.5 text-sm font-bold text-paper">Are you in?</span> : null}
                  </span>
                  <span className="flex flex-wrap items-center gap-x-2 text-ink-soft">
                    {dinner.cookId ? (
                      <>
                        <Person person={person.get(dinner.cookId)} me={user.id} size="size-6" className="font-semibold text-ink" />
                        {dinner.cookId === user.id ? "cook" : "cooks"}
                      </>
                    ) : (
                      "Nobody cooks yet"
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {dinners.length > 0 ? plan : null}

      <section aria-labelledby="rules-heading" className="flex flex-col gap-4" data-testid="dinner-days">
        <h2 id="rules-heading" className="type-display text-3xl">
          Fixed dinner days
        </h2>
        {admin ? (
          <>
            <p className="text-ink-soft">
              Days that always have a dinner. They show up here {LOOK_AHEAD_DAYS} days ahead, everyone answers for themselves, and anyone can call one off.
            </p>
            <RulesForm weekdays={rules.map((rule) => rule.weekday)} time={ruleTime} />
          </>
        ) : rules.length > 0 ? (
          <p>
            Dinner is on {describeRuleDays(rules)} at {ruleTime}. An admin can change the days.
          </p>
        ) : (
          <p className="text-ink-soft">None yet. An admin can pick days that always have a dinner.</p>
        )}
      </section>
    </AreaPage>
  );
}
