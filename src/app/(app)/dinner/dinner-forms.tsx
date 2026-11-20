"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { Field, focusRing, FormError, Locked, QuickAddForm, Remaining, SubmitButton } from "@/components/ui/form";
import { SavableForm } from "@/components/ui/savable-form";
import { recipeFor, type DishIdea } from "@/lib/dinner/cookbook";
import { TITLE_LENGTH, WEEKDAYS } from "@/lib/dinner/plan";
import { addDinnerAction, addDishAction, addIngredientAction, ideasAction, needsAction, saveRulesAction, type DinnerState, type IdeasState } from "./actions";
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
 * Suggest a dish, with what it needs. Type the name and press Enter (or move on to the
 * next box): what such a dish needs is filled in, from the cookbook or from Claude, to
 * change as you like. "Out of ideas?" offers a few dishes; using one fills the form too,
 * so nothing goes to the vote until someone presses the button.
 */
export function DishForm({ dinnerId, ruledOut }: { dinnerId: string; /** What the people eating cannot have, so the cookbook offers a dish that fits. */ ruledOut: readonly string[] }) {
  const t = useT();
  const [title, setTitle] = useState("");
  const [needs, setNeeds] = useState("");
  // What was filled in for the person, untouched since, and where it came from.
  const [filled, setFilled] = useState<{ text: string; source: Hint["source"] } | null>(null);
  const [looking, setLooking] = useState(false);
  // The idea the form was filled from, while its name is unchanged: it is marked as picked from the ideas.
  const [fromIdea, setFromIdea] = useState<string | null>(null);
  const [ideas, setIdeas] = useState<IdeasState>(undefined);
  const [thinking, startThinking] = useTransition();
  // The name last looked up, and what was last filled in. Read after an answer arrives, so refs, not state.
  const asked = useRef("");
  const lastFilled = useRef("");
  const titleBox = useRef<HTMLInputElement>(null);
  const needsBox = useRef<HTMLTextAreaElement>(null);

  // The fields empty when the dish is up, not when the list of dishes changes: a
  // roommate's suggestion must not wipe what is being typed here.
  const [state, formAction] = useActionState(async (previous: DinnerState, form: FormData) => {
    const result = await addDishAction(dinnerId, previous, form);
    if (result?.saved) {
      setTitle("");
      setNeeds("");
      setFilled(null);
      setFromIdea(null);
      asked.current = "";
      lastFilled.current = "";
    }
    return result;
  }, undefined);

  /** Fill the needs box, unless the person has written in it themselves. */
  function fill(hint: Hint) {
    const current = needsBox.current?.value ?? "";
    if (current.trim() !== "" && current !== lastFilled.current) return;
    const text = hint.ingredients.join(", ");
    lastFilled.current = text;
    setNeeds(text);
    setFilled({ text, source: hint.source });
  }

  // When the name is done, find what such a dish needs.
  async function lookUp() {
    const wanted = title.trim();
    if (wanted.length < 3 || wanted === asked.current) return;
    asked.current = wanted;
    // The cookbook is on hand and free, but written in English: it only answers an English reader.
    const known = t.locale === "en" ? recipeFor(wanted, ruledOut)?.ingredients : undefined;
    if (known) return fill({ ingredients: known, source: "cookbook" });
    setLooking(true);
    const answer = await needsAction(dinnerId, wanted).catch(() => undefined);
    setLooking(false);
    // Only the answer for the name that is in the box now counts.
    if (asked.current !== wanted || !answer?.ingredients?.length) return;
    fill({ ingredients: answer.ingredients, source: answer.source ?? "claude" });
  }

  function getIdeas() {
    if (thinking) return;
    startThinking(async () => setIdeas(await ideasAction(dinnerId)));
  }

  function takeIdea(idea: DishIdea) {
    asked.current = idea.title;
    lastFilled.current = "";
    setTitle(idea.title);
    setFromIdea(idea.title);
    // Straight in: the person chose this idea, so whatever is in the box makes way.
    const text = idea.ingredients.join(", ");
    lastFilled.current = text;
    setNeeds(text);
    setFilled({ text, source: ideas?.source ?? "cookbook" });
    setIdeas((current) => (current?.ideas ? { ...current, ideas: current.ideas.filter((other) => other.title !== idea.title) } : current));
    titleBox.current?.focus();
  }

  const shownIdeas = ideas?.ideas ?? [];

  return (
    <form action={formAction} noValidate className="flex flex-col gap-3" data-testid="dish-form">
      <Locked>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="dish-title" className="text-sm font-semibold">
            {t("Suggest a dish")}
          </label>
          <div className="flex flex-wrap items-stretch gap-2">
            <input
              id="dish-title"
              ref={titleBox}
              name="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              onBlur={lookUp}
              onKeyDown={(event) => {
                // Enter means "that's the dish": move on to what it needs, which asks for it.
                if (event.key === "Enter") {
                  event.preventDefault();
                  needsBox.current?.focus();
                }
              }}
              placeholder={t("What would you like to eat?")}
              autoComplete="off"
              className={`h-14 min-w-0 flex-1 basis-56 rounded-xl border-2 border-ink bg-white/70 px-4 text-lg placeholder:text-ink-soft ${focusRing}`}
            />
            <button
              type="button"
              onClick={getIdeas}
              aria-disabled={thinking}
              data-testid="get-ideas"
              className={`h-14 shrink-0 rounded-full border-2 border-ink px-5 font-bold transition-transform active:scale-[0.98] ${focusRing} ${thinking ? "opacity-70" : ""}`}
            >
              {thinking ? t("Thinking of dishes…") : ideas?.ideas ? t("Other ideas") : t("Out of ideas?")}
            </button>
          </div>
          <span className="text-sm text-ink-soft">{t("Type a dish and press Enter: what it needs is filled in for you.")}</span>
          <Remaining used={title.length} max={TITLE_LENGTH} />
          {fromIdea !== null && title === fromIdea ? <input type="hidden" name="fromIdea" value="1" /> : null}
        </div>

        {ideas ? (
          <div className="flex flex-col gap-2" data-testid="ideas">
            <FormError message={ideas.error} />
            {ideas.ideas ? (
              <p role="status" className="text-sm text-ink-soft" data-testid="ideas-source" data-source={ideas.source}>
                {shownIdeas.length === 0
                  ? t("All of them are up for the vote.")
                  : ideas.source === "claude"
                    ? t("Suggested by Claude, for who is in and what they don't eat.")
                    : t("From Kubbe's cookbook, for who is in and what they don't eat.")}
              </p>
            ) : null}
            {shownIdeas.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {shownIdeas.map((idea) => (
                  <li key={idea.title} data-testid="idea" className="flex flex-col gap-2 rounded-2xl border-2 border-ink/25 bg-paper p-4">
                    <h4 className="text-xl font-bold break-words">{idea.title}</h4>
                    <p className="break-words text-ink-soft">{idea.ingredients.join(", ")}</p>
                    <button
                      type="button"
                      onClick={() => takeIdea(idea)}
                      aria-label={t`Use this idea: ${idea.title}`}
                      className={`min-h-11 w-fit rounded-full border-2 border-ink px-4 text-sm font-bold ${focusRing}`}
                    >
                      {t("Use this idea")}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">{t("What it needs")}</span>
          <textarea
            ref={needsBox}
            name="ingredients"
            rows={3}
            value={needs}
            onChange={(event) => setNeeds(event.target.value)}
            placeholder={t("For example: tortillas, beans, salsa")}
            className={`w-full rounded-xl border-2 border-ink bg-white/70 px-4 py-3 text-lg placeholder:text-ink-soft ${focusRing}`}
          />
          <span className="text-sm text-ink-soft" aria-live="polite" data-testid="needs-note">
            {looking
              ? t("Looking up what it needs…")
              : filled && needs === filled.text
                ? filled.source === "claude"
                  ? t("Filled in by Claude. Change anything before you put it up.")
                  : t("Filled in from Kubbe's cookbook. Change anything before you put it up.")
                : t("Separate with commas or new lines. You can add more later.")}
          </span>
        </label>
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
