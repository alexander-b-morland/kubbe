"use client";

import { useActionState, useRef, useState } from "react";
import { Avatar } from "@/components/avatar/avatar";
import { AVATAR_LABELS, AVATAR_NAMES, type AvatarName } from "@/components/avatar/avatars";
import { Field, focusRing } from "@/components/ui/form";
import { SavableForm } from "@/components/ui/savable-form";
import { saveProfileAction } from "./actions";
import { m } from "@/lib/i18n";
import { useT } from "@/lib/i18n/client";

type Props = {
  name: string;
  colour: string;
  colours: readonly string[];
  colourNames: readonly string[];
  /** Colours the other roommates have. */
  taken: readonly { colour: string; name: string }[];
  avatar: AvatarName;
  bio: string;
  avoids: string;
  questions: readonly { key: string; ask: string }[];
  picks: readonly { key: string; a: string; b: string }[];
  answers: Record<string, string>;
};

const picked =
  "outline-offset-2 peer-checked:outline-4 peer-checked:outline-ink peer-focus-visible:ring-4 peer-focus-visible:ring-fjord peer-focus-visible:ring-offset-4 peer-focus-visible:ring-offset-paper";

const side =
  "flex min-h-12 flex-1 items-center justify-center rounded-full border-2 border-ink px-3 py-1.5 text-center font-bold peer-checked:bg-ink peer-checked:text-paper peer-focus-visible:ring-4 peer-focus-visible:ring-fjord";

// Common things not to eat. Each is a word the dinner ideas understand.
const DIETS = [m("Vegetarian"), m("Vegan"), m("Pork"), m("Fish"), m("Dairy"), m("Gluten"), m("Nuts")];

export function ProfileForm(props: Props) {
  const t = useT();
  const [state, formAction] = useActionState(saveProfileAction, undefined);
  // The avatars are shown on the colour that is picked right now, so the two are chosen together.
  const [colour, setColour] = useState(props.colour);
  const [avatar, setAvatar] = useState(props.avatar);
  const [name, setName] = useState(props.name);
  const avoids = useRef<HTMLInputElement>(null);
  const stored = JSON.stringify([props.name, props.colour, props.avatar, props.bio, props.avoids, props.answers]);
  // Once every colour is in use, sharing one is allowed.
  const allTaken = props.colours.every((option) => option === props.colour || props.taken.some((other) => other.colour === option));

  /** Put a word in "What you don't eat", unless it is there. */
  function addDiet(word: string) {
    const input = avoids.current;
    if (!input) return;
    const have = input.value.split(",").map((part) => part.trim()).filter(Boolean);
    if (have.some((part) => part.toLowerCase() === word.toLowerCase())) return;
    input.value = [...have, word].join(", ").slice(0, 120);
    // Tell the form something changed, as typing would, so Save appears.
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus();
  }

  return (
    <SavableForm action={formAction} state={state} resetKey={stored} variant="primary" sticky>
      <div className="flex items-center gap-4 rounded-3xl p-5 text-paper" style={{ backgroundColor: colour }} data-testid="preview">
        <Avatar avatar={avatar} colour="transparent" className="size-24 shrink-0 border-4 border-paper" />
        <p className="flex min-w-0 flex-col gap-1">
          <span className="font-semibold">{t("How your roommates see you")}</span>
          <span className="type-display text-4xl break-words">{name.trim() || t("No name yet")}</span>
        </p>
      </div>

      <Field label={t("Your name")} name="name" defaultValue={props.name} maxLength={60} autoComplete="given-name" onChange={(event) => setName(event.target.value)} />

      <fieldset className="flex flex-col gap-2">
        <legend className="pb-2 text-sm font-semibold">{t("Your avatar")}</legend>
        <div className="flex flex-wrap gap-3">
          {AVATAR_NAMES.map((option) => (
            <label key={option} className="relative">
              <input
                type="radio"
                name="avatar"
                value={option}
                defaultChecked={option === props.avatar}
                onChange={() => setAvatar(option)}
                className="peer sr-only"
              />
              <span className={`block rounded-full ${picked}`}>
                <Avatar avatar={option} colour={colour} className="size-14" />
              </span>
              <span className="sr-only">{t(AVATAR_LABELS[option])}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="pb-2 text-sm font-semibold">{t("Your colour")}</legend>
        <div className="flex flex-wrap gap-3">
          {props.colours.map((option, index) => {
            const owner = option === props.colour ? undefined : props.taken.find((other) => other.colour === option);
            const blocked = Boolean(owner) && !allTaken;
            const colourName = props.colourNames[index] ? t(props.colourNames[index]) : t`Colour ${index + 1}`;
            return (
              <label key={option} className="relative flex flex-col items-center gap-1" data-taken={owner ? "true" : undefined}>
                <input
                  type="radio"
                  name="colour"
                  value={option}
                  defaultChecked={option === props.colour}
                  disabled={blocked}
                  onChange={() => setColour(option)}
                  className="peer sr-only"
                />
                <span className={`block size-11 rounded-full ${picked} ${blocked ? "opacity-35" : ""}`} style={{ backgroundColor: option }} />
                <span className="sr-only">{owner ? t`${colourName}, ${owner.name}'s colour` : colourName}</span>
                {owner ? (
                  <span aria-hidden="true" className="max-w-14 truncate text-xs font-semibold text-ink-soft">
                    {owner.name}
                  </span>
                ) : null}
              </label>
            );
          })}
        </div>
        {props.taken.length > 0 && !allTaken ? <p className="text-sm text-ink-soft">{t("The faded ones are your roommates' colours.")}</p> : null}
      </fieldset>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">{t("About you")}</span>
        <textarea
          name="bio"
          defaultValue={props.bio}
          maxLength={160}
          rows={3}
          placeholder={t("Third year, plays the trombone, will trade dishes for coffee.")}
          className={`w-full rounded-xl border-2 border-ink bg-white/70 px-4 py-3 text-lg placeholder:text-ink-soft ${focusRing}`}
        />
      </label>

      <fieldset className="flex flex-col gap-3">
        <legend className="type-display pb-1 text-3xl">{t("This or that")}</legend>
        <p className="text-ink-soft">{t("Tap the one that is more you. Skip any you like.")}</p>
        {props.picks.map((pick) => (
          <div key={pick.key} role="group" aria-label={t`${t(pick.a)} or ${t(pick.b)}`} className="flex items-stretch gap-2">
            {(["a", "b"] as const).map((option) => (
              <label key={option} className="relative flex flex-1">
                <input
                  type="radio"
                  name={`pick-${pick.key}`}
                  value={option}
                  defaultChecked={props.answers[`pick-${pick.key}`] === option}
                  className="peer sr-only"
                />
                <span className={side}>{t(pick[option])}</span>
              </label>
            ))}
          </div>
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="type-display pb-3 text-3xl">{t("Fill in the blanks")}</legend>
        {props.questions.map((question) => (
          <Field key={question.key} label={t(question.ask)} name={`answer-${question.key}`} defaultValue={props.answers[question.key] ?? ""} maxLength={80} />
        ))}
      </fieldset>

      <div className="flex flex-col gap-2">
        <Field
          ref={avoids}
          label={t("What you don't eat")}
          hint={t("Used when suggesting dinners. Leave empty if you eat everything.")}
          name="avoids"
          defaultValue={props.avoids}
          maxLength={120}
          placeholder={t("Fish, coriander")}
        />
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("Add to what you don't eat")}>
          {DIETS.map((word) => (
            <button
              key={word}
              type="button"
              onClick={() => addDiet(t(word))}
              className={`min-h-11 rounded-full border-2 border-ink px-4 text-sm font-semibold ${focusRing}`}
            >
              {t(word)}
            </button>
          ))}
        </div>
      </div>
    </SavableForm>
  );
}
