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
import { dayInZone, isDay, minutesInZone } from "@/lib/time";
import { cancelDinnerAction } from "./actions";
import { AddDinnerForm, RulesForm } from "./dinner-forms";
import { getT } from "@/lib/i18n/server";

// This screen depends on who is signed in, so it is rendered per request.
export const instant = false;

export const metadata: Metadata = { title: "Dinner" };

/** "today", "tomorrow", or "Thursday 19 Nov": a day in the middle of a sentence. */
const inSentence = (label: string) => (label === "Today" || label === "Tomorrow" ? label.toLowerCase() : label);

export default async function DinnersPage({ searchParams }: PageProps<"/dinner">) {
  const t = await getT();
  const { user, household, membership } = await requireExtra("dinner");
  const params = await searchParams;
  const now = new Date();
  const today = dayInZone(now, household.timeZone);
  // Coming from a day on the calendar, the form starts on that day.
  const startDay = isDay(params.day) && params.day >= today ? params.day : undefined;
  const [dinners, rules, members] = await Promise.all([
    listUpcomingDinners(household.id, today, minutesInZone(now, household.timeZone)),
    listRules(household.id),
    listMembers(household.id),
  ]);
  const person = new Map(members.map((member) => [member.userId, member]));
  const next = dinners.find((dinner) => !dinner.cancelled);
  const admin = membership.role === "admin";
  const ruleTime = clockLabel(rules[0]?.time ?? 18 * 60);

  const aside = (
    <>
      <section aria-labelledby="plan-heading" className="flex flex-col gap-4 rounded-3xl bg-salmon/25 p-5" data-testid="plan">
        <h2 id="plan-heading" className="type-display text-3xl">
          {t("Plan a dinner")}
        </h2>
        <AddDinnerForm today={today} day={startDay} />
      </section>

      <section aria-labelledby="rules-heading" className="flex flex-col gap-4" data-testid="dinner-days">
        <h2 id="rules-heading" className="type-display text-3xl">
          {t("Fixed dinner days")}
        </h2>
        {admin ? (
          <>
            <p className="text-ink-soft">
              {t`Days that always have a dinner. They show up here ${LOOK_AHEAD_DAYS} days ahead, everyone answers for themselves, and anyone can call one off.`}
            </p>
            <RulesForm weekdays={rules.map((rule) => rule.weekday)} time={ruleTime} />
          </>
        ) : rules.length > 0 ? (
          <p>
            {t`Dinner is on ${describeRuleDays(rules, t)} at ${ruleTime}. An admin can change the days.`}
          </p>
        ) : (
          <p className="text-ink-soft">{t("None yet. An admin can pick days that always have a dinner.")}</p>
        )}
      </section>
    </>
  );

  return (
    <AreaPage
      area="dinner"
      eyebrow={next ? t`Next dinner, ${inSentence(describeDinnerDay(next.day, today, t))} at ${clockLabel(next.time)}` : t("Dinner")}
      title={next ? (next.chosenTitle ?? t("What's for dinner?")) : t("No dinner planned")}
      aside={aside}
    >
      {dinners.length === 0 ? (
        <p className="text-lg">{t("Pick a day to eat together. Then everyone says if they are in, you vote on what to cook, and the shopping is split.")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {dinners.map((dinner) => {
            const when = `${describeDinnerDay(dinner.day, today, t)}, ${clockLabel(dinner.time)}`;
            if (dinner.cancelled) {
              return (
                <li key={dinner.id} data-testid="dinner" data-state="off" className="flex flex-wrap items-center justify-between gap-3 px-5 py-2">
                  <span className="text-ink-soft">{t`${when}. Called off.`}</span>
                  <ActionButton look="link" label={t`Bring back dinner, ${when}`} action={cancelDinnerAction.bind(null, dinner.id, false)}>
                    {t("Bring it back")}
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
                  className={`flex flex-col gap-2 rounded-2xl border-2 border-ink p-5 outline-none focus-visible:ring-4 focus-visible:ring-fjord ${mine === "in" ? "bg-salmon/25" : ""}`}
                >
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-ink-soft">{when}</span>
                    <span className={`rounded-full border-2 border-ink px-3 py-0.5 text-sm font-bold ${mine === "in" ? "bg-ink text-paper" : ""}`}>
                      {mine === "in" ? t("You're in") : mine === "out" ? t("You can't") : t("Are you in?")}
                    </span>
                  </span>
                  {dinner.chosenTitle ? (
                    <span className="type-display text-4xl break-words">{dinner.chosenTitle}</span>
                  ) : (
                    <span className="text-xl font-semibold">
                      {dinner.ideas === 0 ? t("Nothing suggested yet") : dinner.ideas === 1 ? t("1 idea, not decided") : t`${dinner.ideas} ideas, not decided`}
                    </span>
                  )}
                  <span className="flex flex-wrap items-center gap-2">
                    <Faces people={going} size="size-7" />
                    <span className="font-semibold">{going.length === 0 ? t("Nobody is in yet") : t`${going.length} in`}</span>
                  </span>
                  <span className="flex flex-wrap items-center gap-x-2 text-ink-soft">
                    {dinner.cookId ? (
                      <>
                        <Person person={person.get(dinner.cookId)} me={user.id} size="size-6" className="font-semibold text-ink" />
                        {dinner.cookId === user.id ? t("cook") : t("cooks")}
                      </>
                    ) : (
                      t("Nobody cooks yet")
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </AreaPage>
  );
}
