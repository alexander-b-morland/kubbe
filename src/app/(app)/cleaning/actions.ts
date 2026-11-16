"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createArea, deleteArea, ESTIMATES, giveBack, INTERVALS, markDone, takeOver, undoDone, updateArea } from "@/lib/cleaning/service";
import type { FormState } from "@/lib/form-state";
import { requireHousehold } from "@/lib/session";
import { dayInZone } from "@/lib/time";

export type CleaningState = (FormState & { saved?: boolean }) | undefined;

const adminsOnly = "Only an admin can change the rooms.";
const gone = "That room no longer exists. Reload and try again.";

const areaSchema = z.object({
  name: z.string().trim().min(1, "Give the room a name.").max(30, "Keep the name under 30 characters."),
  intervalDays: z.coerce.number().refine((value) => (INTERVALS as readonly number[]).includes(value), "Pick how often from the list."),
  estimateMinutes: z.coerce.number().refine((value) => (ESTIMATES as readonly number[]).includes(value), "Pick a time from the list."),
});

const idSchema = z.uuid();

function refresh() {
  revalidatePath("/cleaning");
  revalidatePath("/home");
}

async function context() {
  const found = await requireHousehold();
  return { ...found, today: dayInZone(new Date(), found.household.timeZone) };
}

export async function addAreaAction(_previous: CleaningState, form: FormData): Promise<CleaningState> {
  const { household, membership, today } = await context();
  if (membership.role !== "admin") return { error: adminsOnly };
  const parsed = areaSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message, values: { name: String(form.get("name") ?? "") } };
  if (!(await createArea(household.id, parsed.data, today))) return { error: "That's the most rooms a household can have." };
  refresh();
  return { saved: true };
}

export async function updateAreaAction(areaId: string, _previous: CleaningState, form: FormData): Promise<CleaningState> {
  const { household, membership, today } = await context();
  if (membership.role !== "admin") return { error: adminsOnly };
  const parsed = areaSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!idSchema.safeParse(areaId).success || !(await updateArea(household.id, areaId, parsed.data, today))) return { error: gone };
  refresh();
  return { saved: true };
}

export async function deleteAreaAction(areaId: string): Promise<CleaningState> {
  const { household, membership } = await context();
  if (membership.role !== "admin") return { error: adminsOnly };
  if (idSchema.safeParse(areaId).success) await deleteArea(household.id, areaId);
  refresh();
  return { saved: true };
}

type TurnChange = typeof markDone;

/** The four things a person can do to the current turn of a room all look the same from here. */
async function changeTurn(change: TurnChange, areaId: string): Promise<CleaningState> {
  const { user, household, today } = await context();
  const ok = idSchema.safeParse(areaId).success && (await change(household.id, user.id, areaId, today));
  refresh();
  return ok ? { saved: true } : { error: gone };
}

export const markDoneAction = async (areaId: string) => changeTurn(markDone, areaId);
export const undoDoneAction = async (areaId: string) => changeTurn(undoDone, areaId);
export const takeOverAction = async (areaId: string) => changeTurn(takeOver, areaId);
export const giveBackAction = async (areaId: string) => changeTurn(giveBack, areaId);
