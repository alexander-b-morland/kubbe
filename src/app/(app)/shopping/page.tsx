import type { Metadata } from "next";
import Link from "next/link";
import { AreaPage } from "@/components/area/area-header";
import { Person, type PersonLike } from "@/components/avatar/person";
import { AutoRefresh } from "@/components/booking/auto-refresh";
import { SplitFields } from "@/components/money/split-fields";
import { ActionButton } from "@/components/ui/action-button";
import { isFresh, Struck } from "@/components/ui/strike";
import { hasExtra } from "@/lib/extras";
import { requireExtra } from "@/lib/extras-guard";
import { listMembers } from "@/lib/households";
import { listBought, listToBuy } from "@/lib/shopping";
import { boughtItemAction, claimItemAction, removeItemAction } from "./actions";
import { AddItemForm, PayForm } from "./shopping-forms";

// This screen depends on who is signed in, so it is rendered per request.
export const instant = false;

export const metadata: Metadata = { title: "Shopping" };

export default async function ShoppingPage() {
  const { user, household } = await requireExtra("shopping");
  const now = new Date();
  const [toBuy, bought, members] = await Promise.all([listToBuy(household.id), listBought(household.id, now), listMembers(household.id)]);
  const person = new Map<string, PersonLike>(members.map((member) => [member.userId, member]));
  const expensesOn = hasExtra(household, "expenses");
  const mine = bought.filter((item) => item.boughtBy === user.id);
  const theirs = bought.filter((item) => item.boughtBy !== user.id);

  return (
    <AreaPage area="shopping" eyebrow="Shopping" title={toBuy.length === 0 ? "Nothing to buy" : `${toBuy.length} to buy`}>
      <AutoRefresh everySeconds={30} />
      <AddItemForm count={toBuy.length + bought.length} />

      {toBuy.length > 0 ? (
        <ul className="flex flex-col">
          {toBuy.map((item) => {
            const claimedByMe = item.claimedBy === user.id;
            const claimer = item.claimedBy ? person.get(item.claimedBy) : undefined;
            return (
              <li key={item.id} data-testid="item" className={`flex flex-col gap-1 border-b-2 border-ink/15 px-3 py-3 ${claimedByMe ? "bg-sage/30" : ""}`}>
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 text-xl font-semibold break-words">{item.name}</span>
                  <ActionButton look="filled" label={`Got ${item.name}`} action={boughtItemAction.bind(null, item.id, true)}>
                    Got it
                  </ActionButton>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="flex flex-wrap items-center gap-x-2 text-ink-soft">
                    {claimer ? <Person person={claimer} me={user.id} size="size-6" className="font-semibold text-ink" /> : null}
                    <span>
                      {item.ingredientId ? "For a dinner. " : ""}
                      {claimedByMe ? "You'll buy it." : claimer ? `${claimer.name} will buy it.` : "Nobody has said they'll buy it."}
                    </span>
                  </span>
                  <span className="ml-auto flex gap-4">
                    {claimedByMe || !item.claimedBy ? (
                      <ActionButton
                        look="link"
                        label={claimedByMe ? `Not buying ${item.name} after all` : `I'll buy ${item.name}`}
                        action={claimItemAction.bind(null, item.id, !claimedByMe)}
                      >
                        {claimedByMe ? "Not me after all" : "I'll buy it"}
                      </ActionButton>
                    ) : null}
                    <ActionButton look="link" label={`Remove ${item.name}`} action={removeItemAction.bind(null, item.id)}>
                      Remove
                    </ActionButton>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      ) : bought.length === 0 ? (
        <p className="text-lg">Anything the flat is out of goes here. Whoever is in the shop ticks it off.</p>
      ) : null}

      {mine.length > 0 ? (
        <section aria-labelledby="bag-heading" className="flex flex-col gap-4 rounded-3xl bg-sage/30 p-5" data-testid="bag">
          <h2 id="bag-heading" className="type-display text-3xl">
            You got {mine.length === 1 ? "1 thing" : `${mine.length} things`}
          </h2>
          <ul className="flex flex-col">
            {mine.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 border-b-2 border-ink/15 py-2">
                <Struck draw={isFresh(item.boughtAt, now)} className="text-lg text-ink-soft">
                  {item.name}
                </Struck>
                <ActionButton look="link" label={`Put ${item.name} back on the list`} action={boughtItemAction.bind(null, item.id, false)}>
                  Put back
                </ActionButton>
              </li>
            ))}
          </ul>
          {expensesOn ? (
            <PayForm>
              <SplitFields people={members.map((member) => ({ userId: member.userId, name: member.name }))} currency={household.currency} />
            </PayForm>
          ) : null}
        </section>
      ) : null}

      {theirs.length > 0 ? (
        <section aria-labelledby="others-heading" className="flex flex-col gap-1">
          <h2 id="others-heading" className="type-display text-3xl">
            Already bought
          </h2>
          <ul className="flex flex-col">
            {theirs.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 border-b-2 border-ink/15 py-2">
                <Struck draw={isFresh(item.boughtAt, now)} className="text-ink-soft">
                  {item.name}
                </Struck>
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
          See who owes whom
        </Link>
      ) : null}
    </AreaPage>
  );
}
