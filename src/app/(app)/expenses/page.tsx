import type { Metadata } from "next";
import { AreaPage } from "@/components/area/area-header";
import { Person, type PersonLike } from "@/components/avatar/person";
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

const chevron = (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6 shrink-0 transition-transform group-open:rotate-180">
    <path d="M5 9C8 12 10 14 12 16C14 14 16 12 19 9" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
  </svg>
);

export default async function ExpensesPage() {
  const { user, household, membership } = await requireExtra("expenses");
  const now = new Date();
  const [entries, members] = await Promise.all([listExpenses(household.id), listMembers(household.id)]);
  const money = (amount: number) => formatAmount(amount, household.currency);
  const person = new Map<string, PersonLike>(members.map((member) => [member.userId, member]));
  const nameOf = (userId: string) => person.get(userId)?.name ?? "Someone who moved out";
  const who = (userId: string) => (userId === user.id ? "You" : nameOf(userId));

  const net = balances(entries);
  const mine = net.get(user.id) ?? 0;
  const transfers = settleUp(net);
  const people = members.map((member) => ({ userId: member.userId, name: member.name }));
  const admin = membership.role === "admin";

  return (
    <AreaPage area="expenses" eyebrow="Expenses" title={mine > 0 ? `You're owed ${money(mine)}` : mine < 0 ? `You owe ${money(mine)}` : "All square"}>
      {transfers.length > 0 ? (
        <section aria-labelledby="settle-heading" className="flex flex-col gap-1" data-testid="settle">
          <h2 id="settle-heading" className="type-display text-3xl">
            To get square
          </h2>
          <ul className="flex flex-col">
            {transfers.map((transfer) => {
              const involved = transfer.from === user.id || transfer.to === user.id || admin;
              return (
                <li key={`${transfer.from}-${transfer.to}`} className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink/15 py-3">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-lg font-semibold">
                    <Person person={person.get(transfer.from)} me={user.id} />
                    {transfer.from === user.id ? "pay" : "pays"}
                    <Person person={person.get(transfer.to)} me={user.id} />
                    <span className="type-display text-2xl">{money(transfer.amount)}</span>
                    <span className="sr-only">
                      {transfer.from === user.id ? "You pay" : `${nameOf(transfer.from)} pays`} {transfer.to === user.id ? "you" : nameOf(transfer.to)} {money(transfer.amount)}
                    </span>
                  </span>
                  {involved ? (
                    <ActionButton confirm={`Mark ${money(transfer.amount)} as paid?`} action={settleAction.bind(null, transfer.from, transfer.to, transfer.amount)}>
                      Paid
                    </ActionButton>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <details className="group rounded-3xl bg-heather/30 px-5" open={entries.length === 0} data-testid="add-expense">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg py-4 outline-none focus-visible:ring-4 focus-visible:ring-fjord [&::-webkit-details-marker]:hidden">
          <span className="type-display text-3xl">Add an expense</span>
          {chevron}
        </summary>
        <div className="pb-6">
          <ExpenseForm people={people} me={user.id} currency={household.currency} count={entries.length} />
        </div>
      </details>

      {entries.length > 0 ? (
        <section aria-labelledby="history-heading" className="flex flex-col gap-1">
          <h2 id="history-heading" className="type-display text-3xl">
            What was paid
          </h2>
          <ul className="flex flex-col">
            {entries.slice(0, 40).map((entry) => {
              const mayChange = entry.paidBy === user.id || entry.createdBy === user.id || admin;
              const even = new Set(entry.shares.map((share) => share.amount)).size <= 1 || Math.max(...entry.shares.map((share) => share.amount)) - Math.min(...entry.shares.map((share) => share.amount)) <= 1;
              return (
                <li key={entry.id} data-testid="expense" className="flex flex-col gap-1 border-b-2 border-ink/15 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 text-lg font-semibold break-words">
                      {entry.isSettlement ? `${who(entry.paidBy)} paid ${entry.shares[0]?.userId === user.id ? "you" : nameOf(entry.shares[0]?.userId ?? "")} back` : entry.description}
                    </span>
                    <span className="type-display shrink-0 text-2xl">{money(entry.amount)}</span>
                  </div>
                  <p className="flex flex-wrap items-center gap-x-2 text-ink-soft">
                    {entry.isSettlement ? (
                      timeAgo(entry.createdAt, now, household.timeZone)
                    ) : (
                      <>
                        <Person person={person.get(entry.paidBy)} me={user.id} size="size-6" className="font-semibold text-ink" />
                        paid, {even ? `split between ${entry.shares.length}` : entry.shares.map((share) => `${who(share.userId)} ${money(share.amount)}`).join(", ")}, {timeAgo(entry.createdAt, now, household.timeZone)}
                      </>
                    )}
                  </p>
                  {mayChange ? (
                    <div className="flex flex-col gap-2">
                      {!entry.isSettlement ? (
                        <details className="group">
                          <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-1 rounded font-bold underline underline-offset-4 outline-none focus-visible:ring-4 focus-visible:ring-fjord [&::-webkit-details-marker]:hidden">
                            <span>Change</span>
                            <span className="sr-only">{entry.description}</span>
                          </summary>
                          <div className="rounded-2xl bg-heather/30 p-4">
                            <ExpenseForm
                              people={people}
                              me={user.id}
                              currency={household.currency}
                              existing={{
                                id: entry.id,
                                description: entry.description,
                                amount: entry.amount,
                                paidBy: entry.paidBy,
                                shares: Object.fromEntries(entry.shares.map((share) => [share.userId, share.amount])),
                              }}
                            />
                          </div>
                        </details>
                      ) : null}
                      <ActionButton look="link" align="start" label={`Remove ${entry.description}`} confirm="Remove this?" action={removeExpenseAction.bind(null, entry.id)}>
                        Remove
                      </ActionButton>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <p className="text-lg">
          When someone pays for something for the flat, log it here or tick it off on the shopping list. Kubbe keeps track of who owes whom.
        </p>
      )}
    </AreaPage>
  );
}
