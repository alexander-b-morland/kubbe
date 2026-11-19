"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/session";
import { isLocale } from "./index";
import { rememberLocale, saveLocale } from "./server";

/** Switch the whole app to another language: on this device, and on the account if signed in. */
export async function setLocaleAction(locale: string) {
  if (!isLocale(locale)) return;
  await rememberLocale(locale);
  const user = await getUser();
  if (user) await saveLocale(user.id, locale);
  revalidatePath("/", "layout");
}
