"use client";

import { useActionState, useState, useTransition } from "react";
import { ActionButton } from "@/components/ui/action-button";
import { Field, focusRing, FormError, SubmitButton } from "@/components/ui/form";
import { SavableForm } from "@/components/ui/savable-form";
import type { DishIdea } from "@/lib/dinner/cookbook";
import { WEEKDAYS } from "@/lib/dinner/plan";
import { addDinnerAction, addDishAction, addIdeaAction, addIngredientAction, ideasAction, saveRulesAction, type IdeasState } from "./actions";

/** Which weekdays always have a dinner, and when. */
export function RulesForm({ weekdays, time }: { weekdays: readonly number[]; time: string }) {
  const [state, formAction] = useActionState(saveRulesAction, undefined);
  return (
    <SavableForm action={formAction} state={state} resetKey={`${weekdays.join(",")}@${time}`}>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">Dinner every</legend>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((name, index) => (
            <label key={name} className="relative">
              <input
                type="checkbox"
                name="weekday"
                value={index + 1}
                defaultChecked={weekdays.includes(index + 1)}
                aria-label={name}
                className="peer absolute inset-0 size-full cursor-pointer opacity-0"
              />
              <span className="flex h-11 min-w-12 items-center justify-center rounded-full border-2 border-ink px-3 font-bold peer-checked:bg-ink peer-checked:text-paper peer-focus-visible:ring-4 peer-focus-visible:ring-fjord">
                {name.slice(0, 3)}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="At" name="time" type="time" defaultValue={time} />
    </SavableForm>
  );
}

/** Plan a dinner on one day. */
export function AddDinnerForm({ today }: { today: string }) {
  const [state, formAction] = useActionState(addDinnerAction, undefined);
  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Day" name="day" type="date" min={today} defaultValue={state?.values?.day ?? today} />
        <Field label="Time" name="time" type="time" defaultValue={state?.values?.time ?? "18:00"} />
      </div>
      <FormError message={state?.error} />
      <SubmitButton pendingLabel="Planning…" variant="secondary">
        Plan dinner
      </SubmitButton>
    </form>
  );
}

/** Suggest a dish, with what it needs. */
export function DishForm({ dinnerId, count }: { dinnerId: string; count: number }) {
  const [state, formAction] = useActionState(addDishAction.bind(null, dinnerId), undefined);
  return (
    // Built again after each suggestion, so the fields start empty.
    <form key={count} action={formAction} noValidate className="flex flex-col gap-3">
      <Field label="Suggest a dish" name="title" placeholder="Tacos" maxLength={60} defaultValue={state?.values?.title} autoComplete="off" />
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">What it needs</span>
        <textarea
          name="ingredients"
          rows={3}
          defaultValue={state?.values?.ingredients}
          placeholder="Tortillas, minced beef, salsa"
          className={`w-full rounded-xl border-2 border-ink bg-white/70 px-4 py-3 text-lg placeholder:text-ink-soft ${focusRing}`}
        />
        <span className="text-sm text-ink-soft">Separate with commas or new lines. You can add more later.</span>
      </label>
      <FormError message={state?.error} />
      <SubmitButton pendingLabel="Putting it up…">Put it to the vote</SubmitButton>
    </form>
  );
}

/** One more thing the chosen dish needs. */
export function IngredientForm({ dishId, count }: { dishId: string; count: number }) {
  const [state, formAction] = useActionState(addIngredientAction.bind(null, dishId), undefined);
  return (
    <form key={count} action={formAction} noValidate className="flex flex-col gap-3">
      <Field label="Something else it needs" name="name" placeholder="Limes" maxLength={60} defaultValue={state?.values?.name} autoComplete="off" />
      <FormError message={state?.error} />
      <SubmitButton pendingLabel="Adding…" variant="secondary">
        Add
      </SubmitButton>
    </form>
  );
}

/**
 * "Out of ideas?" Asks for a few dishes that fit who is coming and shows them.
 * Nothing is added until someone puts one to the vote.
 */
export function IdeasPanel({ dinnerId }: { dinnerId: string }) {
  const [state, setState] = useState<IdeasState>(undefined);
  const [pending, startTransition] = useTransition();
  const [added, setAdded] = useState<readonly string[]>([]);

  function ask() {
    if (pending) return;
    startTransition(async () => {
      const result = await ideasAction(dinnerId);
      setState(result);
      setAdded([]);
    });
  }

  const ideas = (state?.ideas ?? []).filter((idea) => !added.includes(idea.title));
  const asked = state?.ideas !== undefined;

  return (
    <div className="flex flex-col gap-3" data-testid="ideas">
      <button
        type="button"
        onClick={ask}
        aria-disabled={pending}
        className={`h-14 w-full rounded-full border-2 border-ink px-6 text-lg font-bold transition-transform active:scale-[0.98] ${focusRing} ${pending ? "opacity-70" : ""}`}
      >
        {pending ? "Thinking of dishes…" : asked ? "Other ideas" : "Out of ideas? Get a few"}
      </button>
      <FormError message={state?.error} />
      {asked ? (
        <p role="status" className="text-sm text-ink-soft">
          {ideas.length === 0
            ? "All of them are up for the vote."
            : state?.source === "claude"
              ? "Suggested by Claude, for who is coming and what they don't eat."
              : "From Kubbe's cookbook, for who is coming and what they don't eat."}
        </p>
      ) : null}
      {ideas.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {ideas.map((idea) => (
            <Idea key={idea.title} idea={idea} dinnerId={dinnerId} onAdded={() => setAdded((titles) => [...titles, idea.title])} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Idea({ idea, dinnerId, onAdded }: { idea: DishIdea; dinnerId: string; onAdded: () => void }) {
  return (
    <li data-testid="idea" className="flex flex-col gap-2 rounded-2xl border-2 border-ink/25 p-4">
      <h4 className="type-display text-2xl break-words">{idea.title}</h4>
      <p className="break-words text-ink-soft">{idea.ingredients.join(", ")}</p>
      <ActionButton
        align="start"
        label={`Put ${idea.title} to the vote`}
        action={async () => {
          const result = await addIdeaAction(dinnerId, idea.title, idea.ingredients);
          if (!result?.error) onAdded();
          return result;
        }}
      >
        Put it to the vote
      </ActionButton>
    </li>
  );
}
