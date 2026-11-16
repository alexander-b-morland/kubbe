import { and, count, desc, eq, gte, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { membership, note } from "@/db/schema";

// The noticeboard. Callers have already established who is asking and which household
// they are in (see requireExtra).

export const MAX_NOTES = 200;
export const NOTE_LENGTH = 300;

/** Notes to show: everything open, plus what was ticked off in the last week. */
export async function listNotes(householdId: string, now: Date) {
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  const rows = await db
    .select()
    .from(note)
    .where(and(eq(note.householdId, householdId), or(isNull(note.doneAt), gte(note.doneAt, weekAgo))))
    .orderBy(desc(note.createdAt));
  // Open things first, newest first; what is done sinks to the bottom.
  return rows.sort((a, b) => Number(Boolean(a.doneAt)) - Number(Boolean(b.doneAt)));
}

async function isMember(householdId: string, userId: string) {
  const [found] = await db
    .select({ userId: membership.userId })
    .from(membership)
    .where(and(eq(membership.householdId, householdId), eq(membership.userId, userId)));
  return Boolean(found);
}

export async function addNote(
  householdId: string,
  authorId: string,
  input: { body: string; isTask: boolean; assigneeId: string | null },
): Promise<"ok" | "full" | "not-a-member"> {
  const [existing] = await db.select({ notes: count() }).from(note).where(eq(note.householdId, householdId));
  if (existing.notes >= MAX_NOTES) return "full";
  // A to-do can only be given to someone who lives here.
  const assigneeId = input.isTask ? input.assigneeId : null;
  if (assigneeId && !(await isMember(householdId, assigneeId))) return "not-a-member";
  await db.insert(note).values({ householdId, authorId, body: input.body, isTask: input.isTask, assigneeId });
  return "ok";
}

/** Tick a to-do off, or untick it. Anyone in the household can. */
export async function setNoteDone(householdId: string, userId: string, noteId: string, done: boolean) {
  await db
    .update(note)
    .set(done ? { doneAt: new Date(), doneBy: userId } : { doneAt: null, doneBy: null })
    .where(and(eq(note.id, noteId), eq(note.householdId, householdId), eq(note.isTask, true)));
}

/** Take a note down. Its author can, and so can an admin. */
export async function removeNote(householdId: string, userId: string, noteId: string, isAdmin: boolean) {
  const mine = and(eq(note.id, noteId), eq(note.householdId, householdId));
  await db.delete(note).where(isAdmin ? mine : and(mine, eq(note.authorId, userId)));
}

/** To-dos on the board that are this person's to do: theirs by name, still open. */
export async function listMyTasks(householdId: string, userId: string) {
  return db
    .select({ id: note.id, body: note.body })
    .from(note)
    .where(and(eq(note.householdId, householdId), eq(note.isTask, true), eq(note.assigneeId, userId), isNull(note.doneAt)))
    .orderBy(desc(note.createdAt));
}
