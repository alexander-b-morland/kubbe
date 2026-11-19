"use client";

import { useActionState, useRef } from "react";
import { ActionButton } from "@/components/ui/action-button";
import { Field, FormError, Locked, selectLook, SubmitButton } from "@/components/ui/form";
import { SavableForm } from "@/components/ui/savable-form";
import { describeInterval } from "@/lib/cleaning/rota";
import type { CleaningState } from "./actions";

type Action = (previous: CleaningState, form: FormData) => Promise<CleaningState>;

function RhythmFields({
  intervals,
  estimates,
  intervalDays,
  estimateMinutes,
}: {
  intervals: readonly number[];
  estimates: readonly number[];
  intervalDays: number;
  estimateMinutes: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">How often</span>
        <select name="intervalDays" defaultValue={intervalDays} className={selectLook}>
          {intervals.map((days) => (
            <option key={days} value={days}>
              {describeInterval(days)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Takes about</span>
        <select name="estimateMinutes" defaultValue={estimateMinutes} className={selectLook}>
          {estimates.map((minutes) => (
            <option key={minutes} value={minutes}>
              {minutes} min
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

// Rooms and everyday chores, each with a rhythm that usually fits. Tapping one fills the form.
const suggestions = [
  { name: "Bathroom", days: 7, minutes: 30 },
  { name: "Kitchen", days: 7, minutes: 30 },
  { name: "Living room", days: 7, minutes: 20 },
  { name: "Hallway", days: 14, minutes: 15 },
  { name: "Empty the dishwasher", days: 1, minutes: 5 },
  { name: "Take out the trash", days: 3, minutes: 5 },
  { name: "Recycling", days: 14, minutes: 15 },
  { name: "Water the plants", days: 7, minutes: 10 },
] as const;

export function AddAreaForm({
  intervals,
  estimates,
  existing,
  today,
  action,
}: {
  intervals: readonly number[];
  estimates: readonly number[];
  existing: string[];
  /** Today in the household's zone: the day a new rota starts unless another is picked. */
  today: string;
  action: Action;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const nameInput = useRef<HTMLInputElement>(null);
  const unused = suggestions.filter((idea) => !existing.some((other) => other.toLowerCase() === idea.name.toLowerCase()));

  function fill(idea: (typeof suggestions)[number]) {
    const input = nameInput.current;
    if (!input?.form) return;
    input.value = idea.name;
    const select = (name: string) => input.form?.elements.namedItem(name) as HTMLSelectElement | null;
    const often = select("intervalDays");
    const takes = select("estimateMinutes");
    if (often) often.value = String(idea.days);
    if (takes) takes.value = String(idea.minutes);
  }

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <Locked>
      <Field ref={nameInput} label="Room or chore" name="name" placeholder="Bathroom" maxLength={30} defaultValue={state?.values?.name} />
      {unused.length > 0 ? (
        <div className="flex flex-wrap gap-2" aria-label="Suggestions">
          {unused.map((idea) => (
            <button
              key={idea.name}
              type="button"
              onClick={() => fill(idea)}
              className="min-h-11 rounded-full border-2 border-ink px-4 text-sm font-semibold outline-none focus-visible:ring-4 focus-visible:ring-fjord"
            >
              {idea.name}
            </button>
          ))}
        </div>
      ) : null}
      <RhythmFields intervals={intervals} estimates={estimates} intervalDays={7} estimateMinutes={30} />
      <Field
        label="First turn starts"
        hint="Turns change hands on this day. Weekly from a Friday means every Friday."
        name="startDay"
        type="date"
        defaultValue={today}
      />
      </Locked>
      <FormError message={state?.error} />
      <SubmitButton pendingLabel="Adding…">Add</SubmitButton>
    </form>
  );
}

export function EditAreaForm({
  area,
  intervals,
  estimates,
  action,
  remove,
}: {
  area: { id: string; name: string; intervalDays: number; estimateMinutes: number; startDay: string };
  intervals: readonly number[];
  estimates: readonly number[];
  action: Action;
  remove: () => Promise<CleaningState>;
}) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <details className="group border-b-2 border-ink/15">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg py-3 outline-none focus-visible:ring-4 focus-visible:ring-fjord [&::-webkit-details-marker]:hidden">
        <span className="flex flex-col">
          <span className="text-lg font-semibold">{area.name}</span>
          <span className="text-ink-soft">
            {describeInterval(area.intervalDays)}, about {area.estimateMinutes} min
          </span>
        </span>
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6 shrink-0 transition-transform group-open:rotate-180">
          <path d="M5 9C8 12 10 14 12 16C14 14 16 12 19 9" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
        </svg>
      </summary>
      <div className="flex flex-col gap-4 pb-5">
        <SavableForm action={formAction} state={state} resetKey={JSON.stringify(area)}>
          <Field label="Name" name="name" defaultValue={area.name} maxLength={30} />
          <RhythmFields intervals={intervals} estimates={estimates} intervalDays={area.intervalDays} estimateMinutes={area.estimateMinutes} />
          <Field label="First turn started, or starts" name="startDay" type="date" defaultValue={area.startDay} />
          <p className="text-sm text-ink-soft">
            Turns change hands on that day&apos;s rhythm. Changing the day or how often starts its turns over, and clears who has done it.
          </p>
        </SavableForm>
        <div className="flex justify-start">
          <ActionButton look="link" align="start" label={`Remove ${area.name}`} confirm={`Remove ${area.name} for everyone?`} action={remove}>
            Remove
          </ActionButton>
        </div>
      </div>
    </details>
  );
}
