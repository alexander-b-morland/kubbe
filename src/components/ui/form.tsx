"use client";

import type { ComponentProps, ReactNode } from "react";
import { useFormStatus } from "react-dom";

const focusRing = "outline-none focus-visible:ring-4 focus-visible:ring-fjord/35";

// Two conflicting Tailwind size classes do not resolve by order, so the look is chosen here.
const inputLook = {
  text: "text-lg",
  code: "type-display text-3xl tracking-widest uppercase",
};

export function Field({
  label,
  hint,
  look = "text",
  ...input
}: { label: string; hint?: string; look?: keyof typeof inputLook } & ComponentProps<"input">) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold">{label}</span>
      <input
        {...input}
        className={`h-14 w-full rounded-xl border-2 border-ink bg-white/70 px-4 placeholder:text-ink-soft ${inputLook[look]} ${focusRing}`}
      />
      {hint ? <span className="text-sm text-ink-soft">{hint}</span> : null}
    </label>
  );
}

export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
}: {
  children: ReactNode;
  pendingLabel: string;
  variant?: "primary" | "secondary";
}) {
  const { pending } = useFormStatus();
  const look =
    variant === "primary" ? "bg-ink text-paper" : "border-2 border-ink bg-transparent text-ink";
  return (
    <button
      type="submit"
      aria-disabled={pending}
      onClick={(event) => {
        if (pending) event.preventDefault();
      }}
      className={`h-14 w-full rounded-full px-6 text-lg font-bold transition-transform active:scale-[0.98] ${look} ${focusRing} ${pending ? "opacity-70" : ""}`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" data-testid="form-error" className="rounded-xl border-2 border-barn px-4 py-3 font-semibold text-barn">
      {message}
    </p>
  );
}
