"use client";

import { useActionState, useSyncExternalStore } from "react";
import { Field, FormError, SubmitButton } from "@/components/ui/form";
import { createHouseholdAction, joinHouseholdAction } from "./actions";
import { useT } from "@/lib/i18n/client";

const noSubscription = () => () => {};

export function CreateHouseholdForm() {
  const t = useT();
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
        label={t("Household name")}
        name="name"
        placeholder={t("Kollektivet")}
        maxLength={40}
        defaultValue={state?.values?.name}
        required
      />
      {timeZone ? (
        <p className="text-sm text-ink-soft" data-testid="zone-note">
          {t`Times will be shown in ${timeZone.replaceAll("_", " ")} time, taken from this device. You can change that under Household.`}
        </p>
      ) : null}
      <FormError message={state?.error} />
      <SubmitButton pendingLabel={t("Creating household…")}>{t("Create household")}</SubmitButton>
    </form>
  );
}

export function JoinHouseholdForm({ code }: { code?: string }) {
  const t = useT();
  const [state, action] = useActionState(joinHouseholdAction, undefined);
  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <Field
        label={t("Join code")}
        name="code"
        placeholder={t("ABC D2F")}
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        maxLength={12}
        defaultValue={state?.values?.code ?? code}
        look="code"
      />
      <FormError message={state?.error} />
      <SubmitButton pendingLabel={t("Joining…")} variant="secondary">
        {t("Join household")}
      </SubmitButton>
    </form>
  );
}

/** Joining from an invite link: the code is already known, so there is one button. */
export function JoinByLinkForm({ code, name }: { code: string; name: string }) {
  const t = useT();
  const [state, action] = useActionState(joinHouseholdAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="code" value={code} />
      <FormError message={state?.error} />
      <SubmitButton pendingLabel={t("Joining…")}>{t`Join ${name}`}</SubmitButton>
    </form>
  );
}
