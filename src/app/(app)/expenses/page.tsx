import type { Metadata } from "next";
import { AreaPage } from "@/components/area/area-header";
import { Person, type PersonLike } from "@/components/avatar/person";
import { ActionButton } from "@/components/ui/action-button";
import { requireExtra } from "@/lib/extras-guard";
import { listMembers } from "@/lib/households";
import { balances, formatAmount, settleUp } from "@/lib/money";
import { listNames } from "@/lib/names";
import { listExpenses } from "@/lib/shopping";
import { timeAgo } from "@/lib/time";
import { removeExpenseAction, settleAction } from "./actions";
import { ExpenseForm } from "./expense-form";
import { getT } from "@/lib/i18n/server";

// This screen depends on who is signed in, so it is rendered per request.
export const instant = false;

export const metadata: Metadata = { title: "Expenses" };

const chevron = (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6 shrink-0 transition-transform group-open:rotate-180">
    <path d="M5 9C8 12 10 14 12 16C14 14 16 12 19 9" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
  </svg>
);

export default async function ExpensesPage() {
  const t = await getT();
  const { user, household, membership } = await requireExtra("expenses");
  const now = new Date();
  const [entries, members] = await Promise.all([listExpenses(household.id), listMembers(household.id)]);
  const money = (amount: number) => formatAmount(amount, household.currency);
  const person = new Map<string, PersonLike>(members.map((member) => [member.userId, member]));
  const nameOf = (userId: string) => person.get(userId)?.name ?? t("Someone who moved out");
  const who = (userId: string) => (userId === user.id ? t("You") : nameOf(userId));

  const net = balances(entries);
  const mine = net.get(user.id) ?? 0;
  const transfers = settleUp(net);
  const involvesMe = transfers.some((transfer) => transfer.from === user.id || transfer.to === user.id);
  const people = members.map((member) => ({ userId: member.userId, name: member.name }));
  const admin = membership.role === "admin";

  const history =
    entries.length > 0 ? (
      <section aria-labelledby="history-heading" className="flex flex-col gap-1">
        <h2 id="history-heading" className="type-display text-3xl">
          {t("What was paid")}
        </h2>
        <ul className="flex flex-col">
          {entries.slice(0, 60).map((entry) => {
            const mayChange = entry.paidBy === user.id || entry.createdBy === user.id || admin;
            const parts = entry.shares.map((share) => share.amount);
            const even = parts.length > 0 && Math.max(...parts) - Math.min(...parts) <= 1;
            const sharers = entry.shares.map((share) => share.userId);
            const everyone = members.length > 1 && members.every((member) => sharers.includes(member.userId));
            const receiver = entry.shares[0]?.userId ?? "";
            const title = entry.isSettlement ? `${who(entry.paidBy)} paid ${receiver === user.id ? "you" : nameOf(receiver)} back` : entry.description;
            const enteredByOther = entry.createdBy && entry.createdBy !== entry.paidBy ? entry.createdBy : null;
            return (
              <li key={entry.id} data-testid="expense" className="flex flex-col gap-1 border-b-2 border-ink/15 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 text-lg font-semibold break-words">{title}</span>
                  <span className="type-display shrink-0 text-2xl">{money(entry.amount)}</span>
                </div>
                <p className="flex flex-wrap items-center gap-x-2 text-ink-soft">
                  {entry.isSettlement ? (
                    <>
                      {enteredByOther ? t`Marked as paid by ${who(enteredByOther) === "You" ? "you" : who(enteredByOther)}, ` : ""}
                      {timeAgo(entry.createdAt, now, household.timeZone, t)}
                    </>
                  ) : (
                    <>
                      <span aria-hidden="true">
                        <Person person={person.get(entry.paidBy)} me={user.id} size="size-6" className="font-semibold text-ink" />
                      </span>
                      <span>
                        <span className="sr-only">{who(entry.paidBy)} </span>
                        {t("paid,")}{" "}
                        {even
                          ? everyone
                            ? t("split between everyone")
                            : t`split between ${listNames(sharers, user.id, nameOf, t).replace(/^You\b/, "you")}`
                          : entry.shares.map((share) => `${who(share.userId)} ${money(share.amount)}`).join(", ")}
                        , {timeAgo(entry.createdAt, now, household.timeZone, t)}
                        {enteredByOther ? t`. Entered by ${who(enteredByOther) === "You" ? "you" : who(enteredByOther)}` : ""}
                      </span>
                    </>
                  )}
                </p>
                {mayChange ? (
                  <div className="flex flex-wrap items-start gap-x-5 gap-y-1">
                    {!entry.isSettlement ? (
                      <details className="group min-w-0 flex-1">
                        <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-1 rounded font-bold underline underline-offset-4 outline-none focus-visible:ring-4 focus-visible:ring-fjord [&::-webkit-details-marker]:hidden">
                          <span className="group-open:hidden">{t("Change")}</span>
                          <span className="hidden group-open:inline">{t("Close")}</span>
                          <span className="sr-only">: {entry.description}</span>
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
                    <ActionButton
                      look="link"
                      align="start"
                      about={title}
                      confirm={entry.isSettlement ? t`Remove this repayment of ${money(entry.amount)}? The debt comes back.` : t`Remove ${entry.description}, ${money(entry.amount)}?`}
                      action={removeExpenseAction.bind(null, entry.id)}
                    >
                      {t("Remove")}
                    </ActionButton>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
    ) : undefined;

  return (
    <AreaPage
      area="expenses"
      eyebrow={t("Expenses")}
      title={mine > 0 ? t`You're owed ${money(mine)}` : mine < 0 ? t`You owe ${money(mine)}` : t("All square")}
      aside={history}
    >
      {transfers.length > 0 ? (
        <section aria-labelledby="settle-heading" className="flex flex-col gap-1" data-testid="settle">
          <h2 id="settle-heading" className="type-display text-3xl">
            {involvesMe ? t("To get square") : t("Between the others")}
          </h2>
          <ul className="flex flex-col">
            {transfers.map((transfer) => {
              const involved = transfer.from === user.id || transfer.to === user.id || admin;
              const sentence =
                transfer.from === user.id
                  ? t`You pay ${nameOf(transfer.to)} ${money(transfer.amount)}`
                  : transfer.to === user.id
                    ? t`${nameOf(transfer.from)} pays you ${money(transfer.amount)}`
                    : t`${nameOf(transfer.from)} pays ${nameOf(transfer.to)} ${money(transfer.amount)}`;
              return (
                <li key={`${transfer.from}-${transfer.to}`} className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink/15 py-3">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-lg font-semibold">
                    <span aria-hidden="true" className="flex flex-wrap items-center gap-x-2">
                      <Person person={person.get(transfer.from)} me={user.id} />
                      {transfer.from === user.id ? t("pay") : t("pays")}
                      <Person person={person.get(transfer.to)} me={user.id} />
                      <span className="type-display text-2xl whitespace-nowrap">{money(transfer.amount)}</span>
                    </span>
                    <span className="sr-only">{sentence}</span>
                  </span>
                  {involved ? (
                    <ActionButton about={sentence} confirm={t`Mark ${money(transfer.amount)} as paid?`} action={settleAction.bind(null, transfer.from, transfer.to, transfer.amount)}>
                      {t("Paid")}
                    </ActionButton>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <p className="pt-2 text-sm text-ink-soft">
            {t("Debts are added up across the whole flat and paid the shortest way, so who you pay may not be who you shared most with. Either of the two can mark a payment as paid.")}
          </p>
        </section>
      ) : null}

      <details className="group rounded-3xl bg-heather/30 px-5" open={entries.length === 0} data-testid="add-expense">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg py-4 outline-none focus-visible:ring-4 focus-visible:ring-fjord [&::-webkit-details-marker]:hidden">
          <span className="type-display text-3xl">{t("Add an expense")}</span>
          {chevron}
        </summary>
        <div className="pb-6">
          <ExpenseForm people={people} me={user.id} currency={household.currency} />
        </div>
      </details>

      {entries.length === 0 ? (
        <p className="text-lg">
          {t("When someone pays for something for the flat, log it here or tick it off on the shopping list. Kubbe keeps track of who owes whom.")}
        </p>
      ) : null}
    </AreaPage>
  );
}
