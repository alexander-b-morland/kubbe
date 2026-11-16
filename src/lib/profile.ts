import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { membership, profile, user } from "@/db/schema";
import { DEFAULT_AVATAR, isAvatar, type AvatarName } from "@/components/avatar/avatars";

/** The fun questions on a profile. Keys are stored; the wording can change freely. */
export const QUESTIONS = [
  { key: "shower", ask: "Morning or evening shower?" },
  { key: "dish", ask: "My signature dish" },
  { key: "habit", ask: "My worst habit as a roommate" },
  { key: "song", ask: "The song I play too loud" },
  { key: "gift", ask: "What I bring to the flat" },
] as const;

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
  // Only keep answers to questions that exist.
  const answers = Object.fromEntries(
    QUESTIONS.map((question) => [question.key, (input.answers[question.key] ?? "").trim()]).filter(([, answer]) => answer),
  );
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
