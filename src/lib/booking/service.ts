import { and, asc, eq, gt, gte, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { booking, membership, resource, user, type Resource } from "@/db/schema";
import { addDays, dayInZone, instantInZone } from "@/lib/time";
import { canCancel, refusalFor, type Refusal } from "./rules";

type PgError = { code?: string; cause?: unknown };

// Postgres reports a broken exclusion constraint with this code. Drizzle wraps
// driver errors, so look down the chain of causes.
function isOverlap(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current = error as PgError | undefined;
  while (current && !seen.has(current)) {
    seen.add(current);
    if (current.code === "23P01") return true;
    current = current.cause as PgError | undefined;
  }
  return false;
}

/** The household's resource of a kind, if it has one switched on. */
export async function findResource(householdId: string, kind: Resource["kind"]) {
  const [found] = await db
    .select()
    .from(resource)
    .where(and(eq(resource.householdId, householdId), eq(resource.kind, kind), eq(resource.enabled, true)))
    .orderBy(asc(resource.createdAt))
    .limit(1);
  return found ?? null;
}

/** The household's switched-on resources of these kinds, in a stable order. */
export async function listEnabled(householdId: string, kinds: Resource["kind"][]) {
  const all = await listResources(householdId);
  return all.filter((candidate) => candidate.enabled && kinds.includes(candidate.kind));
}

/** One resource by id, only if it belongs to this household and is switched on. */
export async function findResourceById(householdId: string, resourceId: string) {
  const [found] = await db
    .select()
    .from(resource)
    .where(and(eq(resource.id, resourceId), eq(resource.householdId, householdId), eq(resource.enabled, true)))
    .limit(1);
  return found ?? null;
}

/** Every resource of the household, switched on or not, in a stable order. */
export async function listResources(householdId: string) {
  const order = { shower: 0, washer: 1, dryer: 2 } as const;
  const rows = await db.select().from(resource).where(eq(resource.householdId, householdId));
  return rows.sort((x, y) => order[x.kind] - order[y.kind] || x.createdAt.getTime() - y.createdAt.getTime());
}

const dayRange = (day: string, timeZone: string) =>
  [instantInZone(day, 0, timeZone), instantInZone(addDays(day, 1), 0, timeZone)] as const;

/** Bookings of a resource on one day, with who made them. */
export async function listDayBookings(resourceId: string, householdId: string, day: string, timeZone: string) {
  const [from, to] = dayRange(day, timeZone);
  return db
    .select({
      id: booking.id,
      userId: booking.userId,
      startsAt: booking.startsAt,
      endsAt: booking.endsAt,
      name: user.name,
      colour: membership.colour,
    })
    .from(booking)
    .innerJoin(user, eq(booking.userId, user.id))
    .innerJoin(membership, and(eq(membership.userId, booking.userId), eq(membership.householdId, booking.householdId)))
    .where(
      and(
        eq(booking.resourceId, resourceId),
        eq(booking.householdId, householdId),
        gte(booking.startsAt, from),
        lt(booking.startsAt, to),
      ),
    )
    .orderBy(asc(booking.startsAt));
}

/** A person's bookings that have not ended yet, soonest first. */
export async function listMyUpcoming(householdId: string, userId: string, now: Date) {
  return db
    .select({ id: booking.id, kind: resource.kind, startsAt: booking.startsAt, endsAt: booking.endsAt })
    .from(booking)
    .innerJoin(resource, eq(booking.resourceId, resource.id))
    .where(and(eq(booking.householdId, householdId), eq(booking.userId, userId), gt(booking.endsAt, now), eq(resource.enabled, true)))
    .orderBy(asc(booking.startsAt))
    .limit(20);
}

/** Everyone's bookings that start in a stretch of time, for the calendar. */
export async function listBookingsBetween(householdId: string, from: Date, to: Date) {
  return db
    .select({ id: booking.id, userId: booking.userId, kind: resource.kind, name: resource.name, startsAt: booking.startsAt, endsAt: booking.endsAt })
    .from(booking)
    .innerJoin(resource, eq(booking.resourceId, resource.id))
    .where(and(eq(booking.householdId, householdId), gte(booking.startsAt, from), lt(booking.startsAt, to), eq(resource.enabled, true)))
    .orderBy(asc(booking.startsAt))
    .limit(600);
}

export type BookResult = { ok: true } | { ok: false; reason: Refusal | "not-found" };

/**
 * Book one slot. The rules are checked inside a transaction, and the database's
 * exclusion constraint catches the case where two people press Book at once.
 */
export async function bookSlot(input: {
  userId: string;
  householdId: string;
  timeZone: string;
  /** Must have been loaded for this household, for example with findResource. */
  resource: Resource;
  startsAt: Date;
  now?: Date;
}): Promise<BookResult> {
  const { userId, householdId, timeZone, resource: found, startsAt, now = new Date() } = input;
  const resourceId = found.id;
  if (found.householdId !== householdId || !found.enabled) return { ok: false, reason: "not-found" };
  try {
    return await db.transaction(async (tx): Promise<BookResult> => {
      // One attempt at a time per person and resource, so two quick taps cannot
      // both slip under the daily limit.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`${userId}:${resourceId}`}, 0))`);

      const slot = { startsAt, endsAt: new Date(startsAt.getTime() + found.slotMinutes * 60_000) };
      const [from, to] = dayRange(dayInZone(startsAt, timeZone), timeZone);
      // One slot length either side of the day, so a slot at midnight sees its neighbour.
      const margin = found.slotMinutes * 60_000;
      const dayBookings = await tx
        .select({ userId: booking.userId, startsAt: booking.startsAt, endsAt: booking.endsAt })
        .from(booking)
        .where(
          and(
            eq(booking.resourceId, resourceId),
            gte(booking.startsAt, new Date(from.getTime() - margin)),
            lt(booking.startsAt, new Date(to.getTime() + margin)),
          ),
        );

      const refusal = refusalFor({ slot, rules: found, timeZone, now, dayBookings, userId });
      if (refusal) return { ok: false, reason: refusal };

      await tx.insert(booking).values({ resourceId, householdId, userId, ...slot });
      return { ok: true };
    });
  } catch (error) {
    if (isOverlap(error)) return { ok: false, reason: "taken" };
    throw error;
  }
}

/** Cancel your own booking, as long as it has not ended. */
export async function cancelBooking(input: {
  userId: string;
  householdId: string;
  bookingId: string;
  now?: Date;
}): Promise<{ ok: boolean }> {
  const { userId, householdId, bookingId, now = new Date() } = input;
  const [found] = await db
    .select({ userId: booking.userId, endsAt: booking.endsAt })
    .from(booking)
    .where(and(eq(booking.id, bookingId), eq(booking.householdId, householdId)))
    .limit(1);
  if (!found || !canCancel(found, userId, now)) return { ok: false };

  await db.delete(booking).where(and(eq(booking.id, bookingId), eq(booking.userId, userId)));
  return { ok: true };
}
