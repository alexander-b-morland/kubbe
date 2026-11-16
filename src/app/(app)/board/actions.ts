"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { addNote, MAX_NOTES, NOTE_LENGTH, removeNote, setNoteDone } from "@/lib/board";
import { requireExtra } from "@/lib/extras-guard";
import type { FormState } from "@/lib/form-state";

export type BoardState = (FormState & { saved?: boolean }) | undefined;

const idSchema = z.uuid();

function refresh() {
  revalidatePath("/board");
  revalidatePath("/home");
}

export async function addNoteAction(_previous: BoardState, form: FormData): Promise<BoardState> {
  const { user, household } = await requireExtra("board");
  const body = String(form.get("body") ?? "").trim();
  if (!body) return { error: "Write something first." };
  if (body.length > NOTE_LENGTH) return { error: `Keep it under ${NOTE_LENGTH} characters.`, values: { body } };

  const assignee = String(form.get("assignee") ?? "");
  const result = await addNote(household.id, user.id, {
    body,
    isTask: form.get("isTask") === "on",
    assigneeId: assignee && assignee !== "anyone" ? assignee : null,
  });
  if (result === "full") return { error: `The board holds ${MAX_NOTES} notes. Take some down first.`, values: { body } };
  if (result === "not-a-member") return { error: "That person doesn't live here any more. Pick someone else.", values: { body } };
  refresh();
  return { saved: true };
}

export async function setNoteDoneAction(noteId: string, done: boolean): Promise<BoardState> {
  const { user, household } = await requireExtra("board");
  if (idSchema.safeParse(noteId).success) await setNoteDone(household.id, user.id, noteId, done === true);
  refresh();
  return { saved: true };
}

export async function removeNoteAction(noteId: string): Promise<BoardState> {
  const { user, household, membership } = await requireExtra("board");
  if (idSchema.safeParse(noteId).success) await removeNote(household.id, user.id, noteId, membership.role === "admin");
  refresh();
  return { saved: true };
}
