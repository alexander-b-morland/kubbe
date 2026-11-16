"use client";

import { useActionState } from "react";
import { Field, FormError, SubmitButton } from "@/components/ui/form";
import { signIn, signUp } from "./actions";

export function SignUpForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signUp, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Field label="Your name" name="name" autoComplete="given-name" placeholder="Ida" defaultValue={state?.values?.name} required />
      <Field label="Email" name="email" type="email" autoComplete="email" inputMode="email" placeholder="ida@example.com" defaultValue={state?.values?.email} required />
      <Field label="Password" name="password" type="password" autoComplete="new-password" hint="At least 8 characters." minLength={8} required />
      <FormError message={state?.error} />
      <SubmitButton pendingLabel="Creating account…">Create account</SubmitButton>
    </form>
  );
}

export function SignInForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signIn, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Field label="Email" name="email" type="email" autoComplete="email" inputMode="email" placeholder="ida@example.com" defaultValue={state?.values?.email} required />
      <Field label="Password" name="password" type="password" autoComplete="current-password" required />
      <FormError message={state?.error} />
      <SubmitButton pendingLabel="Signing in…">Sign in</SubmitButton>
    </form>
  );
}
