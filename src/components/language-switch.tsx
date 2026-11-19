"use client";

import { useTransition } from "react";
import { setLocaleAction } from "@/lib/i18n/actions";
import { LOCALE_NAMES, LOCALES } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n/client";

/**
 * One switch for the whole app. Each language is named in itself, so it can be found by
 * someone who does not read the language the screen is in.
 */
export function LanguageSwitch({ className = "" }: { className?: string }) {
  const current = useLocale();
  const [pending, startTransition] = useTransition();
  return (
    <div role="group" aria-label="Language / Språk" data-testid="language" className={`flex w-fit gap-1 rounded-full border-2 border-ink p-1 ${pending ? "opacity-70" : ""} ${className}`}>
      {LOCALES.map((locale) => (
        <button
          key={locale}
          type="button"
          lang={locale}
          aria-pressed={locale === current}
          onClick={() => {
            if (locale !== current && !pending) startTransition(() => setLocaleAction(locale));
          }}
          className={`min-h-9 rounded-full px-4 text-sm font-bold outline-none focus-visible:ring-4 focus-visible:ring-fjord focus-visible:ring-offset-2 focus-visible:ring-offset-paper ${locale === current ? "bg-ink text-paper" : ""}`}
        >
          {LOCALE_NAMES[locale]}
        </button>
      ))}
    </div>
  );
}
