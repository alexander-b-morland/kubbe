import type { Metadata } from "next";
import { ExtraHeader } from "@/components/extras/extra-header";
import { SplitFields } from "@/components/money/split-fields";
import { ActionButton } from "@/components/ui/action-button";
import { requireExtra } from "@/lib/extras-guard";
import { listMembers } from "@/lib/households";
import { balances, formatAmount, settleUp } from "@/lib/money";
import { listExpenses } from "@/lib/shopping";
import { timeAgo } from "@/lib/time";
import { removeExpenseAction, settleAction } from "./actions";
import { ExpenseForm } from "./expense-form";

// This screen depends on who is signed in, so it is rendered per request.
export const instant = false;

export const metadata: Metadata = { title: "Expenses" };

export default async function ExpensesPage() {
  const { user, household, membership } = await requireExtra("expenses");
  const now = new Date();
  const [entries, members] = await Promise.all([listExpenses(household.id), listMembers(household.id)]);
  const money = (amount: number) => formatAmount(amount, household.currency);
  const nameOf = (userId: string) => members.find((member) => member.userId === userId)?.name ?? "Someone who moved out";
  const who = (userId: string) => (userId === user.id ? "You" : nameOf(userId));

  const net = balances(entries);
  const mine = net.get(user.id) ?? 0;
  const transfers = settleUp(net);
  const people = members.map((member) => ({ userId: member.userId, name: member.name }));
  const admin = membership.role === "admin";

  return (
    <main className="mx-auto flex max-w-md flex-col gap-8 p-6 pt-10">
      <ExtraHeader art="money" eyebrow="Expenses">
        {mine > 0 ? `You're owed ${money(mine)}` : mine < 0 ? `You owe ${money(mine)}` : "All square"}
      </ExtraHeader>

      {transfers.length > 0 ? (
        <section aria-labelledby="settle-heading" className="flex flex-col gap-1" data-testid="settle">
          <h2 id="settle-heading" className="type-display text-3xl">
            To get square
          </h2>
          <ul className="flex flex-col">
            {transfers.map((transfer) => {
              const involved = transfer.from === user.id || transfer.to === user.id || admin;
              const pays = transfer.from === user.id ? "You pay" : `${nameOf(transfer.from)} pays`;
              const whom = transfer.to === user.id ? "you" : nameOf(transfer.to);
              return (
                <li key={`${transfer.from}-${transfer.to}`} className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink/15 py-3">
                  <span className="text-lg font-semibold">
                    {pays} {whom} {money(transfer.amount)}
                  </span>
                  {involved ? (
                    <ActionButton
                      confirm={`Mark ${money(transfer.amount)} as paid?`}
                      action={settleAction.bind(null, transfer.from, transfer.to, transfer.amount)}
                    >
                      Paid
                    </ActionButton>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <details className="group border-y-2 border-ink/15">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg py-4 outline-none focus-visible:ring-4 focus-visible:ring-fjord [&::-webkit-details-marker]:hidden">
          <span className="type-display text-3xl">Add an expense</span>
          <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6 shrink-0 transition-transform group-open:rotate-180">
            <path d="M5 9C8 12 10 14 12 16C14 14 16 12 19 9" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
          </svg>
        </summary>
        <div className="pb-6">
          <ExpenseForm people={people} me={user.id} count={entries.length}>
            <SplitFields people={people} />
          </ExpenseForm>
        </div>
      </details>

      {entries.length > 0 ? (
        <section aria-labelledby="history-heading" className="flex flex-col gap-1">
          <h2 id="history-heading" className="type-display text-3xl">
            What was paid
          </h2>
          <ul className="flex flex-col">
            {entries.slice(0, 40).map((entry) => (
              <li key={entry.id} data-testid="expense" className="flex flex-col gap-1 border-b-2 border-ink/15 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 text-lg font-semibold break-words">
                    {entry.isSettlement ? `${who(entry.paidBy)} paid ${entry.shares[0]?.userId === user.id ? "you" : nameOf(entry.shares[0]?.userId ?? "")} back` : entry.description}
                  </span>
                  <span className="type-display shrink-0 text-2xl">{money(entry.amount)}</span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-x-3">
                  <span className="text-ink-soft">
                    {entry.isSettlement
                      ? timeAgo(entry.createdAt, now, household.timeZone)
                      : `${who(entry.paidBy)} paid, split between ${entry.shares.length}, ${timeAgo(entry.createdAt, now, household.timeZone)}`}
                  </span>
                  {entry.paidBy === user.id || admin ? (
                    <ActionButton look="link" label={`Remove ${entry.description}`} confirm="Remove this?" action={removeExpenseAction.bind(null, entry.id)}>
                      Remove
                    </ActionButton>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="text-lg text-ink-soft">
          When someone pays for something for the flat, log it here or tick it off on the shopping list. Kubbe keeps track of who
          owes whom.
        </p>
      )}
    </main>
  );
}
