"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { FormError, Saved, SubmitButton } from "@/components/ui/form";
import { useT } from "@/lib/i18n/client";

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
  /** Keep the Save button at the bottom of the screen: for a form longer than the screen. */
  sticky?: boolean;
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

function Fields({ action, state, children, saveLabel, variant = "secondary", autoSave = false, sticky = false }: Omit<Props, "resetKey">) {
  const t = useT();
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
        sticky ? (
          // Above the navigation bar on a phone, at the foot of the window on a laptop.
          <div className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[5] rounded-full bg-paper shadow-[0_0_0_6px_var(--color-paper)] lg:bottom-6" data-testid="sticky-save">
            <SubmitButton pendingLabel={t("Saving…")} variant={variant}>
              {saveLabel ?? t("Save")}
            </SubmitButton>
          </div>
        ) : (
          <SubmitButton pendingLabel={t("Saving…")} variant={variant}>
            {saveLabel ?? t("Save")}
          </SubmitButton>
        )
      ) : null}
    </form>
  );
}
