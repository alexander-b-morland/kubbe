import { nb } from "./nb";

// Two languages: English, which the app is written in, and Norwegian (bokmål).
//
// The English text is the key. Code says t("Who's in") or t`${count} to buy`, and the
// Norwegian table maps "Who's in" and "{0} to buy" to their translations. Anything the
// table lacks comes out in English, so a missing entry is a gap, not a crash. A unit
// test finds the gaps.

export const LOCALES = ["en", "nb"] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_NAMES: Record<Locale, string> = { en: "English", nb: "Norsk" };

/** What a browser, a date formatter or Claude should be told for each language. */
export const INTL_LOCALE: Record<Locale, string> = { en: "en-GB", nb: "nb-NO" };

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "nb";
}

type Value = string | number;

export type Translate = {
  /** A fixed text: t("Save"). */
  (text: string): string;
  /** A text with values in it: t`${count} to buy`. */
  (strings: TemplateStringsArray, ...values: Value[]): string;
  locale: Locale;
};

/** The table key for a template: its fixed parts with {0}, {1} where the values go. */
export function keyOf(strings: readonly string[]): string {
  return strings.reduce((key, part, index) => `${key}{${index - 1}}${part}`);
}

const fill = (pattern: string, values: readonly Value[]) => pattern.replace(/\{(\d+)\}/g, (_, index) => String(values[Number(index)] ?? ""));

export function translator(locale: Locale): Translate {
  const table: Record<string, string> | undefined = locale === "nb" ? nb : undefined;
  const translate = (first: string | TemplateStringsArray, ...values: Value[]) => {
    if (typeof first === "string") return table?.[first] ?? first;
    const key = keyOf(first);
    return fill(table?.[key] ?? key, values);
  };
  return Object.assign(translate, { locale }) as Translate;
}

/** English, for code that runs without a reader: tests, and defaults in pure functions. */
export const en = translator("en");
