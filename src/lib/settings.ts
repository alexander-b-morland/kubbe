import { and, count, eq, ne } from "drizzle-orm";
import { db, type Transaction } from "@/db";
import { booking, household, membership, removalNotice, resource } from "@/db/schema";
import { DEFAULT_RESOURCES } from "@/lib/booking/defaults";
import { pinCurrentTurns } from "@/lib/cleaning/service";
import { releaseDinnerDuties } from "@/lib/dinner/service";
import { generateJoinCode } from "@/lib/join-code";
import { MEMBER_COLOURS } from "@/lib/member-colours";
import { dayInZone, isTimeZone } from "@/lib/time";

// Database changes behind the Household screen. Callers have already established
// who is asking and which household they are in (see requireHousehold).

export const SLOT_LENGTHS = [10, 15, 20, 30, 45, 60, 90, 120, 180] as const;

export type ResourceSettings = {
  name: string;
  enabled: boolean;
  slotMinutes: number;
  opensAt: number;
  closesAt: number;
  maxPerDay: number;
  allowBackToBack: boolean;
  bookAheadDays: number;
};

export async function updateResource(householdId: string, resourceId: string, settings: ResourceSettings) {
  const updated = await db
    .update(resource)
    .set(settings)
    .where(and(eq(resource.id, resourceId), eq(resource.householdId, householdId)))
    .returning({ id: resource.id });
  return updated.length === 1;
}

export const MAX_PER_KIND = 6;

type Kind = (typeof DEFAULT_RESOURCES)[number]["kind"];

/**
 * Add another shower, washing machine or dryer. It starts with the same rules as the
 * one the household already has of that kind, since those were set on purpose.
 */
export async function addResource(householdId: string, kind: Kind): Promise<"ok" | "full"> {
  return db.transaction(async (tx) => {
    await lockHousehold(tx, householdId);
    const existing = await tx
      .select()
      .from(resource)
      .where(and(eq(resource.householdId, householdId), eq(resource.kind, kind)))
      .orderBy(resource.createdAt);
    if (existing.length >= MAX_PER_KIND) return "full";
    // Prefer one that is switched on: a switched-off one may never have been set up.
    const like = existing.find((other) => other.enabled) ?? existing[0];

    const defaults = DEFAULT_RESOURCES.find((candidate) => candidate.kind === kind)!;
    // "Shower 2", "Shower 3": the first number no other one is using.
    let number = existing.length + 1;
    while (existing.some((other) => other.name === `${defaults.name} ${number}`)) number++;
    await tx.insert(resource).values({
      ...defaults,
      householdId,
      name: existing.length === 0 ? defaults.name : `${defaults.name} ${number}`,
      enabled: true,
      allowBackToBack: false,
      bookAheadDays: 7,
      ...(like
        ? {
            slotMinutes: like.slotMinutes,
            opensAt: like.opensAt,
            closesAt: like.closesAt,
            maxPerDay: like.maxPerDay,
            allowBackToBack: like.allowBackToBack,
            bookAheadDays: like.bookAheadDays,
          }
        : {}),
    });
    return "ok";
  });
}

/**
 * Remove a shower, washing machine or dryer, and its bookings with it. The last one
 * of a kind stays, so there is always something to switch on or off.
 */
export async function removeResource(householdId: string, resourceId: string): Promise<"ok" | "last" | "gone"> {
  return db.transaction(async (tx) => {
    await lockHousehold(tx, householdId);
    const [found] = await tx
      .select({ kind: resource.kind })
      .from(resource)
      .where(and(eq(resource.id, resourceId), eq(resource.householdId, householdId)));
    if (!found) return "gone";
    const [same] = await tx
      .select({ total: count() })
      .from(resource)
      .where(and(eq(resource.householdId, householdId), eq(resource.kind, found.kind)));
    if (same.total <= 1) return "last";
    await tx.delete(resource).where(and(eq(resource.id, resourceId), eq(resource.householdId, householdId)));
    return "ok";
  });
}

export async function renameHousehold(householdId: string, name: string) {
  await db.update(household).set({ name }).where(eq(household.id, householdId));
}

type PgError = { code?: string; cause?: unknown };

function isUniqueViolation(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current = error as PgError | undefined;
  while (current && !seen.has(current)) {
    seen.add(current);
    if (current.code === "23505") return true;
    current = current.cause as PgError | undefined;
  }
  return false;
}

/** Replace the join code, so the old one and old invite links stop working. */
export async function replaceJoinCode(householdId: string) {
  // A new code can collide with another household's, however rarely: try a few.
  for (let attempt = 0; ; attempt++) {
    try {
      await db.update(household).set({ joinCode: generateJoinCode() }).where(eq(household.id, householdId));
      return;
    } catch (error) {
      if (!isUniqueViolation(error) || attempt === 4) throw error;
    }
  }
}

/**
 * Lock the household for the rest of the transaction. Everything that changes who is
 * in a household, or who is admin, takes this lock first. That makes the checks and
 * the change one step, so two people pressing at the same moment cannot both pass a
 * check that only one of them should (for example the last two admins both leaving).
 */
export async function lockHousehold(tx: Transaction, householdId: string) {
  const [locked] = await tx
    .select({ id: household.id, timeZone: household.timeZone })
    .from(household)
    .where(eq(household.id, householdId))
    .for("update");
  return locked ?? null;
}

async function otherAdmins(tx: Transaction, householdId: string, userId: string) {
  const [row] = await tx
    .select({ admins: count() })
    .from(membership)
    .where(and(eq(membership.householdId, householdId), eq(membership.role, "admin"), ne(membership.userId, userId)));
  return row.admins;
}

export type MemberChange =
  | { ok: true; householdDeleted?: boolean }
  | { ok: false; reason: "last-admin" | "not-found" };

export async function setMemberRole(householdId: string, userId: string, role: "admin" | "member"): Promise<MemberChange> {
  return db.transaction(async (tx): Promise<MemberChange> => {
    if (!(await lockHousehold(tx, householdId))) return { ok: false, reason: "not-found" };
    const [target] = await tx
      .select({ role: membership.role })
      .from(membership)
      .where(and(eq(membership.householdId, householdId), eq(membership.userId, userId)));
    if (!target) return { ok: false, reason: "not-found" };
    if (target.role === "admin" && role === "member" && (await otherAdmins(tx, householdId, userId)) === 0) {
      return { ok: false, reason: "last-admin" };
    }
    await tx
      .update(membership)
      .set({ role })
      .where(and(eq(membership.householdId, householdId), eq(membership.userId, userId)));
    return { ok: true };
  });
}

/**
 * Take someone out of the household: an admin removing a member, or a person leaving.
 * Their bookings there go with them. The last admin cannot go while others remain,
 * and when the last person leaves, the household is deleted.
 *
 * With `replaceCode`, the join code is replaced in the same step. An admin removing
 * someone else needs that: the person who was removed knows the old code.
 */
export async function removeMember(householdId: string, userId: string, options: { replaceCode: boolean; tellThem?: boolean }): Promise<MemberChange> {
  const result = await db.transaction(async (tx): Promise<MemberChange> => {
    const locked = await lockHousehold(tx, householdId);
    if (!locked) return { ok: false, reason: "not-found" };

    const [target] = await tx
      .select({ role: membership.role })
      .from(membership)
      .where(and(eq(membership.householdId, householdId), eq(membership.userId, userId)));
    if (!target) return { ok: false, reason: "not-found" };

    const [everyone] = await tx.select({ members: count() }).from(membership).where(eq(membership.householdId, householdId));
    if (everyone.members === 1) {
      // Deleting the household removes its memberships, resources, bookings and rooms.
      await tx.delete(household).where(eq(household.id, householdId));
      return { ok: true, householdDeleted: true };
    }
    if (target.role === "admin" && (await otherAdmins(tx, householdId, userId)) === 0) {
      return { ok: false, reason: "last-admin" };
    }

    // Keep everyone else's cleaning turn for this period where it is.
    await pinCurrentTurns(tx, householdId, dayInZone(new Date(), locked.timeZone));
    await tx.delete(booking).where(and(eq(booking.householdId, householdId), eq(booking.userId, userId)));
    await releaseDinnerDuties(tx, householdId, userId);
    await tx.delete(membership).where(and(eq(membership.householdId, householdId), eq(membership.userId, userId)));
    // Removed by an admin, they would otherwise land on the start screen without knowing why.
    if (options.tellThem) {
      const [named] = await tx.select({ name: household.name }).from(household).where(eq(household.id, householdId));
      await tx
        .insert(removalNotice)
        .values({ userId, householdName: named.name })
        .onConflictDoUpdate({ target: removalNotice.userId, set: { householdName: named.name, createdAt: new Date() } });
    }
    return { ok: true };
  });

  if (result.ok && !result.householdDeleted && options.replaceCode) await replaceJoinCode(householdId);
  return result;
}

export async function setMemberColour(householdId: string, userId: string, colour: string): Promise<"ok" | "unknown" | "taken"> {
  if (!(MEMBER_COLOURS as readonly string[]).includes(colour)) return "unknown";
  // Two people in one colour cannot be told apart on the calendar. Only once every colour is in use may one repeat.
  const others = await db
    .select({ colour: membership.colour })
    .from(membership)
    .where(and(eq(membership.householdId, householdId), ne(membership.userId, userId)));
  const inUse = new Set(others.map((other) => other.colour));
  if (inUse.has(colour) && MEMBER_COLOURS.some((option) => !inUse.has(option))) return "taken";
  await db
    .update(membership)
    .set({ colour })
    .where(and(eq(membership.householdId, householdId), eq(membership.userId, userId)));
  return "ok";
}

/** Switch the household's extras on and off. Unknown keys are dropped. */
export async function setExtras(householdId: string, extras: string[]) {
  await db.update(household).set({ extras }).where(eq(household.id, householdId));
}

export async function setTimeZone(householdId: string, timeZone: string) {
  if (!isTimeZone(timeZone)) return false;
  await db.update(household).set({ timeZone }).where(eq(household.id, householdId));
  return true;
}
