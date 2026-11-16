"use client";

import { useActionState, useState, type ReactNode } from "react";

type Result = { error?: string } | undefined;

/**
 * A small button that runs one server action and shows what went wrong, if anything.
 * With `confirm`, the first press only turns the button into that question.
 */
export function ActionButton({
  children,
  confirm,
  look = "outline",
  pendingLabel = "Working…",
  label,
  action,
}: {
  children: ReactNode;
  confirm?: string;
  look?: "outline" | "filled";
  pendingLabel?: string;
  /** Accessible name, when the visible text alone is not enough. */
  label?: string;
  action: () => Promise<Result>;
}) {
  const [state, formAction, pending] = useActionState<Result>(action, undefined);
  const [asking, setAsking] = useState(false);
  const base =
    "h-11 rounded-full border-2 px-4 text-sm font-bold outline-none transition-transform focus-visible:ring-4 focus-visible:ring-fjord/35 active:scale-[0.97]";
  const colours = look === "filled" ? "border-ink bg-ink text-paper" : "border-ink";

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      {confirm && !asking ? (
        // The two buttons have different keys so React makes a new element for the question.
        // Reusing one element would turn it into a submit button during the first press,
        // and the browser would then submit the form with that same press.
        <button
          key="ask"
          type="button"
          aria-label={label}
          onClick={(event) => {
            event.preventDefault();
            setAsking(true);
          }}
          className={`${base} ${colours}`}
        >
          {children}
        </button>
      ) : (
        <button
          key="do"
          type="submit"
          aria-label={confirm ? undefined : label}
          aria-disabled={pending}
          className={`${base} ${confirm ? "border-barn bg-barn text-paper" : colours} ${pending ? "opacity-70" : ""}`}
        >
          {pending ? pendingLabel : (confirm ?? children)}
        </button>
      )}
      {state?.error ? (
        <p role="alert" className="max-w-56 text-right text-sm font-semibold text-barn">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
