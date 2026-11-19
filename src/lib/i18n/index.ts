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
  /**
   * A sentence that was put together somewhere the reader was not known, such as an error
   * from a server action: "Oat milk is already on the list." It is matched against the
   * texts with values in them ("{0} is already on the list.") and said in the reader's
   * language with the same values. Use it only where such a message is shown.
   */
  loose(text: string): string;
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
  let patterns: { match: RegExp; to: string }[] | undefined;
  const loose = (text: string) => {
    if (!table) return text;
    if (table[text] !== undefined) return table[text];
    // Built once, on the first sentence that is not in the table as it stands.
    patterns ??= Object.entries(table)
      .filter(([key]) => /\{\d+\}/.test(key) && key.replace(/\{\d+\}/g, "").trim().length >= 6)
      .map(([key, to]) => ({
        match: new RegExp(`^${key.split(/\{\d+\}/).map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("(.+?)")}$`, "s"),
        to: (key.match(/\{\d+\}/g) ?? []).reduce((text, slot, index) => text.replaceAll(slot, `\u0000${index}\u0000`), to),
      }));
    for (const { match, to } of patterns) {
      const found = text.match(match);
      if (found) return to.replace(/\u0000(\d+)\u0000/g, (_, index) => found[Number(index) + 1] ?? "");
    }
    return text;
  };
  return Object.assign(translate, { locale, loose }) as Translate;
}

/**
 * Marks a text that is written where no reader is known yet (a list of areas, a schema's
 * message) and translated where it is shown, with t(text). It changes nothing: it is
 * there so the test that looks for untranslated texts can find these too.
 */
export const m = (text: string) => text;

/** English, for code that runs without a reader: tests, and defaults in pure functions. */
export const en = translator("en");
