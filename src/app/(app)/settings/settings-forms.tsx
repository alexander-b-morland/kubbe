"use client";

import { useActionState } from "react";
import { Field, FormError, SubmitButton } from "@/components/ui/form";
import type { SettingsState } from "./actions";

type Action = (previous: SettingsState, form: FormData) => Promise<SettingsState>;

const control =
  "h-12 rounded-xl border-2 border-ink bg-white/70 px-3 text-lg outline-none focus-visible:ring-4 focus-visible:ring-fjord/35";

/** "Saved", with a tick that draws itself. */
function Saved({ show }: { show?: boolean }) {
  if (!show) return null;
  return (
    <p role="status" className="flex items-center gap-2 font-bold text-spruce">
      <svg viewBox="0 0 24 24" className="tick-draw size-6" aria-hidden="true">
        <path d="M4 13C7 15 9 17 10 19C13 13 17 8 21 5" pathLength={1} />
      </svg>
      Saved
    </p>
  );
}

const clockLabel = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
const halfHours = Array.from({ length: 49 }, (_, index) => index * 30);

export type ResourceFormValues = {
  id: string;
  kind: "shower" | "washer" | "dryer";
  name: string;
  enabled: boolean;
  slotMinutes: number;
  opensAt: number;
  closesAt: number;
  maxPerDay: number;
  allowBackToBack: boolean;
  bookAheadDays: number;
};

export function ResourceForm({
  resource,
  slotLengths,
  action,
}: {
  resource: ResourceFormValues;
  slotLengths: readonly number[];
  action: Action;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const summary = resource.enabled
    ? `${resource.slotMinutes} min, ${clockLabel(resource.opensAt)} to ${clockLabel(resource.closesAt)}`
    : "Switched off";

  return (
    <details className="border-b-2 border-ink/15" data-testid={`resource-${resource.kind}`}>
      <summary className="flex cursor-pointer items-baseline justify-between gap-3 py-4 outline-none focus-visible:bg-fjord/15">
        <span className="type-display text-3xl">{resource.name}</span>
        <span className="text-ink-soft">{summary}</span>
      </summary>
      {/*
        After a save the browser resets the form to its old defaults, and a select or
        checkbox does not pick up new ones. A key made of the saved values makes React
        build the form again, so it always shows what is stored.
      */}
      <form key={JSON.stringify(resource)} action={formAction} className="flex flex-col gap-4 pb-6">
        <Field label="Name" name="name" defaultValue={resource.name} maxLength={30} required />
        <label className="flex items-center gap-3 text-lg font-semibold">
          <input type="checkbox" name="enabled" defaultChecked={resource.enabled} className="size-6 accent-ink" />
          This household has one
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Slot length</span>
          <select name="slotMinutes" defaultValue={resource.slotMinutes} className={control}>
            {slotLengths.map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes < 60 ? `${minutes} minutes` : `${minutes / 60} ${minutes === 60 ? "hour" : "hours"}`}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">Bookable from</span>
            <select name="opensAt" defaultValue={clockLabel(resource.opensAt)} className={control}>
              {halfHours.slice(0, -1).map((minutes) => (
                <option key={minutes}>{clockLabel(minutes)}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">Until</span>
            <select name="closesAt" defaultValue={clockLabel(resource.closesAt)} className={control}>
              {halfHours.slice(1).map((minutes) => (
                <option key={minutes}>{clockLabel(minutes)}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Slots per person a day" name="maxPerDay" type="number" inputMode="numeric" min={1} max={12} defaultValue={resource.maxPerDay} required />
          <Field label="Days ahead" name="bookAheadDays" type="number" inputMode="numeric" min={0} max={30} defaultValue={resource.bookAheadDays} required />
        </div>
        <label className="flex items-center gap-3 text-lg font-semibold">
          <input type="checkbox" name="allowBackToBack" defaultChecked={resource.allowBackToBack} className="size-6 accent-ink" />
          Allow two slots in a row
        </label>
        <FormError message={state?.error} />
        <Saved show={state?.saved} />
        <SubmitButton pendingLabel="Saving…">Save {resource.name.toLowerCase()}</SubmitButton>
      </form>
    </details>
  );
}

export function RenameForm({ name, action }: { name: string; action: Action }) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Field label="Household name" name="name" defaultValue={name} maxLength={40} required />
      <FormError message={state?.error} />
      <Saved show={state?.saved} />
      <SubmitButton pendingLabel="Saving…" variant="secondary">
        Save name
      </SubmitButton>
    </form>
  );
}

export function ProfileForm({
  name,
  colour,
  colours,
  action,
}: {
  name: string;
  colour: string;
  colours: readonly string[];
  action: Action;
}) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form key={`${name}-${colour}`} action={formAction} className="flex flex-col gap-4">
      <Field label="Your name" name="name" defaultValue={name} maxLength={60} autoComplete="given-name" required />
      <fieldset className="flex flex-col gap-2">
        <legend className="pb-2 text-sm font-semibold">Your colour</legend>
        <div className="flex flex-wrap gap-3">
          {colours.map((option, index) => (
            <label key={option} className="relative">
              <input type="radio" name="colour" value={option} defaultChecked={option === colour} className="peer sr-only" />
              <span
                className="block size-11 rounded-full border-2 border-transparent outline-offset-2 peer-checked:outline-4 peer-checked:outline-ink peer-focus-visible:ring-4 peer-focus-visible:ring-fjord/35"
                style={{ backgroundColor: option }}
              />
              <span className="sr-only">Colour {index + 1}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <FormError message={state?.error} />
      <Saved show={state?.saved} />
      <SubmitButton pendingLabel="Saving…" variant="secondary">
        Save
      </SubmitButton>
    </form>
  );
}

// The confirm-then-do button lives with the other shared controls.
export { ActionButton as MemberAction } from "@/components/ui/action-button";
