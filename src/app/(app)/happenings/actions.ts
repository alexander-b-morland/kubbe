"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireExtra } from "@/lib/extras-guard";
import type { FormState } from "@/lib/form-state";
import { addHappening, MAX_UPCOMING, removeHappening, setReply, updateHappening } from "@/lib/happenings";
import { instantInZone, isDay } from "@/lib/time";

export type HappeningState = (FormState & { saved?: boolean }) | undefined;

function refresh() {
  revalidatePath("/happenings");
  revalidatePath("/home");
  revalidatePath("/calendar");
}

/** Read a happening out of its form. A string is what is wrong with it. */
function readHappening(form: FormData, timeZone: string) {
  const values = {
    title: String(form.get("title") ?? "").replace(/\s+/g, " ").trim(),
    day: String(form.get("day") ?? ""),
    time: String(form.get("time") ?? ""),
    place: String(form.get("place") ?? "").replace(/\s+/g, " ").trim(),
    details: String(form.get("details") ?? "").trim(),
  };
  const problem = (error: string) => ({ error, values });
  if (!values.title) return problem("Say what the plan is.");
  if (values.title.length > 60) return problem("Keep the title under 60 characters.");
  if (!isDay(values.day)) return problem("Pick a day.");
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(values.time)) return problem("Pick a time.");
  if (values.place.length > 60) return problem("Keep the place under 60 characters.");
  if (values.details.length > 300) return problem(`That is ${values.details.length - 300} characters too long. Shorten "Anything else" to save it.`);

  const [hours, minutes] = values.time.split(":").map(Number);
  const startsAt = instantInZone(values.day, hours * 60 + minutes, timeZone);
  const now = Date.now();
  if (startsAt.getTime() < now - 3_600_000) return problem("That time has passed. Pick a later one.");
  if (startsAt.getTime() > now + 366 * 86_400_000) return problem("That is more than a year away. Pick something sooner.");
  return { input: { title: values.title, startsAt, place: values.place, details: values.details }, values };
}

export async function addHappeningAction(_previous: HappeningState, form: FormData): Promise<HappeningState> {
  const { user, household } = await requireExtra("happenings");
  const read = readHappening(form, household.timeZone);
  if ("error" in read) return read;
  const result = await addHappening(household.id, user.id, read.input);
  if (result === "full") return { error: `There are already ${MAX_UPCOMING} things planned. Call some off first.`, values: read.values };
  refresh();
  return { saved: true };
}

/** Change the time, place or wording of a happening. Everyone's answers stay as they are. */
export async function updateHappeningAction(happeningId: string, _previous: HappeningState, form: FormData): Promise<HappeningState> {
  const { user, household, membership } = await requireExtra("happenings");
  if (!z.uuid().safeParse(happeningId).success) return { error: "That has been called off." };
  const read = readHappening(form, household.timeZone);
  if ("error" in read) return read;
  if (!(await updateHappening(household.id, user.id, happeningId, membership.role === "admin", read.input))) {
    return { error: "That has been called off, or it is not yours to change." };
  }
  refresh();
  return { saved: true };
}

export async function replyAction(happeningId: string, going: boolean): Promise<HappeningState> {
  const { user, household } = await requireExtra("happenings");
  const ok = z.uuid().safeParse(happeningId).success && (await setReply(household.id, user.id, happeningId, going === true));
  refresh();
  return ok ? { saved: true } : { error: "That has been called off." };
}

export async function removeHappeningAction(happeningId: string): Promise<HappeningState> {
  const { user, household, membership } = await requireExtra("happenings");
  if (z.uuid().safeParse(happeningId).success) {
    await removeHappening(household.id, user.id, happeningId, membership.role === "admin");
  }
  refresh();
  return { saved: true };
}
