"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";

type Result = { error?: string; saved?: boolean } | undefined;

const base =
  "min-h-11 rounded-full border-2 py-1.5 text-sm font-bold outline-none transition-transform focus-visible:ring-4 focus-visible:ring-fjord active:scale-[0.97]";

/**
 * A small button that runs one server action and shows what went wrong, if anything.
 *
 * With `confirm`, the first press only asks: the button turns into that question, next
 * to a way out. Nothing happens until the question itself is pressed.
 */
export function ActionButton({
  children,
  confirm,
  look = "outline",
  pendingLabel = "Working…",
  doneLabel,
  label,
  align = "end",
  action,
}: {
  children: ReactNode;
  /** The question to ask before doing it, worded as what will happen. */
  confirm?: string;
  look?: "outline" | "filled" | "link";
  pendingLabel?: string;
  /** Shown for a moment after the action succeeds, when the screen itself would not show it. */
  doneLabel?: string;
  /** Accessible name, when the visible text alone does not say what it acts on. */
  label?: string;
  align?: "start" | "end";
  action: () => Promise<Result>;
}) {
  const [state, formAction, pending] = useActionState<Result>(action, undefined);
  const [asking, setAsking] = useState(false);
  const question = useRef<HTMLButtonElement>(null);

  // Put the keyboard and screen reader on the question when it appears.
  useEffect(() => {
    if (asking) question.current?.focus();
  }, [asking]);

  const colours =
    look === "filled"
      ? "border-ink bg-ink px-4 text-paper"
      : look === "link"
        ? "rounded border-transparent text-base underline underline-offset-4"
        : "border-ink px-4";
  const edge = align === "end" ? "items-end" : "items-start";

  return (
    <form action={formAction} className={`flex flex-col gap-1 ${edge}`}>
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
      ) : confirm ? (
        <span className={`flex flex-wrap gap-2 ${align === "end" ? "justify-end" : "justify-start"}`}>
          <button key="back" type="button" onClick={() => setAsking(false)} className={`${base} border-ink px-4`}>
            Keep as it is
          </button>
          <button
            key="do"
            ref={question}
            type="submit"
            aria-disabled={pending}
            className={`${base} border-barn bg-barn px-4 text-left text-paper ${pending ? "opacity-70" : ""}`}
          >
            {pending ? pendingLabel : confirm}
          </button>
        </span>
      ) : (
        <button
          key="do"
          type="submit"
          aria-label={label}
          aria-disabled={pending}
          className={`${base} ${colours} ${pending ? "opacity-70" : ""}`}
        >
          {pending ? pendingLabel : children}
        </button>
      )}
      {state?.error ? (
        <p role="alert" className={`max-w-64 text-sm font-semibold text-barn ${align === "end" ? "text-right" : ""}`}>
          {state.error}
        </p>
      ) : null}
      {state?.saved && doneLabel ? (
        <p role="status" className="text-sm font-bold text-spruce">
          {doneLabel}
        </p>
      ) : null}
    </form>
  );
}
