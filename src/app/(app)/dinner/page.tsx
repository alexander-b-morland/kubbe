import type { Metadata } from "next";
import Link from "next/link";
import { ExtraHeader } from "@/components/extras/extra-header";
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
  const nameOf = (userId: string | null) => members.find((member) => member.userId === userId)?.name;
  const next = dinners.find((dinner) => !dinner.cancelled);
  const admin = membership.role === "admin";
  const ruleTime = clockLabel(rules[0]?.time ?? 18 * 60);

  return (
    <main className="mx-auto flex max-w-md flex-col gap-8 p-6 pt-10">
      <ExtraHeader
        art="dinner"
        eyebrow={next ? `Next dinner, ${describeDinnerDay(next.day, today).toLowerCase()} at ${clockLabel(next.time)}` : "Dinner"}
      >
        {next ? (next.chosenTitle ?? "What's for dinner?") : "No dinner planned"}
      </ExtraHeader>

      {dinners.length > 0 ? (
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
            const coming = members.filter((member) => !dinner.absent.includes(member.userId)).length;
            const cook = dinner.cookId === user.id ? "You cook." : dinner.cookId && nameOf(dinner.cookId) ? `${nameOf(dinner.cookId)} cooks.` : "Nobody cooks yet.";
            return (
              <li key={dinner.id} data-testid="dinner" data-state={dinner.chosenTitle ? "settled" : "open"}>
                <Link
                  href={`/dinner/${dinner.id}`}
                  className="flex flex-col gap-1 rounded-2xl border-2 border-ink p-5 outline-none focus-visible:ring-4 focus-visible:ring-fjord"
                >
                  <span className="font-semibold text-ink-soft">{when}</span>
                  <span className="type-display text-4xl break-words">
                    {dinner.chosenTitle ?? (dinner.ideas === 0 ? "Nothing suggested yet" : dinner.ideas === 1 ? "1 idea, not settled" : `${dinner.ideas} ideas, not settled`)}
                  </span>
                  <span>
                    {cook} {dinner.absent.includes(user.id) ? "You're out." : `${coming} in.`}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-lg text-ink-soft">
          Eat together now and then. Plan a dinner below, see who is in, vote on what to cook, and split the shopping.
        </p>
      )}

      <section aria-labelledby="plan-heading" className="flex flex-col gap-4">
        <h2 id="plan-heading" className="type-display text-3xl">
          Plan a dinner
        </h2>
        <AddDinnerForm today={today} />
      </section>

      <section aria-labelledby="rules-heading" className="flex flex-col gap-4" data-testid="dinner-days">
        <h2 id="rules-heading" className="type-display text-3xl">
          Fixed dinner days
        </h2>
        {admin ? (
          <>
            <p className="text-ink-soft">
              Days that always have a dinner. They show up here {LOOK_AHEAD_DAYS} days ahead, and anyone can call one off.
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
    </main>
  );
}
