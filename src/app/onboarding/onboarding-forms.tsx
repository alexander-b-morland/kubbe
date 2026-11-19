"use client";

import { useActionState, useSyncExternalStore } from "react";
import { Field, FormError, SubmitButton } from "@/components/ui/form";
import { createHouseholdAction, joinHouseholdAction } from "./actions";

const noSubscription = () => () => {};

export function CreateHouseholdForm() {
  const [state, action] = useActionState(createHouseholdAction, undefined);
  // The household's time zone starts as the creator's. Slots are worked out in it.
  const timeZone = useSyncExternalStore(
    noSubscription,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => "",
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="timeZone" value={timeZone} />
      <Field
        label="Household name"
        name="name"
        placeholder="Kollektivet"
        maxLength={40}
        defaultValue={state?.values?.name}
        required
      />
      {timeZone ? (
        <p className="text-sm text-ink-soft" data-testid="zone-note">
          Times will be shown in {timeZone.replaceAll("_", " ")} time, taken from this device. You can change that under Household.
        </p>
      ) : null}
      <FormError message={state?.error} />
      <SubmitButton pendingLabel="Creating household…">Create household</SubmitButton>
    </form>
  );
}

export function JoinHouseholdForm({ code }: { code?: string }) {
  const [state, action] = useActionState(joinHouseholdAction, undefined);
  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <Field
        label="Join code"
        name="code"
        placeholder="ABC D2F"
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        maxLength={12}
        defaultValue={state?.values?.code ?? code}
        look="code"
      />
      <FormError message={state?.error} />
      <SubmitButton pendingLabel="Joining…" variant="secondary">
        Join household
      </SubmitButton>
    </form>
  );
}

/** Joining from an invite link: the code is already known, so there is one button. */
export function JoinByLinkForm({ code, name }: { code: string; name: string }) {
  const [state, action] = useActionState(joinHouseholdAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="code" value={code} />
      <FormError message={state?.error} />
      <SubmitButton pendingLabel="Joining…">Join {name}</SubmitButton>
    </form>
  );
}
