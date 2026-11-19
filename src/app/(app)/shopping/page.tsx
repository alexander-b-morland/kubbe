import type { Metadata } from "next";
import Link from "next/link";
import { AreaPage } from "@/components/area/area-header";
import { Person, type PersonLike } from "@/components/avatar/person";
import { AutoRefresh } from "@/components/booking/auto-refresh";
import { SplitFields } from "@/components/money/split-fields";
import { ActionButton } from "@/components/ui/action-button";
import { isFresh, Struck } from "@/components/ui/strike";
import { describeDinnerDay } from "@/lib/dinner/plan";
import { hasExtra } from "@/lib/extras";
import { requireExtra } from "@/lib/extras-guard";
import { listMembers } from "@/lib/households";
import { goingTo, listBought, listToBuy } from "@/lib/shopping";
import { addDays, dayInZone } from "@/lib/time";
import { boughtItemAction, claimItemAction, removeItemAction } from "./actions";
import { AddItemForm, PayForm } from "./shopping-forms";
import { getT } from "@/lib/i18n/server";

// This screen depends on who is signed in, so it is rendered per request.
export const instant = false;

export const metadata: Metadata = { title: "Shopping" };

export default async function ShoppingPage() {
  const t = await getT();
  const { user, household } = await requireExtra("shopping");
  const now = new Date();
  const today = dayInZone(now, household.timeZone);
  const [toBuy, bought, members] = await Promise.all([listToBuy(household.id), listBought(household.id, now), listMembers(household.id)]);
  const person = new Map<string, PersonLike>(members.map((member) => [member.userId, member]));
  const expensesOn = hasExtra(household, "expenses");
  const mine = bought.filter((item) => item.boughtBy === user.id);
  const theirs = bought.filter((item) => item.boughtBy !== user.id);
  const forDinner = (item: { dinnerDay: string | null; dishTitle: string | null }) =>
    item.dinnerDay
      ? `${item.dinnerDay <= addDays(today, 1) ? t`For dinner ${describeDinnerDay(item.dinnerDay, today, t, true)}` : t`For dinner on ${describeDinnerDay(item.dinnerDay, today, t)}`}${item.dishTitle ? ` (${item.dishTitle})` : ""}. `
      : "";

  // What was bought for one dinner is shared by the people who are eating it.
  const dinners = [...new Set(mine.map((item) => item.dinnerId))];
  const oneDinner = dinners.length === 1 && dinners[0] ? dinners[0] : null;
  const eaters = oneDinner ? (await goingTo(oneDinner)).filter((id) => person.has(id)) : [];

  const aside =
    mine.length > 0 || theirs.length > 0 || expensesOn ? (
      <>
        {mine.length > 0 ? (
          <section aria-labelledby="bag-heading" className="flex flex-col gap-4 rounded-3xl bg-sage/30 p-5" data-testid="bag">
            <h2 id="bag-heading" className="type-display text-3xl">
              {t("You got ")}{mine.length === 1 ? t("1 thing") : t`${mine.length} things`}
            </h2>
            <ul className="flex flex-col">
              {mine.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 border-b-2 border-ink/15 py-2">
                  <Struck draw={isFresh(item.boughtAt, now)} className="text-lg">
                    {item.name}
                  </Struck>
                  <ActionButton look="link" about={item.name} action={boughtItemAction.bind(null, item.id, false)}>
                    {t("Put back")}
                  </ActionButton>
                </li>
              ))}
            </ul>
            {expensesOn ? (
              <PayForm>
                <SplitFields
                  people={members.map((member) => ({ userId: member.userId, name: member.name }))}
                  currency={household.currency}
                  ticked={eaters.length > 0 ? eaters : undefined}
                />
                {eaters.length > 0 ? (
                  <p className="text-sm text-ink-soft" data-testid="eaters-note">
                    {t("These are for one dinner, so the people who are in for it are ticked. Change that if it is wrong.")}
                  </p>
                ) : null}
              </PayForm>
            ) : null}
          </section>
        ) : null}

        {theirs.length > 0 ? (
          <section aria-labelledby="others-heading" className="flex flex-col gap-1">
            <h2 id="others-heading" className="type-display text-3xl">
              {t("Already bought")}
            </h2>
            <ul className="flex flex-col">
              {theirs.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 border-b-2 border-ink/15 py-2">
                  <Struck draw={isFresh(item.boughtAt, now)}>{item.name}</Struck>
                  <Person person={item.boughtBy ? person.get(item.boughtBy) : undefined} me={user.id} size="size-6" className="shrink-0 font-semibold" />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {expensesOn ? (
          <Link
            href="/expenses"
            className="flex min-h-11 w-fit items-center rounded font-bold underline underline-offset-4 outline-none focus-visible:ring-4 focus-visible:ring-fjord"
          >
            {t("See who owes whom")}
          </Link>
        ) : null}
      </>
    ) : undefined;

  return (
    <AreaPage area="shopping" eyebrow={t("Shopping")} title={toBuy.length === 0 ? t("Nothing to buy") : t`${toBuy.length} to buy`} aside={aside}>
      <AutoRefresh everySeconds={30} />
      <AddItemForm />

      {toBuy.length > 0 ? (
        <ul className="flex flex-col">
          {toBuy.map((item) => {
            const claimedByMe = item.claimedBy === user.id;
            const claimer = item.claimedBy ? person.get(item.claimedBy) : undefined;
            return (
              <li key={item.id} data-testid="item" className={`flex flex-col gap-1 border-b-2 border-ink/15 px-3 py-3 ${claimedByMe ? "bg-sage/30" : ""}`}>
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 text-xl font-semibold break-words">{item.name}</span>
                  <ActionButton look="filled" about={item.name} action={boughtItemAction.bind(null, item.id, true)}>
                    {t("Bought")}
                  </ActionButton>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="flex flex-wrap items-center gap-x-2 text-ink-soft">
                    {claimer ? (
                      <span aria-hidden="true">
                        <Person person={claimer} me={user.id} size="size-6" className="font-semibold text-ink" />
                      </span>
                    ) : null}
                    <span>
                      {forDinner(item)}
                      {claimedByMe ? t("You'll buy it.") : claimer ? t`${claimer.name} will buy it.` : t("Nobody has said they'll buy it.")}
                    </span>
                  </span>
                  <span className="ml-auto flex gap-4">
                    {claimedByMe || !item.claimedBy ? (
                      <ActionButton look="link" about={item.name} action={claimItemAction.bind(null, item.id, !claimedByMe)}>
                        {claimedByMe ? t("Not me after all") : t("I'll buy it")}
                      </ActionButton>
                    ) : null}
                    <ActionButton
                      look="link"
                      about={item.name}
                      confirm={item.ingredientId ? t`Take ${item.name} off the list? The dinner will show it as something you already have.` : t`Take ${item.name} off the list?`}
                      action={removeItemAction.bind(null, item.id)}
                    >
                      {t("Remove")}
                    </ActionButton>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      ) : bought.length === 0 ? (
        <p className="text-lg">{t("Anything the flat is out of goes here. Whoever is in the shop ticks it off.")}</p>
      ) : null}
    </AreaPage>
  );
}
