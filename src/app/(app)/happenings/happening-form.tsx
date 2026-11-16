"use client";

import { useActionState } from "react";
import { Field, focusRing, FormError, SubmitButton } from "@/components/ui/form";
import { addHappeningAction } from "./actions";

/** Suggest something to do together. */
export function HappeningForm({ count, today }: { count: number; today: string }) {
  const [state, formAction] = useActionState(addHappeningAction, undefined);
  const values = state?.values;
  return (
    // Built again after each suggestion, so the fields start empty.
    <form key={count} action={formAction} noValidate className="flex flex-col gap-4">
      <Field label="What's the plan" name="title" placeholder="Film night" maxLength={60} defaultValue={values?.title} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Day" name="day" type="date" min={today} defaultValue={values?.day ?? today} />
        <Field label="Time" name="time" type="time" defaultValue={values?.time ?? "19:00"} />
      </div>
      <Field label="Where" name="place" placeholder="Our living room" maxLength={60} defaultValue={values?.place} />
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Anything else</span>
        <textarea
          name="details"
          rows={2}
          maxLength={300}
          defaultValue={values?.details}
          placeholder="Bring snacks."
          className={`w-full rounded-xl border-2 border-ink bg-white/70 px-4 py-3 text-lg placeholder:text-ink-soft ${focusRing}`}
        />
      </label>
      <FormError message={state?.error} />
      <SubmitButton pendingLabel="Suggesting…">Suggest it</SubmitButton>
    </form>
  );
}
