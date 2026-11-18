"use client";

import { useActionState, useState } from "react";
import { Avatar } from "@/components/avatar/avatar";
import { AVATAR_LABELS, AVATAR_NAMES, type AvatarName } from "@/components/avatar/avatars";
import { Field, focusRing } from "@/components/ui/form";
import { SavableForm } from "@/components/ui/savable-form";
import { saveProfileAction } from "./actions";

type Props = {
  name: string;
  colour: string;
  colours: readonly string[];
  colourNames: readonly string[];
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

export function ProfileForm(props: Props) {
  const [state, formAction] = useActionState(saveProfileAction, undefined);
  // The avatars are shown on the colour that is picked right now, so the two are chosen together.
  const [colour, setColour] = useState(props.colour);
  const [avatar, setAvatar] = useState(props.avatar);
  const stored = JSON.stringify([props.name, props.colour, props.avatar, props.bio, props.avoids, props.answers]);

  return (
    <SavableForm action={formAction} state={state} resetKey={stored} variant="primary">
      <div className="flex items-center gap-4 rounded-3xl p-5 text-paper" style={{ backgroundColor: colour }} data-testid="preview">
        <Avatar avatar={avatar} colour="transparent" className="size-24 border-4 border-paper" />
        <p className="type-display min-w-0 text-4xl break-words">This is you</p>
      </div>

      <Field label="Your name" name="name" defaultValue={props.name} maxLength={60} autoComplete="given-name" />

      <fieldset className="flex flex-col gap-2">
        <legend className="pb-2 text-sm font-semibold">Your avatar</legend>
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
              <span className="sr-only">{AVATAR_LABELS[option]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="pb-2 text-sm font-semibold">Your colour</legend>
        <div className="flex flex-wrap gap-3">
          {props.colours.map((option, index) => (
            <label key={option} className="relative">
              <input
                type="radio"
                name="colour"
                value={option}
                defaultChecked={option === props.colour}
                onChange={() => setColour(option)}
                className="peer sr-only"
              />
              <span className={`block size-11 rounded-full ${picked}`} style={{ backgroundColor: option }} />
              <span className="sr-only">{props.colourNames[index] ?? `Colour ${index + 1}`}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">About you</span>
        <textarea
          name="bio"
          defaultValue={props.bio}
          maxLength={160}
          rows={3}
          placeholder="Third year, plays the trombone, will trade dishes for coffee."
          className={`w-full rounded-xl border-2 border-ink bg-white/70 px-4 py-3 text-lg placeholder:text-ink-soft ${focusRing}`}
        />
      </label>

      <fieldset className="flex flex-col gap-3">
        <legend className="type-display pb-1 text-3xl">This or that</legend>
        <p className="text-ink-soft">Tap the one that is more you. Skip any you like.</p>
        {props.picks.map((pick) => (
          <div key={pick.key} role="group" aria-label={`${pick.a} or ${pick.b}`} className="flex items-stretch gap-2">
            {(["a", "b"] as const).map((option) => (
              <label key={option} className="relative flex flex-1">
                <input
                  type="radio"
                  name={`pick-${pick.key}`}
                  value={option}
                  defaultChecked={props.answers[`pick-${pick.key}`] === option}
                  className="peer sr-only"
                />
                <span className={side}>{pick[option]}</span>
              </label>
            ))}
          </div>
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="type-display pb-3 text-3xl">Fill in the blanks</legend>
        {props.questions.map((question) => (
          <Field key={question.key} label={question.ask} name={`answer-${question.key}`} defaultValue={props.answers[question.key] ?? ""} maxLength={80} />
        ))}
      </fieldset>

      <Field
        label="What you don't eat"
        hint="Used when suggesting dinners. Leave empty if you eat everything."
        name="avoids"
        defaultValue={props.avoids}
        maxLength={120}
        placeholder="Fish, coriander"
      />
    </SavableForm>
  );
}
