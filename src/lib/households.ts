import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { household, membership, profile, resource, user, removalNotice } from "@/db/schema";
import { defaultResourcesFor } from "@/lib/booking/defaults";
import { en, type Translate } from "@/lib/i18n";
import { generateJoinCode } from "@/lib/join-code";
import { pinCurrentTurns } from "@/lib/cleaning/service";
import { AVATAR_NAMES, DEFAULT_AVATAR } from "@/components/avatar/avatars";
import { MEMBER_COLOURS, nextMemberColour } from "@/lib/member-colours";
import { lockHousehold } from "@/lib/settings";
import { dayInZone, isTimeZone } from "@/lib/time";

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

/** The zone a browser reported, if the server knows it. Otherwise the default. */
export function resolveTimeZone(input: string): string {
  return isTimeZone(input) ? input : DEFAULT_TIME_ZONE;
}

export type CreateResult = { ok: true } | { ok: false; reason: "already-member" };

/** Create a household with its default resources and make the creator its admin, in one transaction. */
export async function createHousehold(
  userId: string,
  name: string,
  timeZone: string,
  t: Translate = en,
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
        await tx.insert(resource).values(defaultResourcesFor(created.id, t));
        await tx.delete(removalNotice).where(eq(removalNotice.userId, userId));
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
    .select({ id: household.id, name: household.name, timeZone: household.timeZone })
    .from(household)
    .where(eq(household.joinCode, code))
    .limit(1);
  return found ?? null;
}

export async function countMembers(householdId: string) {
  const [row] = await db.select({ members: count() }).from(membership).where(eq(membership.householdId, householdId));
  return row.members;
}

export type JoinResult =
  | { ok: true }
  | { ok: false; reason: "not-found" | "full" | "already-member" };

export async function joinHousehold(userId: string, code: string): Promise<JoinResult> {
  const found = await findHouseholdByCode(code);
  if (!found) return { ok: false, reason: "not-found" };

  try {
    return await db.transaction(async (tx): Promise<JoinResult> => {
      // One change to who lives here at a time, so the size limit holds and nobody
      // joins a household in the moment its last member leaves and deletes it.
      if (!(await lockHousehold(tx, found.id))) return { ok: false, reason: "not-found" };
      const members = await tx
        .select({ colour: membership.colour, avatar: profile.avatar })
        .from(membership)
        .leftJoin(profile, eq(profile.userId, membership.userId))
        .where(eq(membership.householdId, found.id));
      if (members.length >= MAX_MEMBERS) return { ok: false, reason: "full" };
      // A new person changes the cleaning rotation. Turns under way stay where they are.
      await pinCurrentTurns(tx, found.id, dayInZone(new Date(), found.timeZone));
      await tx.insert(membership).values({
        householdId: found.id,
        userId,
        role: "member",
        colour: nextMemberColour(members.map((member) => member.colour)),
      });
      // Someone who has never picked an avatar starts with one nobody here has, so five
      // new roommates are not five trout. A profile that exists is left alone.
      const taken = members.map((member) => member.avatar ?? DEFAULT_AVATAR);
      const avatar = AVATAR_NAMES.find((name) => !taken.includes(name)) ?? DEFAULT_AVATAR;
      await tx.insert(profile).values({ userId, avatar }).onConflictDoNothing();
      await tx.delete(removalNotice).where(eq(removalNotice.userId, userId));
      return { ok: true };
    });
  } catch (error) {
    if (isUniqueViolation(error, "membership")) return { ok: false, reason: "already-member" };
    throw error;
  }
}

/** Why someone landed on the start screen, if an admin removed them from a household. */
export async function getRemovalNotice(userId: string) {
  const [found] = await db.select({ householdName: removalNotice.householdName }).from(removalNotice).where(eq(removalNotice.userId, userId));
  return found ?? null;
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
      avatar: profile.avatar,
    })
    .from(membership)
    .innerJoin(user, eq(membership.userId, user.id))
    .leftJoin(profile, eq(profile.userId, user.id))
    .where(eq(membership.householdId, householdId));
  // In the order people moved in. The list never reshuffles when someone's role changes,
  // so a button does not move from under a finger.
  return rows.sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime() || a.userId.localeCompare(b.userId));
}
