import type { Metadata } from "next";
import Link from "next/link";
import { AutoRefresh } from "@/components/booking/auto-refresh";
import { ExtraHeader } from "@/components/extras/extra-header";
import { SplitFields } from "@/components/money/split-fields";
import { ActionButton } from "@/components/ui/action-button";
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
  const nameOf = (userId: string | null) => members.find((member) => member.userId === userId)?.name;
  const expensesOn = hasExtra(household, "expenses");
  const mine = bought.filter((item) => item.boughtBy === user.id);
  const theirs = bought.filter((item) => item.boughtBy !== user.id);

  return (
    <main className="mx-auto flex max-w-md flex-col gap-8 p-6 pt-10">
      <AutoRefresh everySeconds={30} />
      <ExtraHeader art="shopping" eyebrow="Shopping">
        {toBuy.length === 0 ? "Nothing to buy" : `${toBuy.length} to buy`}
      </ExtraHeader>

      <AddItemForm count={toBuy.length + bought.length} />

      {toBuy.length > 0 ? (
        <ul className="flex flex-col">
          {toBuy.map((item) => {
            const claimedByMe = item.claimedBy === user.id;
            const claimer = nameOf(item.claimedBy);
            return (
              <li key={item.id} data-testid="item" className="flex flex-col gap-1 border-b-2 border-ink/15 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 text-xl font-semibold break-words">{item.name}</span>
                  <ActionButton look="filled" label={`Got ${item.name}`} action={boughtItemAction.bind(null, item.id, true)}>
                    Got it
                  </ActionButton>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="text-ink-soft">
                    {item.ingredientId ? "For a dinner. " : ""}
                    {claimedByMe ? "You'll buy it." : claimer ? `${claimer} will buy it.` : "Nobody has said they'll buy it."}
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
        <p className="text-lg text-ink-soft">
          Anything the flat is out of goes here. Whoever is in the shop ticks it off.
        </p>
      ) : null}

      {mine.length > 0 ? (
        <section aria-labelledby="bag-heading" className="flex flex-col gap-4 rounded-2xl border-2 border-ink p-5" data-testid="bag">
          <h2 id="bag-heading" className="type-display text-3xl">
            You got {mine.length === 1 ? "1 thing" : `${mine.length} things`}
          </h2>
          <ul className="flex flex-col">
            {mine.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 border-b-2 border-ink/15 py-2">
                <span className="relative min-w-0 text-lg break-words text-ink-soft">
                  {item.name}
                  <svg className="strike" viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden="true">
                    <path pathLength={1} d="M1 12C20 7 42 15 60 10C76 6 90 13 99 9" />
                  </svg>
                </span>
                <ActionButton look="link" label={`Put ${item.name} back on the list`} action={boughtItemAction.bind(null, item.id, false)}>
                  Put back
                </ActionButton>
              </li>
            ))}
          </ul>
          {expensesOn ? (
            <PayForm>
              <SplitFields people={members.map((member) => ({ userId: member.userId, name: member.name }))} />
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
              <li key={item.id} className="flex items-baseline justify-between gap-3 border-b-2 border-ink/15 py-2">
                <span className="min-w-0 break-words">{item.name}</span>
                <span className="shrink-0 text-ink-soft">{nameOf(item.boughtBy) ?? "Someone"}</span>
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
    </main>
  );
}
