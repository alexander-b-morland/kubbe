"use client";

import { useActionState, type ReactNode } from "react";
import { Field, FormError, Locked, QuickAddForm, SubmitButton } from "@/components/ui/form";
import { addItemAction, payForBoughtAction } from "./actions";

/** Add things to the list, one after another. */
export function AddItemForm() {
  return <QuickAddForm action={addItemAction} name="name" label="Add to the list" placeholder="Oat milk" />;
}

/** "What did you pay for what you ticked off?" The answer becomes an expense. */
export function PayForm({ children }: { children: ReactNode }) {
  const [state, formAction] = useActionState(payForBoughtAction, undefined);
  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <Locked>
        <Field
          label="What did you pay for these?"
          name="amount"
          inputMode="decimal"
          placeholder="349,50"
          defaultValue={state?.values?.amount}
          autoComplete="off"
        />
        {children}
      </Locked>
      <FormError message={state?.error} />
      <SubmitButton pendingLabel="Splitting…" variant="secondary">
        Split the cost
      </SubmitButton>
    </form>
  );
}
