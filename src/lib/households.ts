import { eq } from "drizzle-orm";
import { db } from "@/db";
import { household, membership, resource, user } from "@/db/schema";
import { defaultResourcesFor } from "@/lib/booking/defaults";
import { generateJoinCode } from "@/lib/join-code";
import { MEMBER_COLOURS, nextMemberColour } from "@/lib/member-colours";

export const MAX_MEMBERS = 20;
const DEFAULT_TIME_ZONE = "Europe/Oslo";

type PgError = { code?: string; constraint?: string; cause?: unknown };

// Drizzle wraps driver errors, so look down the chain of causes.
function isUniqueViolation(error: unknown, constraint: string): boolean {
  const seen = new Set<unknown>();
  let current = error as PgError | undefined;
  while (current && !seen.has(current)) {
    seen.add(current);
    if (current.code === "23505" && (current.constraint ?? "").includes(constraint)) return true;
    current = current.cause as PgError | undefined;
  }
  return false;
}

export function resolveTimeZone(input: string): string {
  return Intl.supportedValuesOf("timeZone").includes(input) ? input : DEFAULT_TIME_ZONE;
}

export type CreateResult = { ok: true } | { ok: false; reason: "already-member" };

/** Create a household with its default resources and make the creator its admin, in one transaction. */
export async function createHousehold(
  userId: string,
  name: string,
  timeZone: string,
): Promise<CreateResult> {
  // A join code can collide, however rarely: try a few fresh ones.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await db.transaction(async (tx) => {
        const [created] = await tx
          .insert(household)
          .values({
            name,
            timeZone: resolveTimeZone(timeZone),
            joinCode: generateJoinCode(),
            createdBy: userId,
          })
          .returning({ id: household.id });
        await tx
          .insert(membership)
          .values({ householdId: created.id, userId, role: "admin", colour: MEMBER_COLOURS[0] });
        await tx.insert(resource).values(defaultResourcesFor(created.id));
      });
      return { ok: true };
    } catch (error) {
      if (isUniqueViolation(error, "membership_one_household_per_user")) {
        return { ok: false, reason: "already-member" };
      }
      if (!isUniqueViolation(error, "join_code")) throw error;
    }
  }
  throw new Error("Could not find a free join code.");
}

export async function findHouseholdByCode(code: string) {
  const [found] = await db
    .select({ id: household.id, name: household.name })
    .from(household)
    .where(eq(household.joinCode, code))
    .limit(1);
  return found ?? null;
}

export type JoinResult =
  | { ok: true }
  | { ok: false; reason: "not-found" | "full" | "already-member" };

export async function joinHousehold(userId: string, code: string): Promise<JoinResult> {
  const found = await findHouseholdByCode(code);
  if (!found) return { ok: false, reason: "not-found" };

  try {
    return await db.transaction(async (tx): Promise<JoinResult> => {
      const members = await tx
        .select({ colour: membership.colour })
        .from(membership)
        .where(eq(membership.householdId, found.id));
      if (members.length >= MAX_MEMBERS) return { ok: false, reason: "full" };
      await tx.insert(membership).values({
        householdId: found.id,
        userId,
        role: "member",
        colour: nextMemberColour(members.map((member) => member.colour)),
      });
      return { ok: true };
    });
  } catch (error) {
    if (isUniqueViolation(error, "membership")) return { ok: false, reason: "already-member" };
    throw error;
  }
}

/** Everyone in a household: admins first, then in the order they joined. */
export async function listMembers(householdId: string) {
  const rows = await db
    .select({
      userId: membership.userId,
      name: user.name,
      role: membership.role,
      colour: membership.colour,
      joinedAt: membership.joinedAt,
    })
    .from(membership)
    .innerJoin(user, eq(membership.userId, user.id))
    .where(eq(membership.householdId, householdId));
  return rows.sort(
    (a, b) =>
      Number(b.role === "admin") - Number(a.role === "admin") ||
      a.joinedAt.getTime() - b.joinedAt.getTime(),
  );
}
