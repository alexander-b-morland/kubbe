"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createArea,
  deleteArea,
  ESTIMATES,
  giveBack,
  INTERVALS,
  markDone,
  MAX_AREAS,
  takeOver,
  undoDone,
  updateArea,
} from "@/lib/cleaning/service";
import type { FormState } from "@/lib/form-state";
import { requireHousehold } from "@/lib/session";
import { dayInZone } from "@/lib/time";

export type CleaningState = (FormState & { saved?: boolean }) | undefined;

const adminsOnly = "Only an admin can change the rooms. Ask one of them.";
const gone = "That room has been removed.";
const stale = "That turn has ended. The list now shows the current one.";

const areaSchema = z.object({
  name: z.string().trim().min(1, "Give the room a name.").max(30, "Keep the name under 30 characters."),
  intervalDays: z.coerce.number().refine((value) => (INTERVALS as readonly number[]).includes(value), "Pick how often from the list."),
  estimateMinutes: z.coerce.number().refine((value) => (ESTIMATES as readonly number[]).includes(value), "Pick a time from the list."),
});

const idSchema = z.uuid();
const periodSchema = z.number().int().min(0);

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
  if (!(await createArea(household.id, parsed.data, today))) {
    return { error: `A household can have ${MAX_AREAS} rooms. Remove one to add another.` };
  }
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
  const { household, membership, today } = await context();
  if (membership.role !== "admin") return { error: adminsOnly };
  if (idSchema.safeParse(areaId).success) await deleteArea(household.id, areaId, today);
  refresh();
  return { saved: true };
}

type TurnChange = typeof markDone;

/**
 * The four things a person can do to a turn all look the same from here. The period
 * comes from the screen the person pressed on: if a new period has started since that
 * screen was drawn, nothing is changed and they are told.
 */
async function changeTurn(change: TurnChange, areaId: string, period: number): Promise<CleaningState> {
  const { user, household, today } = await context();
  const valid = idSchema.safeParse(areaId).success && periodSchema.safeParse(period).success;
  const result = valid ? await change(household.id, user.id, areaId, today, period) : "gone";
  refresh();
  if (result === "ok") return { saved: true };
  return { error: result === "stale" ? stale : gone };
}

export const markDoneAction = async (areaId: string, period: number) => changeTurn(markDone, areaId, period);
export const undoDoneAction = async (areaId: string, period: number) => changeTurn(undoDone, areaId, period);
export const takeOverAction = async (areaId: string, period: number) => changeTurn(takeOver, areaId, period);
export const giveBackAction = async (areaId: string, period: number) => changeTurn(giveBack, areaId, period);
