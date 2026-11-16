"use client";

import { useActionState } from "react";
import { Field, FormError, PasswordField, SubmitButton } from "@/components/ui/form";
import { signIn, signUp } from "./actions";

// noValidate: the server's own messages are shown, in the app's words, not the browser's bubbles.

export function SignUpForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signUp, undefined);
  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Field label="Your name" name="name" autoComplete="given-name" placeholder="Ida" defaultValue={state?.values?.name} />
      <Field label="Email" name="email" type="email" autoComplete="email" inputMode="email" placeholder="ida@example.com" defaultValue={state?.values?.email} />
      <PasswordField
        label="Password"
        name="password"
        autoComplete="new-password"
        hint="At least 8 characters. There is no password reset yet, so pick one you will remember."
      />
      <FormError message={state?.error} />
      <SubmitButton pendingLabel="Creating account…">Create account</SubmitButton>
    </form>
  );
}

export function SignInForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signIn, undefined);
  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Field label="Email" name="email" type="email" autoComplete="email" inputMode="email" placeholder="ida@example.com" defaultValue={state?.values?.email} />
      <PasswordField label="Password" name="password" autoComplete="current-password" />
      <FormError message={state?.error} />
      <SubmitButton pendingLabel="Signing in…">Sign in</SubmitButton>
    </form>
  );
}
