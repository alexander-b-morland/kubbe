"use client";

import { useActionState } from "react";
import { Field, FormError, PasswordField, SubmitButton } from "@/components/ui/form";
import { signIn, signUp } from "./actions";
import { useT } from "@/lib/i18n/client";

// noValidate: the server's own messages are shown, in the app's words, not the browser's bubbles.

export function SignUpForm({ next }: { next?: string }) {
  const t = useT();
  const [state, action] = useActionState(signUp, undefined);
  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Field label={t("Your name")} name="name" autoComplete="given-name" placeholder={t("Ida")} defaultValue={state?.values?.name} />
      <Field label={t("Email")} name="email" type="email" autoComplete="email" inputMode="email" placeholder={t("ida@example.com")} defaultValue={state?.values?.email} />
      <PasswordField
        label={t("Password")}
        name="password"
        autoComplete="new-password"
        hint={t("At least 8 characters. There is no password reset yet, so pick one you will remember.")}
      />
      <FormError message={state?.error} />
      <SubmitButton pendingLabel={t("Creating account…")}>{t("Create account")}</SubmitButton>
    </form>
  );
}

export function SignInForm({ next }: { next?: string }) {
  const t = useT();
  const [state, action] = useActionState(signIn, undefined);
  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Field label={t("Email")} name="email" type="email" autoComplete="email" inputMode="email" placeholder={t("ida@example.com")} defaultValue={state?.values?.email} />
      <PasswordField label={t("Password")} name="password" autoComplete="current-password" />
      <FormError message={state?.error} />
      <SubmitButton pendingLabel={t("Signing in…")}>{t("Sign in")}</SubmitButton>
    </form>
  );
}
