"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { ActionButton } from "@/components/ui/action-button";
import { Field, focusRing, FormError, SubmitButton } from "@/components/ui/form";
import { SavableForm } from "@/components/ui/savable-form";
import { COOKBOOK, needsFromCookbook, type DishIdea } from "@/lib/dinner/cookbook";
import { WEEKDAYS } from "@/lib/dinner/plan";
import { addDinnerAction, addDishAction, addIdeaAction, addIngredientAction, ideasAction, needsAction, saveRulesAction, type IdeasState } from "./actions";

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

/** Plan a dinner on one day. Whoever plans it says whether they are in themselves. */
export function AddDinnerForm({ today }: { today: string }) {
  const [state, formAction] = useActionState(addDinnerAction, undefined);
  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Day" name="day" type="date" min={today} defaultValue={state?.values?.day ?? today} />
        <Field label="Time" name="time" type="time" defaultValue={state?.values?.time ?? "18:00"} />
      </div>
      <label className="flex items-center gap-3 text-lg font-semibold">
        <input type="checkbox" name="in" defaultChecked className="size-6 accent-ink" />
        I&apos;m in myself
      </label>
      <p className="-mt-2 text-sm text-ink-soft">The others answer for themselves once it is planned.</p>
      <FormError message={state?.error} />
      <SubmitButton pendingLabel="Planning…">Plan dinner</SubmitButton>
    </form>
  );
}

type Hint = { ingredients: string[]; source: "claude" | "cookbook" };

/**
 * Suggest a dish, with what it needs. While the name is typed, the form looks up what
 * such a dish usually needs and offers it: one tap, or Tab in the empty box, takes it.
 */
export function DishForm({ dinnerId, count }: { dinnerId: string; count: number }) {
  // Built again after each suggestion, so the fields start empty.
  return <DishFields key={count} dinnerId={dinnerId} />;
}

function DishFields({ dinnerId }: { dinnerId: string }) {
  const [state, formAction] = useActionState(addDishAction.bind(null, dinnerId), undefined);
  const [title, setTitle] = useState(state?.values?.title ?? "");
  const [needs, setNeeds] = useState(state?.values?.ingredients ?? "");
  const [remote, setRemote] = useState<{ for: string; found: Hint | null } | null>(null);

  const wanted = title.trim();
  const empty = needs.trim() === "";
  // The cookbook is on hand and costs nothing, so it answers at once.
  const known = useMemo(() => needsFromCookbook(wanted), [wanted]);
  const askClaude = wanted.length >= 3 && empty && !known;

  // For a dish the cookbook does not know, ask a moment after the typing stops.
  useEffect(() => {
    if (!askClaude) return;
    let stale = false;
    const timer = setTimeout(async () => {
      const found = await needsAction(dinnerId, wanted).catch(() => undefined);
      // Only the answer to what is in the box now counts.
      if (stale) return;
      setRemote({ for: wanted, found: found?.ingredients?.length ? { ingredients: found.ingredients, source: found.source ?? "claude" } : null });
    }, 900);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [askClaude, wanted, dinnerId]);

  const offer: Hint | null = !empty ? null : known ? { ingredients: known, source: "cookbook" } : remote?.for === wanted ? remote.found : null;
  const looking = askClaude && remote?.for !== wanted;
  const take = () => {
    if (offer) setNeeds(offer.ingredients.join(", "));
  };

  return (
    <form action={formAction} noValidate className="flex flex-col gap-3" data-testid="dish-form">
      <Field
        label="Suggest a dish"
        name="title"
        placeholder="Tacos"
        maxLength={60}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        list="dish-names"
        autoComplete="off"
      />
      <datalist id="dish-names">
        {COOKBOOK.map((recipe) => (
          <option key={recipe.title} value={recipe.title} />
        ))}
      </datalist>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">What it needs</span>
        <textarea
          name="ingredients"
          rows={3}
          value={needs}
          onChange={(event) => setNeeds(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Tab" && !event.shiftKey && offer) {
              event.preventDefault();
              take();
            }
          }}
          placeholder={offer ? offer.ingredients.join(", ") : "Tortillas, minced beef, salsa"}
          className={`w-full rounded-xl border-2 border-ink bg-white/70 px-4 py-3 text-lg placeholder:text-ink-soft ${focusRing}`}
        />
        <span className="text-sm text-ink-soft">Separate with commas or new lines. You can add more later.</span>
      </label>
      <div aria-live="polite" className="min-h-6">
        {offer ? (
          <div className="flex flex-col items-start gap-2 rounded-2xl bg-salmon/30 p-4" data-testid="needs-offer">
            <p className="font-semibold">
              {offer.source === "claude" ? "Claude thinks it needs" : "It usually needs"}: <span className="font-normal">{offer.ingredients.join(", ")}</span>
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={take}
                className={`min-h-11 rounded-full border-2 border-ink bg-ink px-4 py-1.5 text-sm font-bold text-paper ${focusRing}`}
              >
                Use these
              </button>
              <span className="hidden text-sm text-ink-soft lg:inline">or press Tab in the box</span>
            </div>
          </div>
        ) : looking ? (
          <p className="text-sm text-ink-soft">Looking up what it needs…</p>
        ) : null}
      </div>
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
        <p role="status" className="text-sm text-ink-soft" data-testid="ideas-source" data-source={state?.source}>
          {ideas.length === 0
            ? "All of them are up for the vote."
            : state?.source === "claude"
              ? "Suggested by Claude, for who is in and what they don't eat."
              : "From Kubbe's cookbook, for who is in and what they don't eat."}
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
    <li data-testid="idea" className="flex flex-col gap-2 rounded-2xl bg-salmon/30 p-4">
      <h4 className="type-display text-2xl break-words">{idea.title}</h4>
      <p className="break-words">{idea.ingredients.join(", ")}</p>
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
