import { and, asc, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/db";
import { happening, happeningReply } from "@/db/schema";

// Happenings: something to do together, and who is in. Callers have already established
// who is asking and which household they are in (see requireExtra).

export type HappeningInput = { title: string; startsAt: Date; place: string; details: string };

/** What is coming up, soonest first. Something that started in the last three hours still counts. */
export async function listUpcoming(householdId: string, now: Date) {
  const since = new Date(now.getTime() - 3 * 3_600_000);
  const rows = await db
    .select()
    .from(happening)
    .where(and(eq(happening.householdId, householdId), gte(happening.startsAt, since)))
    .orderBy(asc(happening.startsAt));
  if (rows.length === 0) return [];
  const replies = await db
    .select()
    .from(happeningReply)
    .where(inArray(happeningReply.happeningId, rows.map((row) => row.id)));
  return rows.map((row) => ({
    ...row,
    going: replies.filter((reply) => reply.happeningId === row.id && reply.going).map((reply) => reply.userId),
    notGoing: replies.filter((reply) => reply.happeningId === row.id && !reply.going).map((reply) => reply.userId),
  }));
}

/** Suggest something. Whoever suggests it is in. */
export async function addHappening(householdId: string, userId: string, input: HappeningInput) {
  await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(happening)
      .values({ householdId, createdBy: userId, ...input })
      .returning({ id: happening.id });
    await tx.insert(happeningReply).values({ happeningId: created.id, userId, going: true });
  });
}

/** Say whether you are in. */
export async function setReply(householdId: string, userId: string, happeningId: string, going: boolean) {
  const [found] = await db
    .select({ id: happening.id })
    .from(happening)
    .where(and(eq(happening.id, happeningId), eq(happening.householdId, householdId)));
  if (!found) return false;
  await db
    .insert(happeningReply)
    .values({ happeningId, userId, going })
    .onConflictDoUpdate({ target: [happeningReply.happeningId, happeningReply.userId], set: { going } });
  return true;
}

/** Call it off. Whoever suggested it can, and so can an admin. */
export async function removeHappening(householdId: string, userId: string, happeningId: string, isAdmin: boolean) {
  const mine = and(eq(happening.id, happeningId), eq(happening.householdId, householdId));
  await db.delete(happening).where(isAdmin ? mine : and(mine, eq(happening.createdBy, userId)));
}
