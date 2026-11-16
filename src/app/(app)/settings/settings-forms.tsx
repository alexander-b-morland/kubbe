"use client";

import { useActionState } from "react";
import { ActionButton } from "@/components/ui/action-button";
import { Field, selectLook } from "@/components/ui/form";
import { SavableForm } from "@/components/ui/savable-form";
import { clockLabel, describeSlotLength } from "@/lib/booking/status";
import type { SettingsState } from "./actions";

type Action = (previous: SettingsState, form: FormData) => Promise<SettingsState>;

const halfHours = Array.from({ length: 49 }, (_, index) => index * 30);

/** The small "open me" hint at the end of a row that unfolds. */
function Chevron() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6 shrink-0 transition-transform group-open:rotate-180">
      <path d="M5 9C8 12 10 14 12 16C14 14 16 12 19 9" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

export type ResourceFormValues = {
  id: string;
  kind: "shower" | "washer" | "dryer";
  name: string;
  enabled: boolean;
  slotMinutes: number;
  opensAt: number;
  closesAt: number;
  maxPerDay: number;
  allowBackToBack: boolean;
  bookAheadDays: number;
};

export function ResourceForm({
  resource,
  slotLengths,
  action,
  remove,
}: {
  resource: ResourceFormValues;
  slotLengths: readonly number[];
  action: Action;
  /** Present only when there is another of the same kind, so this one may go. */
  remove?: () => Promise<SettingsState>;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const summary = resource.enabled
    ? `${describeSlotLength(resource.slotMinutes)} slots, ${clockLabel(resource.opensAt)} to ${clockLabel(resource.closesAt)}`
    : "Switched off";

  return (
    <details className="group border-b-2 border-ink/15" data-testid={`resource-${resource.kind}`} data-name={resource.name}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg py-4 outline-none focus-visible:ring-4 focus-visible:ring-fjord [&::-webkit-details-marker]:hidden">
        <span className="flex flex-col">
          <span className="type-display text-3xl">{resource.name}</span>
          <span className="text-ink-soft">{summary}</span>
        </span>
        <Chevron />
      </summary>
      <div className="pb-6">
        <SavableForm action={formAction} state={state} resetKey={JSON.stringify(resource)} variant="primary">
          <Field label="Name" name="name" defaultValue={resource.name} maxLength={30} />
          <label className="flex flex-col gap-1">
            <span className="flex items-center gap-3 text-lg font-semibold">
              <input type="checkbox" name="enabled" defaultChecked={resource.enabled} className="size-6 accent-ink" />
              Switched on
            </span>
            <span className="text-sm text-ink-soft">Switch off if your home doesn&apos;t have one. It then can&apos;t be booked.</span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">Slot length</span>
            <select name="slotMinutes" defaultValue={resource.slotMinutes} className={selectLook}>
              {slotLengths.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes < 60 ? `${minutes} minutes` : `${minutes / 60} ${minutes === 60 ? "hour" : "hours"}`}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold">Bookable from</span>
              <select name="opensAt" defaultValue={clockLabel(resource.opensAt)} className={selectLook}>
                {halfHours.slice(0, -1).map((minutes) => (
                  <option key={minutes}>{clockLabel(minutes)}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold">Until</span>
              <select name="closesAt" defaultValue={clockLabel(resource.closesAt)} className={selectLook}>
                {halfHours.slice(1).map((minutes) => (
                  <option key={minutes}>{clockLabel(minutes)}</option>
                ))}
              </select>
            </label>
          </div>
          <Field
            label="Slots per person a day"
            name="maxPerDay"
            type="number"
            inputMode="numeric"
            min={1}
            max={12}
            defaultValue={resource.maxPerDay}
          />
          <Field
            label="Book up to this many days ahead"
            hint="0 means today only."
            name="bookAheadDays"
            type="number"
            inputMode="numeric"
            min={0}
            max={30}
            defaultValue={resource.bookAheadDays}
          />
          <label className="flex items-center gap-3 text-lg font-semibold">
            <input type="checkbox" name="allowBackToBack" defaultChecked={resource.allowBackToBack} className="size-6 accent-ink" />
            Allow two slots in a row
          </label>
        </SavableForm>
        {remove ? (
          <div className="pt-4">
            <ActionButton
              align="start"
              label={`Remove ${resource.name}`}
              confirm={`Remove ${resource.name} and its bookings?`}
              action={remove}
            >
              Remove
            </ActionButton>
          </div>
        ) : null}
      </div>
    </details>
  );
}

export function RenameForm({ name, action }: { name: string; action: Action }) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <SavableForm action={formAction} state={state} resetKey={name} saveLabel="Save name">
      <Field label="Household name" name="name" defaultValue={name} maxLength={40} />
    </SavableForm>
  );
}

export function TimeZoneForm({ timeZone, zones, action }: { timeZone: string; zones: readonly string[]; action: Action }) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    // One choice, so picking it saves it.
    <SavableForm action={formAction} state={state} resetKey={timeZone} autoSave>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Time zone</span>
        <select name="timeZone" defaultValue={timeZone} className={selectLook}>
          {zones.map((zone) => (
            <option key={zone} value={zone}>
              {zone.replaceAll("_", " ")}
            </option>
          ))}
        </select>
        <span className="text-sm text-ink-soft">Slot times are shown in this zone for everyone. Picking one saves it.</span>
      </label>
    </SavableForm>
  );
}

export function ExtrasForm({
  extras,
  enabled,
  action,
}: {
  extras: readonly { key: string; name: string; blurb: string }[];
  enabled: readonly string[];
  action: Action;
}) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <SavableForm action={formAction} state={state} resetKey={enabled.join(",")}>
      {extras.map((extra) => (
        <label key={extra.key} className="flex flex-col gap-1">
          <span className="flex items-center gap-3 text-lg font-semibold">
            <input type="checkbox" name={extra.key} defaultChecked={enabled.includes(extra.key)} className="size-6 accent-ink" />
            {extra.name}
          </span>
          <span className="text-sm text-ink-soft">{extra.blurb}</span>
        </label>
      ))}
    </SavableForm>
  );
}
