import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { membership, profile, user } from "@/db/schema";
import { DEFAULT_AVATAR, isAvatar, type AvatarName } from "@/components/avatar/avatars";

/** The fun questions on a profile. Keys are stored; the wording can change freely. */
export const QUESTIONS = [
  { key: "dish", ask: "My signature dish" },
  { key: "habit", ask: "My worst habit as a roommate" },
  { key: "song", ask: "The song I play too loud" },
  { key: "gift", ask: "What I bring to the flat" },
  { key: "show", ask: "The show I won't shut up about" },
  { key: "fridge", ask: "Always on my shelf in the fridge" },
] as const;

/** "This or that": one tap each, and it says a lot about living with someone. Stored as "a" or "b". */
export const PICKS = [
  { key: "shower", a: "Morning shower", b: "Evening shower" },
  { key: "bird", a: "Early bird", b: "Night owl" },
  { key: "chore", a: "Does the dishes", b: "Takes out the trash" },
  { key: "sound", a: "Music on", b: "Quiet, please" },
  { key: "taste", a: "Sweet", b: "Salty" },
  { key: "plans", a: "Plans ahead", b: "Wings it" },
] as const;

export const pickKey = (key: string) => `pick-${key}`;

export type ProfileInput = { avatar: AvatarName; bio: string; avoids: string; answers: Record<string, string> };

export async function getProfile(userId: string) {
  const [found] = await db.select().from(profile).where(eq(profile.userId, userId));
  return {
    avatar: isAvatar(found?.avatar) ? found.avatar : DEFAULT_AVATAR,
    bio: found?.bio ?? "",
    avoids: found?.avoids ?? "",
    answers: found?.answers ?? {},
  };
}

export async function saveProfile(userId: string, input: ProfileInput) {
  // Only keep answers to questions that exist, and picks that are one of the two sides.
  const answers = Object.fromEntries([
    ...QUESTIONS.map((question) => [question.key, (input.answers[question.key] ?? "").trim()]).filter(([, answer]) => answer),
    ...PICKS.map((pick) => [pickKey(pick.key), input.answers[pickKey(pick.key)]]).filter(([, side]) => side === "a" || side === "b"),
  ]);
  const values = { avatar: input.avatar, bio: input.bio, avoids: input.avoids, answers };
  await db.insert(profile).values({ userId, ...values }).onConflictDoUpdate({ target: profile.userId, set: values });
}

/** Someone's profile, but only if they live in this household. */
export async function getHousemate(householdId: string, userId: string) {
  const [found] = await db
    .select({ userId: user.id, name: user.name, role: membership.role, colour: membership.colour, joinedAt: membership.joinedAt })
    .from(membership)
    .innerJoin(user, eq(membership.userId, user.id))
    .where(and(eq(membership.householdId, householdId), eq(membership.userId, userId)));
  return found ? { ...found, ...(await getProfile(userId)) } : null;
}
