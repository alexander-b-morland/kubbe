"use client";

import { useActionState } from "react";
import { SplitFields } from "@/components/money/split-fields";
import { Field, FormError, Saved, selectLook, SubmitButton } from "@/components/ui/form";
import { formatAmount } from "@/lib/money";
import { addExpenseAction, updateExpenseAction } from "./actions";

type Person = { userId: string; name: string };

type Existing = { id: string; description: string; amount: number; paidBy: string; shares: Record<string, number> };

/** Log something one person paid for, or correct one that is already logged. */
export function ExpenseForm({
  people,
  me,
  currency,
  count,
  existing,
}: {
  people: Person[];
  me: string;
  currency: string;
  /** Changes after each new expense, so the empty form starts over. */
  count?: number;
  existing?: Existing;
}) {
  const [state, formAction] = useActionState(existing ? updateExpenseAction.bind(null, existing.id) : addExpenseAction, undefined);
  // Someone who paid but has moved out stays selectable while correcting their expense.
  const payers = existing && !people.some((person) => person.userId === existing.paidBy) ? [...people, { userId: existing.paidBy, name: "Someone who moved out" }] : people;
  return (
    <form key={existing ? JSON.stringify(existing) : count} action={formAction} noValidate className="flex flex-col gap-4">
      <Field
        label="What was it for"
        name="description"
        placeholder="Toilet paper and dish soap"
        maxLength={80}
        defaultValue={state?.values?.description ?? existing?.description}
      />
      <Field
        label="Amount"
        name="amount"
        inputMode="decimal"
        placeholder="349,50"
        defaultValue={state?.values?.amount ?? (existing ? formatAmount(existing.amount, "").trim() : undefined)}
        autoComplete="off"
      />
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Who paid</span>
        <select name="paidBy" defaultValue={existing?.paidBy ?? me} className={selectLook}>
          {payers.map((person) => (
            <option key={person.userId} value={person.userId}>
              {person.userId === me ? `${person.name} (you)` : person.name}
            </option>
          ))}
        </select>
      </label>
      <SplitFields people={people} currency={currency} initial={existing?.shares} />
      <FormError message={state?.error} />
      <Saved show={Boolean(existing) && state?.saved} />
      <SubmitButton pendingLabel={existing ? "Saving…" : "Adding…"} variant={existing ? "secondary" : "primary"}>
        {existing ? "Save" : "Add expense"}
      </SubmitButton>
    </form>
  );
}
