"use client";

import { useRef, useState, type ComponentProps, type FormEvent, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

// The gap of paper between the ring and what it surrounds keeps it visible on dark buttons too.
export const focusRing = "outline-none focus-visible:ring-4 focus-visible:ring-fjord focus-visible:ring-offset-2 focus-visible:ring-offset-paper";

/** The look of a select, sized to sit beside a text field. */
export const selectLook = `h-12 rounded-xl border-2 border-ink bg-white/70 px-3 text-lg ${focusRing}`;

// Two conflicting Tailwind size classes do not resolve by order, so the look is chosen here.
const inputLook = {
  text: "text-lg",
  // The placeholder is lighter and unspaced, so an example code does not look filled in.
  code: "type-display text-3xl tracking-widest uppercase placeholder:font-sans placeholder:text-lg placeholder:font-normal placeholder:tracking-normal placeholder:normal-case",
};

type FieldProps = { label: string; hint?: string; look?: keyof typeof inputLook } & ComponentProps<"input">;

export function Field({ label, hint, look = "text", ...input }: FieldProps) {
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

/**
 * A password field with a way to see what was typed. Without it, one slip on a phone
 * keyboard locks someone out, since there is no password reset yet.
 */
export function PasswordField({ label, hint, ...input }: Omit<FieldProps, "type" | "look">) {
  const [shown, setShown] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={input.id ?? input.name} className="text-sm font-semibold">
        {label}
      </label>
      <div className="relative">
        <input
          {...input}
          id={input.id ?? input.name}
          type={shown ? "text" : "password"}
          className={`h-14 w-full rounded-xl border-2 border-ink bg-white/70 pr-20 pl-4 text-lg placeholder:text-ink-soft ${focusRing}`}
        />
        <button
          type="button"
          onClick={() => setShown((value) => !value)}
          aria-pressed={shown}
          aria-label={shown ? "Hide password" : "Show password"}
          className={`absolute inset-y-1.5 right-1.5 rounded-lg px-3 text-sm font-bold ${focusRing}`}
        >
          {shown ? "Hide" : "Show"}
        </button>
      </div>
      {hint ? <span className="text-sm text-ink-soft">{hint}</span> : null}
    </div>
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
    variant === "primary" ? "area-button" : "border-2 border-ink bg-transparent text-ink";
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

/**
 * The fields of a form, held still while it is being saved. Without this, what someone
 * types during a slow save is wiped when the form starts over, and they never know.
 */
export function Locked({ children, className = "contents" }: { children: ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <fieldset disabled={pending} className={className}>
      {children}
    </fieldset>
  );
}

type QuickResult = { error?: string } | undefined;

/**
 * One field and a button, for adding things to a list one after another. The field
 * empties the moment you press Add, so the next thing can be typed straight away, and
 * what was sent waits its turn. Nothing typed is ever thrown away: if the server says
 * no, the text comes back with the reason.
 */
export function QuickAddForm({
  action,
  name,
  label,
  placeholder,
  button = "Add",
  variant = "primary",
}: {
  action: (previous: undefined, form: FormData) => Promise<QuickResult>;
  name: string;
  label: string;
  placeholder?: string;
  button?: string;
  variant?: "primary" | "secondary";
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string>();
  const [waiting, setWaiting] = useState(0);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const input = useRef<HTMLInputElement>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const text = value;
    setValue("");
    setError(undefined);
    setWaiting((count) => count + 1);
    input.current?.focus();
    queue.current = queue.current.then(async () => {
      const form = new FormData();
      form.set(name, text);
      let problem: string | undefined;
      try {
        problem = (await action(undefined, form))?.error;
      } catch {
        problem = "Couldn't reach Kubbe. Check your connection and try again.";
      }
      if (problem) {
        setError(problem);
        // Give the text back, unless something new has been typed since.
        setValue((current) => (current === "" ? text : current));
      }
      setWaiting((count) => count - 1);
    });
  }

  const look = variant === "primary" ? "area-button" : "border-2 border-ink bg-transparent text-ink";
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">{label}</span>
        <input
          ref={input}
          name={name}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            if (error) setError(undefined);
          }}
          placeholder={placeholder}
          autoComplete="off"
          className={`h-14 w-full rounded-xl border-2 border-ink bg-white/70 px-4 text-lg placeholder:text-ink-soft ${focusRing}`}
        />
      </label>
      <FormError message={error} />
      <button type="submit" className={`h-14 w-full rounded-full px-6 text-lg font-bold transition-transform active:scale-[0.98] ${look} ${focusRing}`}>
        {button}
      </button>
      <p role="status" className="min-h-5 text-sm font-semibold text-ink-soft">
        {waiting > 0 ? (waiting === 1 ? "Adding…" : `Adding ${waiting}…`) : ""}
      </p>
    </form>
  );
}

/**
 * How much room is left in a text box, said once it is nearly full. Without it, a
 * long note is simply refused, or worse, cut.
 */
export function Remaining({ used, max }: { used: number; max: number }) {
  const left = max - used;
  if (left > max * 0.2) return null;
  return (
    <span role="status" className={`text-sm font-semibold ${left < 0 ? "text-barn" : "text-ink-soft"}`}>
      {left >= 0 ? (left === 1 ? "1 character left" : `${left} characters left`) : `${-left} too many. Shorten it to save.`}
    </span>
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

/** "Saved", with a tick that draws itself. */
export function Saved({ show, children = "Saved" }: { show?: boolean; children?: ReactNode }) {
  if (!show) return null;
  return (
    <p role="status" className="flex items-center gap-2 font-bold text-spruce">
      <svg viewBox="0 0 24 24" className="tick-draw size-6 shrink-0" aria-hidden="true">
        <path d="M4 13C7 15 9 17 10 19C13 13 17 8 21 5" pathLength={1} />
      </svg>
      {children}
    </p>
  );
}
