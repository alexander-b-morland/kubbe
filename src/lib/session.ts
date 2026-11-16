import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { household, membership } from "@/db/schema";
import { auth } from "@/lib/auth";

/** The signed-in user, or null. */
export async function getUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

/** The signed-in user. Sends visitors to sign in. */
export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/sign-in");
  return user;
}

/** The household this user belongs to, with their membership, or null. */
export async function getHouseholdFor(userId: string) {
  const [row] = await db
    .select({ household, membership })
    .from(membership)
    .innerJoin(household, eq(membership.householdId, household.id))
    .where(eq(membership.userId, userId))
    .limit(1);
  return row ?? null;
}

/**
 * The signed-in user and their household. This is the tenancy boundary:
 * every household query must take its household id from here, never from the client.
 */
export async function requireHousehold() {
  const user = await requireUser();
  const found = await getHouseholdFor(user.id);
  if (!found) redirect("/onboarding");
  return { user, ...found };
}

export { safeNextPath } from "@/lib/safe-next";
