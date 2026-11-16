import type { Metadata } from "next";
import Link from "next/link";
import { MEMBER_COLOUR_NAMES, MEMBER_COLOURS } from "@/lib/member-colours";
import { getHousemate, QUESTIONS } from "@/lib/profile";
import { requireHousehold } from "@/lib/session";
import { ProfileForm } from "./profile-form";

// This screen depends on who is signed in, so it is rendered per request.
export const instant = false;

export const metadata: Metadata = { title: "Your profile" };

export default async function ProfilePage() {
  const { user, household, membership } = await requireHousehold();
  // Read from the database, not the session: the session keeps a copy of the name that
  // can be a few minutes old, which would show the old name right after saving a new one.
  const profile = (await getHousemate(household.id, user.id))!;

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-6 pt-10">
      <header className="flex flex-col gap-1">
        <p className="font-semibold text-ink-soft">This is how your roommates see you</p>
        <h1 className="type-display text-6xl">Your profile</h1>
      </header>
      <ProfileForm
        name={profile.name}
        colour={membership.colour}
        colours={MEMBER_COLOURS}
        colourNames={MEMBER_COLOUR_NAMES}
        avatar={profile.avatar}
        bio={profile.bio}
        avoids={profile.avoids}
        questions={QUESTIONS}
        answers={profile.answers}
      />
      <Link
        href={`/people/${user.id}`}
        className="flex min-h-11 w-fit items-center rounded font-bold underline underline-offset-4 outline-none focus-visible:ring-4 focus-visible:ring-fjord"
      >
        See your profile as others do
      </Link>
    </main>
  );
}
