import { and, asc, count, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/db";
import { cleaningArea, cleaningDone, cleaningTakeover, membership, user } from "@/db/schema";
import { assigneeFor, periodDays, periodOn, startDayFor } from "./rota";

// Database work behind the Cleaning screen. Callers have already established who is
// asking and which household they are in (see requireHousehold).

export const INTERVALS = [1, 2, 3, 7, 14, 21, 28] as const;
export const ESTIMATES = [5, 10, 15, 20, 30, 45, 60, 90] as const;
export const MAX_AREAS = 20;

export type AreaInput = { name: string; intervalDays: number; estimateMinutes: number };

type Person = { userId: string; name: string; colour: string };

export type RotaRow = {
  areaId: string;
  name: string;
  intervalDays: number;
  estimateMinutes: number;
  period: number;
  /** Last day of the current period. */
  lastDay: string;
  /** Whose turn it is now. Null only when nobody lives there. */
  assignee: Person | null;
  /** True when the assignee took this turn over from someone else. */
  takenOver: boolean;
  done: { by: Person | null; at: Date } | null;
  /** Whose turn the next period is. */
  next: Person | null;
  /** The period before this one ended without anyone marking it done. */
  lastWasSkipped: boolean;
};

export async function listAreas(householdId: string) {
  return db
    .select()
    .from(cleaningArea)
    .where(eq(cleaningArea.householdId, householdId))
    .orderBy(asc(cleaningArea.createdAt));
}

/** Everything the Cleaning screen shows about the current turns. */
export async function getRota(householdId: string, today: string): Promise<RotaRow[]> {
  const [areas, people] = await Promise.all([
    listAreas(householdId),
    db
      .select({ userId: membership.userId, name: user.name, colour: membership.colour })
      .from(membership)
      .innerJoin(user, eq(membership.userId, user.id))
      .where(eq(membership.householdId, householdId))
      .orderBy(asc(membership.joinedAt), asc(membership.userId)),
  ]);
  if (areas.length === 0) return [];

  const areaIds = areas.map((area) => area.id);
  const [doneRows, takeovers] = await Promise.all([
    db.select().from(cleaningDone).where(inArray(cleaningDone.areaId, areaIds)),
    db.select().from(cleaningTakeover).where(inArray(cleaningTakeover.areaId, areaIds)),
  ]);

  const memberIds = people.map((person) => person.userId);
  const personById = new Map(people.map((person) => [person.userId, person]));

  return areas.map((area, areaIndex) => {
    const period = periodOn(area, today);
    const takenBy = (p: number) => takeovers.find((t) => t.areaId === area.id && t.period === p)?.userId;
    const who = (p: number) => {
      const id = assigneeFor({ period: p, areaIndex, memberIds, takenBy: takenBy(p) });
      return id ? (personById.get(id) ?? null) : null;
    };
    const doneIn = (p: number) => doneRows.find((d) => d.areaId === area.id && d.period === p);
    const done = doneIn(period);
    const current = takenBy(period);

    return {
      areaId: area.id,
      name: area.name,
      intervalDays: area.intervalDays,
      estimateMinutes: area.estimateMinutes,
      period,
      lastDay: periodDays(area, period).to,
      assignee: who(period),
      takenOver: Boolean(current && memberIds.includes(current)),
      done: done ? { by: personById.get(done.doneBy) ?? null, at: done.doneAt } : null,
      next: who(period + 1),
      lastWasSkipped: period > 0 && !doneIn(period - 1),
    };
  });
}

export async function createArea(householdId: string, input: AreaInput, today: string) {
  const [existing] = await db.select({ areas: count() }).from(cleaningArea).where(eq(cleaningArea.householdId, householdId));
  if (existing.areas >= MAX_AREAS) return false;
  await db.insert(cleaningArea).values({ householdId, ...input, startDay: startDayFor(today, input.intervalDays) });
  return true;
}

/**
 * Change a room. A new rhythm starts over from today, and with it the record of
 * which periods were done, since the periods are no longer the same ones.
 */
export async function updateArea(householdId: string, areaId: string, input: AreaInput, today: string) {
  return db.transaction(async (tx) => {
    const [found] = await tx
      .select()
      .from(cleaningArea)
      .where(and(eq(cleaningArea.id, areaId), eq(cleaningArea.householdId, householdId)));
    if (!found) return false;

    if (found.intervalDays !== input.intervalDays) {
      await tx.delete(cleaningDone).where(eq(cleaningDone.areaId, areaId));
      await tx.delete(cleaningTakeover).where(eq(cleaningTakeover.areaId, areaId));
      await tx
        .update(cleaningArea)
        .set({ ...input, startDay: startDayFor(today, input.intervalDays) })
        .where(eq(cleaningArea.id, areaId));
    } else {
      await tx.update(cleaningArea).set(input).where(eq(cleaningArea.id, areaId));
    }
    return true;
  });
}

export async function deleteArea(householdId: string, areaId: string) {
  await db.delete(cleaningArea).where(and(eq(cleaningArea.id, areaId), eq(cleaningArea.householdId, householdId)));
}

/** The room, if it is in this household, with the period that today falls in. */
async function areaNow(householdId: string, areaId: string, today: string) {
  const [found] = await db
    .select()
    .from(cleaningArea)
    .where(and(eq(cleaningArea.id, areaId), eq(cleaningArea.householdId, householdId)));
  return found ? { area: found, period: periodOn(found, today) } : null;
}

/** Mark the current period of a room as cleaned. Anyone living there can, whoever's turn it was. */
export async function markDone(householdId: string, userId: string, areaId: string, today: string) {
  const now = await areaNow(householdId, areaId, today);
  if (!now) return false;
  await db.insert(cleaningDone).values({ areaId, period: now.period, doneBy: userId }).onConflictDoNothing();
  return true;
}

/** Take back your own "done" for the current period. */
export async function undoDone(householdId: string, userId: string, areaId: string, today: string) {
  const now = await areaNow(householdId, areaId, today);
  if (!now) return false;
  await db
    .delete(cleaningDone)
    .where(and(eq(cleaningDone.areaId, areaId), eq(cleaningDone.period, now.period), eq(cleaningDone.doneBy, userId)));
  return true;
}

/** Take the current turn of a room over from whoever has it. */
export async function takeOver(householdId: string, userId: string, areaId: string, today: string) {
  const now = await areaNow(householdId, areaId, today);
  if (!now) return false;
  await db
    .insert(cleaningTakeover)
    .values({ areaId, period: now.period, userId })
    .onConflictDoUpdate({ target: [cleaningTakeover.areaId, cleaningTakeover.period], set: { userId } });
  return true;
}

/** Hand a turn you took over back to whoever's turn it was. */
export async function giveBack(householdId: string, userId: string, areaId: string, today: string) {
  const now = await areaNow(householdId, areaId, today);
  if (!now) return false;
  await db
    .delete(cleaningTakeover)
    .where(
      and(eq(cleaningTakeover.areaId, areaId), eq(cleaningTakeover.period, now.period), eq(cleaningTakeover.userId, userId)),
    );
  return true;
}

/** How many turns each person has marked done since a point in time. */
export async function tally(householdId: string, since: Date) {
  const rows = await db
    .select({ userId: cleaningDone.doneBy, turns: count() })
    .from(cleaningDone)
    .innerJoin(cleaningArea, eq(cleaningDone.areaId, cleaningArea.id))
    .where(and(eq(cleaningArea.householdId, householdId), gte(cleaningDone.doneAt, since)))
    .groupBy(cleaningDone.doneBy);
  return new Map(rows.map((row) => [row.userId, row.turns]));
}
