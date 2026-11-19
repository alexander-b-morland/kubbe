import { redirect } from "next/navigation";
import { hasExtra, type ExtraKey } from "@/lib/extras";
import { requireHousehold } from "@/lib/session";

/**
 * The signed-in user and their household, for a screen or action that belongs to an
 * extra. If the household has switched that extra off, Home is the place to be.
 */
export async function requireExtra(key: ExtraKey) {
  const found = await requireHousehold();
  if (!hasExtra(found.household, key)) redirect("/home");
  return found;
}
