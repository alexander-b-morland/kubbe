"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/lib/auth";
import type { FormState } from "@/lib/form-state";
import { requireHousehold } from "@/lib/session";
import {
  removeMember,
  renameHousehold,
  replaceJoinCode,
  setMemberColour,
  setMemberRole,
  SLOT_LENGTHS,
  updateResource,
} from "@/lib/settings";

export type SettingsState = (FormState & { saved?: boolean }) | undefined;

const adminsOnly = "Only an admin can change this.";

function refreshAll() {
  revalidatePath("/", "layout");
}

const clock = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$|^24:00$/, "Enter times as hours and minutes, like 06:00.")
  .transform((value) => {
    const [hours, minutes] = value.split(":").map(Number);
    return hours * 60 + minutes;
  });

const resourceSchema = z
  .object({
    name: z.string().trim().min(1, "Give it a name.").max(30, "Keep the name under 30 characters."),
    enabled: z.boolean(),
    slotMinutes: z.coerce.number().refine((value) => (SLOT_LENGTHS as readonly number[]).includes(value), "Pick a slot length from the list."),
    opensAt: clock,
    closesAt: clock,
    maxPerDay: z.coerce.number().int().min(1, "Allow at least 1 slot a day.").max(12, "Allow at most 12 slots a day."),
    allowBackToBack: z.boolean(),
    bookAheadDays: z.coerce.number().int().min(0, "Days ahead can't be negative.").max(30, "Allow booking at most 30 days ahead."),
  })
  .refine((value) => value.closesAt > value.opensAt, "Closing time must be after opening time.")
  .refine((value) => value.closesAt - value.opensAt >= value.slotMinutes, "The opening hours are shorter than one slot.");

export async function updateResourceAction(resourceId: string, _previous: SettingsState, form: FormData): Promise<SettingsState> {
  const { household, membership } = await requireHousehold();
  if (membership.role !== "admin") return { error: adminsOnly };

  const parsed = resourceSchema.safeParse({
    name: form.get("name"),
    enabled: form.get("enabled") === "on",
    slotMinutes: form.get("slotMinutes"),
    opensAt: form.get("opensAt"),
    closesAt: form.get("closesAt"),
    maxPerDay: form.get("maxPerDay"),
    allowBackToBack: form.get("allowBackToBack") === "on",
    bookAheadDays: form.get("bookAheadDays"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!z.uuid().safeParse(resourceId).success || !(await updateResource(household.id, resourceId, parsed.data))) {
    return { error: "That no longer exists. Reload and try again." };
  }
  refreshAll();
  return { saved: true };
}

export async function renameHouseholdAction(_previous: SettingsState, form: FormData): Promise<SettingsState> {
  const { household, membership } = await requireHousehold();
  if (membership.role !== "admin") return { error: adminsOnly };
  const parsed = z.string().trim().min(1, "Give your household a name.").max(40, "Keep the name under 40 characters.").safeParse(form.get("name"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await renameHousehold(household.id, parsed.data);
  refreshAll();
  return { saved: true };
}

export async function replaceJoinCodeAction(): Promise<void> {
  const { household, membership } = await requireHousehold();
  if (membership.role !== "admin") return;
  await replaceJoinCode(household.id);
  refreshAll();
}

export async function setRoleAction(userId: string, role: "admin" | "member"): Promise<SettingsState> {
  const { household, membership } = await requireHousehold();
  if (membership.role !== "admin") return { error: adminsOnly };
  const result = await setMemberRole(household.id, userId, role);
  if (!result.ok) {
    return { error: result.reason === "last-admin" ? "A household needs at least one admin. Make someone else admin first." : "That person isn't in the household any more." };
  }
  refreshAll();
  return { saved: true };
}

export async function removeMemberAction(userId: string): Promise<SettingsState> {
  const { user, household, membership } = await requireHousehold();
  const leaving = userId === user.id;
  if (!leaving && membership.role !== "admin") return { error: adminsOnly };
  const result = await removeMember(household.id, userId);
  if (!result.ok) {
    return { error: result.reason === "last-admin" ? "You're the only admin. Make someone else admin before you leave." : "That person isn't in the household any more." };
  }
  refreshAll();
  if (leaving) redirect("/onboarding");
  return { saved: true };
}

export async function updateProfileAction(_previous: SettingsState, form: FormData): Promise<SettingsState> {
  const { user, household } = await requireHousehold();
  const name = z.string().trim().min(1, "Enter your name.").max(60, "Keep your name under 60 characters.").safeParse(form.get("name"));
  if (!name.success) return { error: name.error.issues[0].message };

  // Through the auth library, so the copy of the session kept in the cookie is refreshed too.
  if (name.data !== user.name) await auth.api.updateUser({ body: { name: name.data }, headers: await headers() });
  const colour = String(form.get("colour") ?? "");
  if (colour && !(await setMemberColour(household.id, user.id, colour))) return { error: "Pick one of the colours shown." };
  refreshAll();
  return { saved: true };
}
