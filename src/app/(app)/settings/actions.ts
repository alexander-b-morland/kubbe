"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/lib/auth";
import type { FormState } from "@/lib/form-state";
import { requireHousehold } from "@/lib/session";
import {
  addResource,
  MAX_PER_KIND,
  removeMember,
  removeResource,
  renameHousehold,
  replaceJoinCode,
  setMemberColour,
  setMemberRole,
  setTimeZone,
  SLOT_LENGTHS,
  updateResource,
} from "@/lib/settings";

export type SettingsState = (FormState & { saved?: boolean }) | undefined;

const adminsOnly = "Only an admin can change this. Ask one of them.";
const notHere = "That person isn't in the household any more.";

// Arguments bound into an action on the server still arrive from the browser, so check them.
const memberIdSchema = z.string().min(1).max(64);
const roleSchema = z.enum(["admin", "member"]);

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

export async function addResourceAction(kind: "shower" | "washer" | "dryer"): Promise<SettingsState> {
  const { household, membership } = await requireHousehold();
  if (membership.role !== "admin") return { error: adminsOnly };
  const parsed = z.enum(["shower", "washer", "dryer"]).safeParse(kind);
  if (!parsed.success) return { error: "Pick a shower, a washing machine or a dryer." };
  if ((await addResource(household.id, parsed.data)) === "full") {
    return { error: `A household can have ${MAX_PER_KIND} of each. Remove one to add another.` };
  }
  refreshAll();
  return { saved: true };
}

export async function removeResourceAction(resourceId: string): Promise<SettingsState> {
  const { household, membership } = await requireHousehold();
  if (membership.role !== "admin") return { error: adminsOnly };
  const result = z.uuid().safeParse(resourceId).success ? await removeResource(household.id, resourceId) : "gone";
  if (result === "last") return { error: "This is the only one of its kind. Switch it off instead." };
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

export async function replaceJoinCodeAction(): Promise<SettingsState> {
  const { household, membership } = await requireHousehold();
  if (membership.role !== "admin") return { error: adminsOnly };
  await replaceJoinCode(household.id);
  refreshAll();
  return { saved: true };
}

export async function setTimeZoneAction(_previous: SettingsState, form: FormData): Promise<SettingsState> {
  const { household, membership } = await requireHousehold();
  if (membership.role !== "admin") return { error: adminsOnly };
  if (!(await setTimeZone(household.id, String(form.get("timeZone") ?? "")))) {
    return { error: "Pick a time zone from the list." };
  }
  refreshAll();
  return { saved: true };
}

export async function setRoleAction(userId: string, role: "admin" | "member"): Promise<SettingsState> {
  const { household, membership } = await requireHousehold();
  if (membership.role !== "admin") return { error: adminsOnly };
  const target = memberIdSchema.safeParse(userId);
  const wanted = roleSchema.safeParse(role);
  if (!target.success || !wanted.success) return { error: notHere };
  const result = await setMemberRole(household.id, target.data, wanted.data);
  if (!result.ok) {
    return { error: result.reason === "last-admin" ? "A household needs at least one admin. Make someone else admin first." : notHere };
  }
  refreshAll();
  return { saved: true };
}

export async function removeMemberAction(userId: string): Promise<SettingsState> {
  const { user, household, membership } = await requireHousehold();
  const target = memberIdSchema.safeParse(userId);
  if (!target.success) return { error: notHere };
  const leaving = target.data === user.id;
  if (!leaving && membership.role !== "admin") return { error: adminsOnly };
  // When an admin removes someone, the join code is replaced too: that person knows the old one.
  const result = await removeMember(household.id, target.data, { replaceCode: !leaving });
  if (!result.ok) {
    return { error: result.reason === "last-admin" ? "You're the only admin. Make someone else admin before you leave." : notHere };
  }
  refreshAll();
  if (leaving) redirect("/onboarding?left=1");
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
