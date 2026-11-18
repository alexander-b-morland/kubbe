import type { Metadata } from "next";
import Link from "next/link";
import { signOut } from "@/app/(auth)/actions";
import { ActionButton } from "@/components/ui/action-button";
import { countMembers } from "@/lib/households";
import { MEMBER_COLOUR_NAMES, MEMBER_COLOURS } from "@/lib/member-colours";
import { getHousemate, PICKS, QUESTIONS } from "@/lib/profile";
import { requireHousehold } from "@/lib/session";
import { removeMemberAction } from "../settings/actions";
import { ProfileForm } from "./profile-form";

// This screen depends on who is signed in, so it is rendered per request.
export const instant = false;

export const metadata: Metadata = { title: "You" };

const link =
  "flex min-h-11 w-fit items-center rounded font-bold underline underline-offset-4 outline-none focus-visible:ring-4 focus-visible:ring-fjord";

export default async function ProfilePage() {
  const { user, household, membership } = await requireHousehold();
  // Read from the database, not the session: the session keeps a copy of the name that
  // can be a few minutes old, which would show the old name right after saving a new one.
  const [profile, members] = await Promise.all([getHousemate(household.id, user.id), countMembers(household.id)]);
  const alone = members === 1;

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-8 p-6 pt-10 lg:max-w-3xl">
      <header className="flex flex-col gap-1">
        <p className="font-semibold text-ink-soft">How your roommates see you</p>
        <h1 className="type-display text-6xl">You</h1>
      </header>

      <ProfileForm
        name={profile!.name}
        colour={membership.colour}
        colours={MEMBER_COLOURS}
        colourNames={MEMBER_COLOUR_NAMES}
        avatar={profile!.avatar}
        bio={profile!.bio}
        avoids={profile!.avoids}
        questions={QUESTIONS}
        picks={PICKS}
        answers={profile!.answers}
      />
      <Link href={`/people/${user.id}`} className={link}>
        See your profile as others do
      </Link>

      <section aria-labelledby="account-heading" className="flex flex-col gap-3 border-t-2 border-ink/15 pt-6">
        <h2 id="account-heading" className="type-display text-3xl">
          Your account
        </h2>
        <p className="text-ink-soft break-words">Signed in as {user.email}</p>
        <form action={signOut}>
          <button type="submit" className={link}>
            Sign out
          </button>
        </form>
        <div data-testid="leave">
          <ActionButton
            look="link"
            align="start"
            confirm={alone ? `Leave and delete ${household.name} for good?` : "Leave and cancel your bookings?"}
            action={removeMemberAction.bind(null, user.id)}
          >
            Leave {household.name}
          </ActionButton>
        </div>
      </section>
    </main>
  );
}
