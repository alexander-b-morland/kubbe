"use client";

import { useEffect, useRef, useState } from "react";
import { formatAmount, parseAmount } from "@/lib/money";
import { useT } from "@/lib/i18n/client";

type Person = { userId: string; name: string };

const box = "h-12 w-28 rounded-xl border-2 border-ink bg-white/70 px-3 text-lg outline-none placeholder:text-ink-soft focus-visible:ring-4 focus-visible:ring-fjord";

/**
 * Who shares a cost. Evenly between the people ticked, or an amount each. With amounts,
 * it counts along with the form's "amount" field and says what is left to share out.
 */
export function SplitFields({
  people,
  currency = "kr",
  legend,
  initial,
  ticked,
}: {
  people: Person[];
  currency?: string;
  legend?: string;
  /** Each person's part of an expense being corrected. */
  initial?: Record<string, number>;
  /** Who is ticked to begin with, when it is not everyone. */
  ticked?: readonly string[];
}) {
  const t = useT();
  // An even split can differ by one øre between people: that is still an even split.
  const parts0 = Object.values(initial ?? {});
  const uneven = parts0.length > 0 && Math.max(...parts0) - Math.min(...parts0) > 1;
  const [mode, setMode] = useState<"even" | "amounts">(uneven ? "amounts" : "even");
  const [parts, setParts] = useState<Record<string, string>>(() =>
    Object.fromEntries(people.map((person) => [person.userId, initial?.[person.userId] ? formatAmount(initial[person.userId], "").trim() : ""])),
  );
  const [total, setTotal] = useState<number | null>(null);
  const fieldset = useRef<HTMLFieldSetElement>(null);

  // Follow the amount typed elsewhere in the same form.
  useEffect(() => {
    const form = fieldset.current?.form;
    if (!form) return;
    const read = () => setTotal(parseAmount(String(new FormData(form).get("amount") ?? "")));
    read();
    form.addEventListener("input", read);
    return () => form.removeEventListener("input", read);
  }, []);

  const shared = Object.values(parts).reduce((sum, text) => sum + (parseAmount(text) ?? 0), 0);
  const left = total === null ? null : total - shared;
  const negative = Object.values(parts).some((text) => text.trim().startsWith("-"));

  return (
    <fieldset ref={fieldset} className="flex flex-col gap-3">
      <legend className="pb-2 text-sm font-semibold">{legend ?? t("Split between")}</legend>
      <div className="flex gap-2">
        {(["even", "amounts"] as const).map((option) => (
          <label key={option} className="relative">
            <input type="radio" name="split" value={option} checked={mode === option} onChange={() => setMode(option)} className="peer sr-only" />
            <span className="flex min-h-11 items-center rounded-full border-2 border-ink px-4 text-sm font-bold peer-checked:bg-ink peer-checked:text-paper peer-focus-visible:ring-4 peer-focus-visible:ring-fjord">
              {option === "even" ? t("Evenly") : t("An amount each")}
            </span>
          </label>
        ))}
      </div>
      {mode === "even" ? (
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {people.map((person) => (
            <label key={person.userId} className="flex items-center gap-2 text-lg font-semibold">
              <input type="checkbox" name="sharedBy" value={person.userId} defaultChecked={initial ? Boolean(initial[person.userId]) : ticked ? ticked.includes(person.userId) : true} className="size-6 accent-ink" />
              {person.name}
            </label>
          ))}
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {people.map((person) => (
              <li key={person.userId}>
                <label className="flex items-center justify-between gap-3 text-lg font-semibold">
                  {person.name}
                  <input
                    name={`share-${person.userId}`}
                    inputMode="decimal"
                    placeholder="0"
                    value={parts[person.userId] ?? ""}
                    onChange={(event) => setParts((current) => ({ ...current, [person.userId]: event.target.value }))}
                    aria-label={t`${person.name}'s part`}
                    autoComplete="off"
                    className={box}
                  />
                </label>
              </li>
            ))}
          </ul>
          <p role="status" className={`text-sm font-semibold ${negative || (left !== null && left !== 0) ? "text-barn" : "text-ink-soft"}`} data-testid="split-left">
            {negative
              ? t("A part can't be less than nothing.")
              : left === null
              ? t("Enter the amount above, then each person's part.")
              : left === 0
                ? t("The parts add up.")
                : left > 0
                  ? t`${formatAmount(left, currency)} left to share out.`
                  : t`${formatAmount(-left, currency)} too much shared out.`}
          </p>
        </>
      )}
    </fieldset>
  );
}
