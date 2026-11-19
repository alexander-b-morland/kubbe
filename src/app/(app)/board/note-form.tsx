"use client";

import { useActionState, useState } from "react";
import { focusRing, FormError, Locked, Remaining, selectLook, SubmitButton } from "@/components/ui/form";
import { addNoteAction, type BoardState } from "./actions";
import { useT } from "@/lib/i18n/client";

const MAX = 300;

/** Write on the board. A note can be made a to-do, for one person or for anyone. */
export function NoteForm({ people, me }: { people: { userId: string; name: string }[]; me: string }) {
  const t = useT();
  const [body, setBody] = useState("");
  const [isTask, setIsTask] = useState(false);
  // The box empties when the note is up, not when the list changes: someone else
  // putting up a note must not wipe what is being written here.
  const [state, formAction] = useActionState(async (previous: BoardState, form: FormData) => {
    const result = await addNoteAction(previous, form);
    if (result?.saved) {
      setBody("");
      setIsTask(false);
    }
    return result;
  }, undefined);

  return (
    <form action={formAction} noValidate className="flex flex-col gap-3">
      <Locked>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">{t("Write on the board")}</span>
          <textarea
            name="body"
            rows={3}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={t("Landlord is coming Tuesday at 10.")}
            className={`w-full rounded-xl border-2 border-ink bg-white/70 px-4 py-3 text-lg placeholder:text-ink-soft ${focusRing}`}
          />
          <Remaining used={body.length} max={MAX} />
        </label>
        <label className="flex items-center gap-3 text-lg font-semibold">
          <input type="checkbox" name="isTask" checked={isTask} onChange={(event) => setIsTask(event.target.checked)} className="size-6 accent-ink" />
          {t("Something that needs doing")}
        </label>
        {isTask ? (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">{t("Who should do it")}</span>
            <select name="assignee" defaultValue="anyone" className={selectLook}>
              <option value="anyone">{t("Anyone")}</option>
              {people.map((person) => (
                <option key={person.userId} value={person.userId}>
                  {person.userId === me ? t`${person.name} (you)` : person.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </Locked>
      <FormError message={state?.error} />
      <SubmitButton pendingLabel={t("Putting it up…")}>{t("Put it up")}</SubmitButton>
    </form>
  );
}
