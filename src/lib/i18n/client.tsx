"use client";

import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { INTL_LOCALE, translator, type Locale } from "./index";

const LocaleContext = createContext<Locale>("en");

/** Gives the parts of a screen that run in the browser the reader's language. */
export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  // The page shell is the same for everyone, so the document's language is set here.
  useEffect(() => {
    document.documentElement.lang = INTL_LOCALE[locale].slice(0, 2);
  }, [locale]);
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

/** The reader's language, in a component that runs in the browser. */
export function useLocale() {
  return useContext(LocaleContext);
}

/** The translate function, in a component that runs in the browser: `const t = useT()`. */
export function useT() {
  const locale = useContext(LocaleContext);
  return useMemo(() => translator(locale), [locale]);
}
