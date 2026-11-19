"use client";

import { useActionState, useState } from "react";
import { SplitFields } from "@/components/money/split-fields";
import { Field, FormError, Locked, Saved, selectLook, SubmitButton } from "@/components/ui/form";
import { formatAmount } from "@/lib/money";
import { addExpenseAction, updateExpenseAction, type ExpenseState } from "./actions";
import { useT } from "@/lib/i18n/client";

type Person = { userId: string; name: string };

type Existing = { id: string; description: string; amount: number; paidBy: string; shares: Record<string, number> };

/** Log something one person paid for, or correct one that is already logged. */
export function ExpenseForm({
  people,
  me,
  currency,
  existing,
}: {
  people: Person[];
  me: string;
  currency: string;
  existing?: Existing;
}) {
  const t = useT();
  // After a new expense is added, the parts start empty again. Counting our own saves,
  // not the list's length: someone else's expense must not wipe a form being filled in.
  const [round, setRound] = useState(0);
  const [state, formAction] = useActionState(async (previous: ExpenseState, form: FormData) => {
    const result = await (existing ? updateExpenseAction.bind(null, existing.id) : addExpenseAction)(previous, form);
    if (result?.saved && !existing) setRound((value) => value + 1);
    return result;
  }, undefined);
  // Someone who paid but has moved out stays selectable while correcting their expense.
  const payers = existing && !people.some((person) => person.userId === existing.paidBy) ? [...people, { userId: existing.paidBy, name: t("Someone who moved out") }] : people;
  return (
    <form key={existing ? JSON.stringify(existing) : "new"} action={formAction} noValidate className="flex flex-col gap-4">
      <Locked>
      <Field
        label={t("What was it for")}
        name="description"
        placeholder={t("Toilet paper and dish soap")}
        maxLength={80}
        defaultValue={state?.values?.description ?? existing?.description}
      />
      <Field
        label={t("Amount")}
        name="amount"
        inputMode="decimal"
        placeholder="349,50"
        defaultValue={state?.values?.amount ?? (existing ? formatAmount(existing.amount, "").trim() : undefined)}
        autoComplete="off"
      />
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">{t("Who paid")}</span>
        <select name="paidBy" defaultValue={existing?.paidBy ?? me} className={selectLook}>
          {payers.map((person) => (
            <option key={person.userId} value={person.userId}>
              {person.userId === me ? t`${person.name} (you)` : person.name}
            </option>
          ))}
        </select>
      </label>
      <SplitFields key={round} people={people} currency={currency} initial={existing?.shares} />
      </Locked>
      <FormError message={state?.error} />
      <Saved show={Boolean(existing) && state?.saved} />
      <SubmitButton pendingLabel={existing ? t("Saving…") : t("Adding…")} variant={existing ? "secondary" : "primary"}>
        {existing ? t("Save") : t("Add expense")}
      </SubmitButton>
    </form>
  );
}
