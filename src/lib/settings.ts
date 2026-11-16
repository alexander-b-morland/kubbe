import { and, count, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { booking, household, membership, resource } from "@/db/schema";
import { generateJoinCode } from "@/lib/join-code";
import { MEMBER_COLOURS } from "@/lib/member-colours";

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

export async function renameHousehold(householdId: string, name: string) {
  await db.update(household).set({ name }).where(eq(household.id, householdId));
}

/** Replace the join code, so the old one and old invite links stop working. */
export async function replaceJoinCode(householdId: string) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await db.update(household).set({ joinCode: generateJoinCode() }).where(eq(household.id, householdId));
      return;
    } catch (error) {
      if (attempt === 4) throw error;
    }
  }
}

async function adminCount(householdId: string) {
  const [row] = await db
    .select({ admins: count() })
    .from(membership)
    .where(and(eq(membership.householdId, householdId), eq(membership.role, "admin")));
  return row.admins;
}

export type MemberChange = { ok: true } | { ok: false; reason: "last-admin" | "not-found" };

export async function setMemberRole(householdId: string, userId: string, role: "admin" | "member"): Promise<MemberChange> {
  return db.transaction(async (tx): Promise<MemberChange> => {
    const [target] = await tx
      .select({ role: membership.role })
      .from(membership)
      .where(and(eq(membership.householdId, householdId), eq(membership.userId, userId)))
      .for("update");
    if (!target) return { ok: false, reason: "not-found" };
    if (target.role === "admin" && role === "member") {
      const [others] = await tx
        .select({ admins: count() })
        .from(membership)
        .where(and(eq(membership.householdId, householdId), eq(membership.role, "admin"), ne(membership.userId, userId)));
      if (others.admins === 0) return { ok: false, reason: "last-admin" };
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
 */
export async function removeMember(householdId: string, userId: string): Promise<MemberChange> {
  const [target] = await db
    .select({ role: membership.role })
    .from(membership)
    .where(and(eq(membership.householdId, householdId), eq(membership.userId, userId)));
  if (!target) return { ok: false, reason: "not-found" };

  const [everyone] = await db.select({ members: count() }).from(membership).where(eq(membership.householdId, householdId));
  if (everyone.members === 1) {
    // Deleting the household removes its memberships, resources, bookings and rooms.
    await db.delete(household).where(eq(household.id, householdId));
    return { ok: true };
  }
  if (target.role === "admin" && (await adminCount(householdId)) === 1) return { ok: false, reason: "last-admin" };

  await db.transaction(async (tx) => {
    await tx.delete(booking).where(and(eq(booking.householdId, householdId), eq(booking.userId, userId)));
    await tx.delete(membership).where(and(eq(membership.householdId, householdId), eq(membership.userId, userId)));
  });
  return { ok: true };
}

export async function setMemberColour(householdId: string, userId: string, colour: string) {
  if (!(MEMBER_COLOURS as readonly string[]).includes(colour)) return false;
  await db
    .update(membership)
    .set({ colour })
    .where(and(eq(membership.householdId, householdId), eq(membership.userId, userId)));
  return true;
}
