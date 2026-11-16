"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AVATAR_NAMES } from "@/components/avatar/avatars";
import { auth } from "@/lib/auth";
import type { FormState } from "@/lib/form-state";
import { QUESTIONS, saveProfile } from "@/lib/profile";
import { requireHousehold } from "@/lib/session";
import { setMemberColour } from "@/lib/settings";

export type ProfileState = (FormState & { saved?: boolean }) | undefined;

const schema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(60, "Keep your name under 60 characters."),
  avatar: z.enum(AVATAR_NAMES as [string, ...string[]], "Pick one of the avatars shown."),
  colour: z.string(),
  bio: z.string().trim().max(160, "Keep your bio under 160 characters."),
  avoids: z.string().trim().max(120, "Keep what you don't eat under 120 characters."),
});

export async function saveProfileAction(_previous: ProfileState, form: FormData): Promise<ProfileState> {
  const { user, household } = await requireHousehold();
  const parsed = schema.safeParse({
    name: form.get("name"),
    avatar: form.get("avatar"),
    colour: form.get("colour") ?? "",
    bio: form.get("bio") ?? "",
    avoids: form.get("avoids") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const answers: Record<string, string> = {};
  for (const question of QUESTIONS) {
    const answer = String(form.get(`answer-${question.key}`) ?? "").trim();
    if (answer.length > 80) return { error: "Keep each answer under 80 characters." };
    answers[question.key] = answer;
  }

  // The name goes through the auth library, so the copy of the session kept in the cookie is refreshed too.
  if (parsed.data.name !== user.name) {
    await auth.api.updateUser({ body: { name: parsed.data.name }, headers: await headers() });
  }
  if (parsed.data.colour && !(await setMemberColour(household.id, user.id, parsed.data.colour))) {
    return { error: "Pick one of the colours shown." };
  }
  await saveProfile(user.id, {
    avatar: parsed.data.avatar as (typeof AVATAR_NAMES)[number],
    bio: parsed.data.bio,
    avoids: parsed.data.avoids,
    answers,
  });
  revalidatePath("/", "layout");
  return { saved: true };
}
