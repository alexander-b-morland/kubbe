import { cookies } from "next/headers";
import { cache } from "react";
import { isLocale, translator, type Locale } from "./index";

// Which language a request is read in. The choice lives in a cookie, so it works before
// signing in too; it is also saved on the person's profile and put back when they sign
// in somewhere else.

export const LOCALE_COOKIE = "kubbe-locale";

/** The reader's language for this request. Read once per request. */
export const getLocale = cache(async (): Promise<Locale> => {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : "en";
});

/** The translate function for this request: `const t = await getT()`. */
export async function getT() {
  return translator(await getLocale());
}

/** Remember the choice on this device for a year. Only callable from a server action. */
export async function rememberLocale(locale: Locale) {
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 365 * 86_400, sameSite: "lax" });
}
