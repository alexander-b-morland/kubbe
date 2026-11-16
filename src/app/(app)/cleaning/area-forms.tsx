"use client";

import { useActionState, useRef } from "react";
import { ActionButton } from "@/components/ui/action-button";
import { Field, FormError, SubmitButton } from "@/components/ui/form";
import { describeInterval } from "@/lib/cleaning/rota";
import type { CleaningState } from "./actions";

type Action = (previous: CleaningState, form: FormData) => Promise<CleaningState>;

const control =
  "h-12 rounded-xl border-2 border-ink bg-white/70 px-3 text-lg outline-none focus-visible:ring-4 focus-visible:ring-fjord/35";

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
        <select name="intervalDays" defaultValue={intervalDays} className={control}>
          {intervals.map((days) => (
            <option key={days} value={days}>
              {describeInterval(days)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Takes about</span>
        <select name="estimateMinutes" defaultValue={estimateMinutes} className={control}>
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

const suggestions = ["Bathroom", "Kitchen", "Living room", "Hallway", "Trash and recycling"];

export function AddAreaForm({
  intervals,
  estimates,
  existing,
  action,
}: {
  intervals: readonly number[];
  estimates: readonly number[];
  existing: string[];
  action: Action;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const nameInput = useRef<HTMLInputElement>(null);
  const unused = suggestions.filter((name) => !existing.some((other) => other.toLowerCase() === name.toLowerCase()));

  return (
    // Built again after each room is added, so the name field starts empty.
    <form key={existing.length} action={formAction} className="flex flex-col gap-4">
      <Field ref={nameInput} label="Room or chore" name="name" placeholder="Bathroom" maxLength={30} defaultValue={state?.values?.name} required />
      {unused.length > 0 ? (
        <div className="flex flex-wrap gap-2" aria-label="Suggestions">
          {unused.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => {
                if (nameInput.current) nameInput.current.value = name;
              }}
              className="rounded-full border-2 border-ink/40 px-3 py-1 text-sm font-semibold outline-none focus-visible:ring-4 focus-visible:ring-fjord/35"
            >
              {name}
            </button>
          ))}
        </div>
      ) : null}
      <RhythmFields intervals={intervals} estimates={estimates} intervalDays={7} estimateMinutes={30} />
      <FormError message={state?.error} />
      <SubmitButton pendingLabel="Adding…">Add room</SubmitButton>
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
  area: { id: string; name: string; intervalDays: number; estimateMinutes: number };
  intervals: readonly number[];
  estimates: readonly number[];
  action: Action;
  remove: () => Promise<CleaningState>;
}) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <details className="border-b-2 border-ink/15">
      <summary className="flex cursor-pointer items-baseline justify-between gap-3 py-3 outline-none focus-visible:bg-fjord/15">
        <span className="text-lg font-semibold">{area.name}</span>
        <span className="text-ink-soft">
          {describeInterval(area.intervalDays)}, {area.estimateMinutes} min
        </span>
      </summary>
      <div className="flex flex-col gap-4 pb-5">
        <form key={JSON.stringify(area)} action={formAction} className="flex flex-col gap-4">
          <Field label="Name" name="name" defaultValue={area.name} maxLength={30} required />
          <RhythmFields intervals={intervals} estimates={estimates} intervalDays={area.intervalDays} estimateMinutes={area.estimateMinutes} />
          <p className="text-sm text-ink-soft">Changing how often starts the rota for this room over from today.</p>
          <FormError message={state?.error} />
          <SubmitButton pendingLabel="Saving…" variant="secondary">
            Save {area.name.toLowerCase()}
          </SubmitButton>
        </form>
        <div className="flex justify-start">
          <ActionButton confirm={`Remove ${area.name} for everyone?`} action={remove}>
            Remove room
          </ActionButton>
        </div>
      </div>
    </details>
  );
}
