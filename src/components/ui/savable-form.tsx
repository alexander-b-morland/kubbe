"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { FormError, Saved, SubmitButton } from "@/components/ui/form";

type Props = {
  /** The form action from `useActionState`. */
  action: (form: FormData) => void;
  /** What the last save returned. */
  state: { error?: string; saved?: boolean } | undefined;
  /**
   * Changes whenever the stored values change. The form is then built again, so it
   * shows what is stored and counts as untouched.
   */
  resetKey: string;
  children: ReactNode;
  saveLabel?: string;
  variant?: "primary" | "secondary";
  /** Save as soon as something is picked, with no button at all. For a single select. */
  autoSave?: boolean;
};

const read = (form: HTMLFormElement | null) =>
  form ? JSON.stringify([...new FormData(form)].map(([name, value]) => [name, String(value)])) : "";

/**
 * A form for settings that already have a value. There is nothing to save until
 * something is changed, so the Save button only appears then.
 */
export function SavableForm({ resetKey, ...props }: Props) {
  return <Fields key={resetKey} {...props} />;
}

function Fields({ action, state, children, saveLabel = "Save", variant = "secondary", autoSave = false }: Omit<Props, "resetKey">) {
  const form = useRef<HTMLFormElement>(null);
  const stored = useRef("");
  const [changed, setChanged] = useState(false);

  // Remember what the form held when it was built: that is what is stored.
  useEffect(() => {
    stored.current = read(form.current);
  }, []);

  function compare() {
    const differs = read(form.current) !== stored.current;
    setChanged(differs);
    if (differs && autoSave) form.current?.requestSubmit();
  }

  return (
    <form
      ref={form}
      action={action}
      noValidate
      onInput={compare}
      onChange={compare}
      // After a save that was refused, the browser puts the old values back.
      onReset={() => setTimeout(compare)}
      className="flex flex-col gap-4"
    >
      {children}
      <FormError message={state?.error} />
      <Saved show={state?.saved && !changed} />
      {changed && !autoSave ? (
        <SubmitButton pendingLabel="Saving…" variant={variant}>
          {saveLabel}
        </SubmitButton>
      ) : null}
    </form>
  );
}
