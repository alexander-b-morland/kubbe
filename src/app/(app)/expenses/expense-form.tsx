"use client";

import { useActionState, type ReactNode } from "react";
import { Field, FormError, selectLook, SubmitButton } from "@/components/ui/form";
import { addExpenseAction } from "./actions";

/** Log something one person paid for, outside the shopping list. */
export function ExpenseForm({
  people,
  me,
  count,
  children,
}: {
  people: { userId: string; name: string }[];
  me: string;
  count: number;
  children: ReactNode;
}) {
  const [state, formAction] = useActionState(addExpenseAction, undefined);
  return (
    // Built again after each expense, so the fields start empty.
    <form key={count} action={formAction} noValidate className="flex flex-col gap-4">
      <Field label="What was it for" name="description" placeholder="Toilet paper and dish soap" maxLength={80} defaultValue={state?.values?.description} />
      <Field label="Amount" name="amount" inputMode="decimal" placeholder="349,50" defaultValue={state?.values?.amount} autoComplete="off" />
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Who paid</span>
        <select name="paidBy" defaultValue={me} className={selectLook}>
          {people.map((person) => (
            <option key={person.userId} value={person.userId}>
              {person.userId === me ? `${person.name} (you)` : person.name}
            </option>
          ))}
        </select>
      </label>
      {children}
      <FormError message={state?.error} />
      <SubmitButton pendingLabel="Adding…">Add expense</SubmitButton>
    </form>
  );
}
