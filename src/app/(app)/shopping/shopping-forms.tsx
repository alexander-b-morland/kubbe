"use client";

import { useActionState, type ReactNode } from "react";
import { Field, FormError, SubmitButton } from "@/components/ui/form";
import { addItemAction, payForBoughtAction } from "./actions";

/** Add one thing to the list. */
export function AddItemForm({ count }: { count: number }) {
  const [state, formAction] = useActionState(addItemAction, undefined);
  return (
    // Built again after each addition, so the field starts empty.
    <form key={count} action={formAction} noValidate className="flex flex-col gap-3">
      <Field label="Add to the list" name="name" placeholder="Oat milk" maxLength={60} defaultValue={state?.values?.name} autoComplete="off" />
      <FormError message={state?.error} />
      <SubmitButton pendingLabel="Adding…">Add</SubmitButton>
    </form>
  );
}

/** "What did you pay for what you ticked off?" The answer becomes an expense. */
export function PayForm({ children }: { children: ReactNode }) {
  const [state, formAction] = useActionState(payForBoughtAction, undefined);
  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <Field
        label="What did you pay for these?"
        name="amount"
        inputMode="decimal"
        placeholder="349,50"
        defaultValue={state?.values?.amount}
        autoComplete="off"
      />
      {children}
      <FormError message={state?.error} />
      <SubmitButton pendingLabel="Splitting…" variant="secondary">
        Split the cost
      </SubmitButton>
    </form>
  );
}
