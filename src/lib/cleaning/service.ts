import { and, asc, count, eq, gte, inArray } from "drizzle-orm";
import { db, type Transaction } from "@/db";
import { cleaningArea, cleaningDone, cleaningTakeover, household, membership, user } from "@/db/schema";
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
    const held = (p: number) => takeovers.find((t) => t.areaId === area.id && t.period === p);
    const takenBy = (p: number) => held(p)?.userId;
    const who = (p: number) => {
      const id = assigneeFor({ period: p, areaIndex, memberIds, takenBy: takenBy(p) });
      return id ? (personById.get(id) ?? null) : null;
    };
    const doneIn = (p: number) => doneRows.find((d) => d.areaId === area.id && d.period === p);
    const done = doneIn(period);
    const current = held(period);

    return {
      areaId: area.id,
      name: area.name,
      intervalDays: area.intervalDays,
      estimateMinutes: area.estimateMinutes,
      period,
      lastDay: periodDays(area, period).to,
      assignee: who(period),
      // A pinned turn is still the rotation's choice, so it is not shown as taken over.
      takenOver: Boolean(current && !current.pinned && memberIds.includes(current.userId)),
      done: done ? { by: personById.get(done.doneBy) ?? null, at: done.doneAt } : null,
      next: who(period + 1),
      lastWasSkipped: period > 0 && !doneIn(period - 1),
    };
  });
}

/**
 * Freeze the turns that are under way. Whose turn it is depends on who lives there and
 * on the order of the rooms, so call this, inside the same transaction, just before
 * someone moves in or out or a room is removed. Without it, a turn somebody has been
 * counting on all week would silently become someone else's.
 */
export async function pinCurrentTurns(tx: Transaction, householdId: string, today: string) {
  const areas = await tx
    .select()
    .from(cleaningArea)
    .where(eq(cleaningArea.householdId, householdId))
    .orderBy(asc(cleaningArea.createdAt));
  if (areas.length === 0) return;

  const people = await tx
    .select({ userId: membership.userId })
    .from(membership)
    .where(eq(membership.householdId, householdId))
    .orderBy(asc(membership.joinedAt), asc(membership.userId));
  const memberIds = people.map((person) => person.userId);
  if (memberIds.length === 0) return;

  const held = await tx
    .select()
    .from(cleaningTakeover)
    .where(inArray(cleaningTakeover.areaId, areas.map((area) => area.id)));

  const pins = areas.flatMap((area, areaIndex) => {
    const period = periodOn(area, today);
    if (held.some((row) => row.areaId === area.id && row.period === period)) return [];
    const userId = assigneeFor({ period, areaIndex, memberIds });
    return userId ? [{ areaId: area.id, period, userId, pinned: true }] : [];
  });
  if (pins.length > 0) await tx.insert(cleaningTakeover).values(pins).onConflictDoNothing();
}

export async function createArea(householdId: string, input: AreaInput, today: string) {
  return db.transaction(async (tx) => {
    // Lock the household so two requests cannot both pass the count.
    await tx.select({ id: household.id }).from(household).where(eq(household.id, householdId)).for("update");
    const [existing] = await tx.select({ areas: count() }).from(cleaningArea).where(eq(cleaningArea.householdId, householdId));
    if (existing.areas >= MAX_AREAS) return false;
    await tx.insert(cleaningArea).values({ householdId, ...input, startDay: startDayFor(today, input.intervalDays) });
    return true;
  });
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

export async function deleteArea(householdId: string, areaId: string, today: string) {
  await db.transaction(async (tx) => {
    // Removing a room moves the later rooms up one place in the rotation.
    await pinCurrentTurns(tx, householdId, today);
    await tx.delete(cleaningArea).where(and(eq(cleaningArea.id, areaId), eq(cleaningArea.householdId, householdId)));
  });
}

/**
 * Deal the turns that are under way out again, between everyone who lives there now.
 * Turns normally stay where they are when people move in or out; this is the admin
 * saying "share this round out afresh". Turns already marked done stay done.
 */
export async function redealTurns(householdId: string, today: string) {
  await db.transaction(async (tx) => {
    const areas = await tx.select().from(cleaningArea).where(eq(cleaningArea.householdId, householdId));
    for (const area of areas) {
      await tx
        .delete(cleaningTakeover)
        .where(and(eq(cleaningTakeover.areaId, area.id), eq(cleaningTakeover.period, periodOn(area, today))));
    }
  });
}

/** "stale" means the screen showed an earlier period than the one that is running now. */
export type TurnResult = "ok" | "gone" | "stale";

/**
 * Whether the room is in this household, and whether the period the person was looking
 * at is still the one running. A phone can show last week's screen for days.
 */
async function currentTurn(householdId: string, areaId: string, today: string, shownPeriod: number): Promise<TurnResult> {
  const [found] = await db
    .select()
    .from(cleaningArea)
    .where(and(eq(cleaningArea.id, areaId), eq(cleaningArea.householdId, householdId)));
  if (!found) return "gone";
  return periodOn(found, today) === shownPeriod ? "ok" : "stale";
}

/** Mark the current period of a room as cleaned. Anyone living there can, whoever's turn it was. */
export async function markDone(householdId: string, userId: string, areaId: string, today: string, period: number): Promise<TurnResult> {
  const state = await currentTurn(householdId, areaId, today, period);
  if (state === "ok") await db.insert(cleaningDone).values({ areaId, period, doneBy: userId }).onConflictDoNothing();
  return state;
}

/** Take back your own "done" for the current period. */
export async function undoDone(householdId: string, userId: string, areaId: string, today: string, period: number): Promise<TurnResult> {
  const state = await currentTurn(householdId, areaId, today, period);
  if (state === "ok") {
    await db
      .delete(cleaningDone)
      .where(and(eq(cleaningDone.areaId, areaId), eq(cleaningDone.period, period), eq(cleaningDone.doneBy, userId)));
  }
  return state;
}

/** Take the current turn of a room over from whoever has it. */
export async function takeOver(householdId: string, userId: string, areaId: string, today: string, period: number): Promise<TurnResult> {
  const state = await currentTurn(householdId, areaId, today, period);
  if (state === "ok") {
    await db
      .insert(cleaningTakeover)
      .values({ areaId, period, userId, pinned: false })
      .onConflictDoUpdate({ target: [cleaningTakeover.areaId, cleaningTakeover.period], set: { userId, pinned: false } });
  }
  return state;
}

/** Hand a turn you took over back to whoever's turn it was. */
export async function giveBack(householdId: string, userId: string, areaId: string, today: string, period: number): Promise<TurnResult> {
  const state = await currentTurn(householdId, areaId, today, period);
  if (state === "ok") {
    await db
      .delete(cleaningTakeover)
      .where(
        and(
          eq(cleaningTakeover.areaId, areaId),
          eq(cleaningTakeover.period, period),
          eq(cleaningTakeover.userId, userId),
          eq(cleaningTakeover.pinned, false),
        ),
      );
  }
  return state;
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
