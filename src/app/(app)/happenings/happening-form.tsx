"use client";

import { useActionState, useState } from "react";
import { Field, focusRing, FormError, Locked, Remaining, Saved, SubmitButton } from "@/components/ui/form";
import { addHappeningAction, updateHappeningAction, type HappeningState } from "./actions";

type Existing = { id: string; title: string; day: string; time: string; place: string; details: string };

const MAX_DETAILS = 300;

/** Suggest something to do together, or change one you suggested. */
export function HappeningForm({ today, day, existing }: { today: string; /** The day to start on, when coming from the calendar. */ day?: string; existing?: Existing }) {
  const [details, setDetails] = useState(existing?.details ?? "");
  const [title, setTitle] = useState(existing?.title ?? "");
  const [state, formAction] = useActionState(async (previous: HappeningState, form: FormData) => {
    const result = await (existing ? updateHappeningAction.bind(null, existing.id) : addHappeningAction)(previous, form);
    if (result?.saved && !existing) {
      setDetails("");
      setTitle("");
    }
    return result;
  }, undefined);
  const values = state?.values;
  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <Locked>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">What&apos;s the plan</span>
          <input
            name="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Film night"
            className={`h-14 w-full rounded-xl border-2 border-ink bg-white/70 px-4 text-lg placeholder:text-ink-soft ${focusRing}`}
          />
          <Remaining used={title.length} max={60} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Day" name="day" type="date" min={today} defaultValue={values?.day ?? existing?.day ?? day ?? today} />
          <Field label="Time" name="time" type="time" defaultValue={values?.time ?? existing?.time ?? "19:00"} />
        </div>
        <Field label="Where" name="place" placeholder="Our living room" defaultValue={values?.place ?? existing?.place} />
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Anything else</span>
          <textarea
            name="details"
            rows={2}
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            placeholder="Bring snacks."
            className={`w-full rounded-xl border-2 border-ink bg-white/70 px-4 py-3 text-lg placeholder:text-ink-soft ${focusRing}`}
          />
          <Remaining used={details.length} max={MAX_DETAILS} />
        </label>
      </Locked>
      <FormError message={state?.error} />
      <Saved show={Boolean(existing) && state?.saved} />
      <SubmitButton pendingLabel={existing ? "Saving…" : "Suggesting…"} variant={existing ? "secondary" : "primary"}>
        {existing ? "Save" : "Suggest it"}
      </SubmitButton>
    </form>
  );
}
