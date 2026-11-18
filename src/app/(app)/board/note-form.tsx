"use client";

import { useActionState, useState } from "react";
import { focusRing, FormError, selectLook, SubmitButton } from "@/components/ui/form";
import { addNoteAction } from "./actions";

/** Write on the board. A note can be made a to-do, for one person or for anyone. */
export function NoteForm({ people, count }: { people: { userId: string; name: string }[]; count: number }) {
  // Built again after each note, so the box starts empty and unticked.
  return <NoteFields key={count} people={people} />;
}

function NoteFields({ people }: { people: { userId: string; name: string }[] }) {
  const [state, formAction] = useActionState(addNoteAction, undefined);
  const [isTask, setIsTask] = useState(false);

  return (
    <form action={formAction} noValidate className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Write on the board</span>
        <textarea
          name="body"
          rows={3}
          maxLength={300}
          defaultValue={state?.values?.body}
          placeholder="Landlord is coming Tuesday at 10."
          className={`w-full rounded-xl border-2 border-ink bg-white/70 px-4 py-3 text-lg placeholder:text-ink-soft ${focusRing}`}
        />
      </label>
      <label className="flex items-center gap-3 text-lg font-semibold">
        <input type="checkbox" name="isTask" checked={isTask} onChange={(event) => setIsTask(event.target.checked)} className="size-6 accent-ink" />
        Something that needs doing
      </label>
      {isTask ? (
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Who should do it</span>
          <select name="assignee" defaultValue="anyone" className={selectLook}>
            <option value="anyone">Anyone</option>
            {people.map((person) => (
              <option key={person.userId} value={person.userId}>
                {person.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <FormError message={state?.error} />
      <SubmitButton pendingLabel="Putting it up…">Put it up</SubmitButton>
    </form>
  );
}
