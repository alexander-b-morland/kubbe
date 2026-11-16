"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireExtra } from "@/lib/extras-guard";
import type { FormState } from "@/lib/form-state";
import { addHappening, removeHappening, setReply } from "@/lib/happenings";
import { instantInZone, isDay } from "@/lib/time";

export type HappeningState = (FormState & { saved?: boolean }) | undefined;

function refresh() {
  revalidatePath("/happenings");
  revalidatePath("/home");
}

export async function addHappeningAction(_previous: HappeningState, form: FormData): Promise<HappeningState> {
  const { user, household } = await requireExtra("happenings");
  const values = {
    title: String(form.get("title") ?? "").trim(),
    day: String(form.get("day") ?? ""),
    time: String(form.get("time") ?? ""),
    place: String(form.get("place") ?? "").trim(),
    details: String(form.get("details") ?? "").trim(),
  };
  if (!values.title) return { error: "Say what the plan is.", values };
  if (values.title.length > 60) return { error: "Keep the title under 60 characters.", values };
  if (!isDay(values.day)) return { error: "Pick a day.", values };
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(values.time)) return { error: "Pick a time.", values };
  if (values.place.length > 60) return { error: "Keep the place under 60 characters.", values };
  if (values.details.length > 300) return { error: "Keep the details under 300 characters.", values };

  const [hours, minutes] = values.time.split(":").map(Number);
  const startsAt = instantInZone(values.day, hours * 60 + minutes, household.timeZone);
  const now = Date.now();
  if (startsAt.getTime() < now - 3_600_000) return { error: "That time has passed. Pick a later one.", values };
  if (startsAt.getTime() > now + 366 * 86_400_000) return { error: "That is more than a year away. Pick something sooner.", values };

  await addHappening(household.id, user.id, { title: values.title, startsAt, place: values.place, details: values.details });
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
