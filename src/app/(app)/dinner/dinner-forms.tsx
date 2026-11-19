"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { ActionButton } from "@/components/ui/action-button";
import { Field, focusRing, FormError, Locked, QuickAddForm, Remaining, SubmitButton } from "@/components/ui/form";
import { SavableForm } from "@/components/ui/savable-form";
import { COOKBOOK, recipeFor, type DishIdea } from "@/lib/dinner/cookbook";
import { TITLE_LENGTH, WEEKDAYS } from "@/lib/dinner/plan";
import { addDinnerAction, addDishAction, addIdeaAction, addIngredientAction, ideasAction, needsAction, saveRulesAction, type DinnerState, type IdeasState } from "./actions";
import { useT } from "@/lib/i18n/client";

/** Which weekdays always have a dinner, and when. */
export function RulesForm({ weekdays, time }: { weekdays: readonly number[]; time: string }) {
  const t = useT();
  const [state, formAction] = useActionState(saveRulesAction, undefined);
  return (
    <SavableForm action={formAction} state={state} resetKey={`${weekdays.join(",")}@${time}`}>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">{t("Dinner every")}</legend>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((name, index) => (
            <label key={name} className="relative">
              <input
                type="checkbox"
                name="weekday"
                value={index + 1}
                defaultChecked={weekdays.includes(index + 1)}
                aria-label={t(name)}
                className="peer absolute inset-0 size-full cursor-pointer opacity-0"
              />
              <span className="flex h-11 min-w-12 items-center justify-center rounded-full border-2 border-ink px-3 font-bold peer-checked:bg-ink peer-checked:text-paper peer-focus-visible:ring-4 peer-focus-visible:ring-fjord peer-focus-visible:ring-offset-2">
                {t(name).slice(0, 3)}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <Field label={t("At")} name="time" type="time" defaultValue={time} />
    </SavableForm>
  );
}

/** Plan a dinner on one day. Whoever plans it says whether they are in themselves. */
export function AddDinnerForm({ today, day }: { today: string; /** The day to start on, when coming from the calendar. */ day?: string }) {
  const t = useT();
  const [state, formAction] = useActionState(addDinnerAction, undefined);
  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <Locked>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("Day")} name="day" type="date" min={today} defaultValue={state?.values?.day ?? day ?? today} />
          <Field label={t("Time")} name="time" type="time" defaultValue={state?.values?.time ?? "18:00"} />
        </div>
        <label className="flex items-center gap-3 text-lg font-semibold">
          <input type="checkbox" name="in" defaultChecked className="size-6 accent-ink" />
          {t("I'm in myself")}
        </label>
        <p className="-mt-2 text-sm text-ink-soft">{t("The others answer for themselves once it is planned.")}</p>
      </Locked>
      <FormError message={state?.error} />
      <SubmitButton pendingLabel={t("Planning…")}>{t("Plan dinner")}</SubmitButton>
    </form>
  );
}

type Hint = { ingredients: string[]; source: "claude" | "cookbook" };

/**
 * Suggest a dish, with what it needs. While the name is typed, the form looks up what
 * such a dish usually needs and offers it below the box: one press takes it. The box
 * itself only ever holds what will be sent.
 */
export function DishForm({ dinnerId, ruledOut }: { dinnerId: string; /** What the people eating cannot have, so the cookbook offers a dish that fits. */ ruledOut: readonly string[] }) {
  const t = useT();
  const [title, setTitle] = useState("");
  const [needs, setNeeds] = useState("");
  // The list that was taken from an offer, untouched since. If the dish is renamed, it
  // belongs to the old name, and the new offer may replace it.
  const [taken, setTaken] = useState("");
  const [remote, setRemote] = useState<{ for: string; found: Hint | null } | null>(null);
  // The fields empty when the dish is up, not when the list of dishes changes: a
  // roommate's suggestion must not wipe what is being typed here.
  const [state, formAction] = useActionState(async (previous: DinnerState, form: FormData) => {
    const result = await addDishAction(dinnerId, previous, form);
    if (result?.saved) {
      setTitle("");
      setNeeds("");
      setTaken("");
    }
    return result;
  }, undefined);

  const wanted = title.trim();
  const replaceable = needs.trim() === "" || needs === taken;
  // The cookbook is on hand and costs nothing, so it answers at once.
  // It is written in English, so it only answers an English reader; others are asked for from the server.
  const known = useMemo(() => (t.locale === "en" ? (recipeFor(wanted, ruledOut)?.ingredients ?? null) : null), [wanted, ruledOut, t.locale]);
  const askClaude = wanted.length >= 3 && replaceable && !known;

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

  const found: Hint | null = known ? { ingredients: known, source: "cookbook" } : remote?.for === wanted ? remote.found : null;
  const offered = found?.ingredients.join(", ") ?? "";
  const offer = replaceable && found && offered !== needs ? found : null;
  const looking = askClaude && remote?.for !== wanted;
  const take = () => {
    setNeeds(offered);
    setTaken(offered);
  };

  return (
    <form action={formAction} noValidate className="flex flex-col gap-3" data-testid="dish-form">
      <Locked>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">{t("Suggest a dish")}</span>
          <input
            name="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t("What would you like to eat?")}
            list="dish-names"
            autoComplete="off"
            className={`h-14 w-full rounded-xl border-2 border-ink bg-white/70 px-4 text-lg placeholder:text-ink-soft ${focusRing}`}
          />
          <Remaining used={title.length} max={TITLE_LENGTH} />
        </label>
        <datalist id="dish-names">
          {COOKBOOK.map((recipe) => (
            <option key={recipe.title} value={recipe.title} />
          ))}
        </datalist>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">{t("What it needs")}</span>
          <textarea
            name="ingredients"
            rows={3}
            value={needs}
            onChange={(event) => setNeeds(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Tab" && !event.shiftKey && offer && needs.trim() === "") {
                event.preventDefault();
                take();
              }
            }}
            placeholder={t("For example: tortillas, beans, salsa")}
            className={`w-full rounded-xl border-2 border-ink bg-white/70 px-4 py-3 text-lg placeholder:text-ink-soft ${focusRing}`}
          />
          <span className="text-sm text-ink-soft">{t("Separate with commas or new lines. You can add more later.")}</span>
        </label>
        <div aria-live="polite" className="min-h-6">
          {offer ? (
            <div className="flex flex-col items-start gap-2 rounded-2xl border-2 border-ink bg-paper p-4" data-testid="needs-offer">
              <p className="font-semibold">
                {offer.source === "claude" ? t("Claude thinks it needs") : t("It usually needs")}: <span className="font-normal">{offered}</span>
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={take} className={`min-h-11 rounded-full border-2 border-ink bg-ink px-4 py-1.5 text-sm font-bold text-paper ${focusRing}`}>
                  {needs.trim() === "" ? t("Use these") : t("Replace with these")}
                </button>
                {needs.trim() === "" ? <span className="hidden text-sm text-ink-soft lg:inline">{t("or press Tab in the box")}</span> : null}
              </div>
            </div>
          ) : looking ? (
            <p className="text-sm text-ink-soft">{t("Looking up what it needs…")}</p>
          ) : null}
        </div>
      </Locked>
      <FormError message={state?.error} />
      <SubmitButton pendingLabel={t("Putting it up…")}>{t("Put it to the vote")}</SubmitButton>
    </form>
  );
}

/** More that the chosen dish needs. Several at once, with commas between them. */
export function IngredientForm({ dishId }: { dishId: string }) {
  const t = useT();
  return (
    <QuickAddForm
      action={addIngredientAction.bind(null, dishId)}
      name="name"
      label={t("Something else it needs")}
      placeholder={t("Limes, coriander")}
      variant="secondary"
    />
  );
}

/**
 * "Out of ideas?" Asks for a few dishes that fit who is coming and shows them.
 * Nothing is added until someone puts one to the vote.
 */
export function IdeasPanel({ dinnerId }: { dinnerId: string }) {
  const t = useT();
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
        {pending ? t("Thinking of dishes…") : asked ? t("Other ideas") : t("Out of ideas? Get a few")}
      </button>
      <FormError message={state?.error} />
      {asked ? (
        <p role="status" className="text-sm text-ink-soft" data-testid="ideas-source" data-source={state?.source}>
          {ideas.length === 0
            ? t("All of them are up for the vote.")
            : state?.source === "claude"
              ? t("Suggested by Claude, for who is in and what they don't eat.")
              : t("From Kubbe's cookbook, for who is in and what they don't eat.")}
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
  const t = useT();
  return (
    <li data-testid="idea" className="flex flex-col gap-2 rounded-2xl border-2 border-ink/25 bg-paper p-4">
      <h4 className="text-xl font-bold break-words">{idea.title}</h4>
      <p className="break-words">{idea.ingredients.join(", ")}</p>
      <ActionButton
        align="start"
        label={t`Put ${idea.title} to the vote`}
        action={async () => {
          const result = await addIdeaAction(dinnerId, idea.title, idea.ingredients);
          if (!result?.error) onAdded();
          return result;
        }}
      >
        {t("Put it to the vote")}
      </ActionButton>
    </li>
  );
}
