import type { Metadata } from "next";
import Link from "next/link";
import { signOut } from "@/app/(auth)/actions";
import { TabHeader } from "@/components/area/area-header";
import { LanguageSwitch } from "@/components/language-switch";
import { ActionButton } from "@/components/ui/action-button";
import { listMembers } from "@/lib/households";
import { MEMBER_COLOUR_NAMES, MEMBER_COLOURS } from "@/lib/member-colours";
import { getHousemate, PICKS, QUESTIONS } from "@/lib/profile";
import { requireHousehold } from "@/lib/session";
import { removeMemberAction } from "../settings/actions";
import { ProfileForm } from "./profile-form";
import { getT } from "@/lib/i18n/server";

// This screen depends on who is signed in, so it is rendered per request.
export const instant = false;

export const metadata: Metadata = { title: "You" };

const link =
  "flex min-h-11 w-fit items-center rounded font-bold underline underline-offset-4 outline-none focus-visible:ring-4 focus-visible:ring-fjord";

export default async function ProfilePage() {
  const t = await getT();
  const { user, household, membership } = await requireHousehold();
  // Read from the database, not the session: the session keeps a copy of the name that
  // can be a few minutes old, which would show the old name right after saving a new one.
  const [profile, members] = await Promise.all([getHousemate(household.id, user.id), listMembers(household.id)]);
  const alone = members.length === 1;
  const admin = membership.role === "admin";
  // Colours the others have: shown as theirs, so nobody picks a roommate's by accident.
  const taken = members.filter((member) => member.userId !== user.id).map((member) => ({ colour: member.colour, name: member.name }));

  return (
    <main className="mx-auto flex w-full max-w-md flex-col lg:max-w-3xl lg:pt-6">
      <TabHeader art="you" name={t("You")} eyebrow={admin ? t`You, an admin of ${household.name}` : t`You, living in ${household.name}`}>
        {profile!.name}
      </TabHeader>

      <div className="flex flex-col gap-8 p-6">

      <ProfileForm
        name={profile!.name}
        colour={membership.colour}
        colours={MEMBER_COLOURS}
        colourNames={MEMBER_COLOUR_NAMES}
        taken={taken}
        avatar={profile!.avatar}
        bio={profile!.bio}
        avoids={profile!.avoids}
        questions={QUESTIONS}
        picks={PICKS}
        answers={profile!.answers}
      />
      <Link href={`/people/${user.id}`} className={link}>
        {t("See your profile as others do")}
      </Link>

      <section aria-labelledby="account-heading" className="flex flex-col gap-3 border-t-2 border-ink/15 pt-6">
        <h2 id="account-heading" className="type-display text-3xl">
          {t("Your account")}
        </h2>
        <p className="text-ink-soft break-words">
          {t`Signed in as ${user.email}`}. {admin ? t`You are an admin of ${household.name}: you can change its rules and who lives there, under Household.` : t`An admin of ${household.name} sets its rules.`}
        </p>
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Language / Språk</h3>
          <LanguageSwitch />
        </div>
        <form action={signOut}>
          <button type="submit" className={link}>
            {t("Sign out")}
          </button>
        </form>
        <div data-testid="leave">
          <ActionButton
            look="link"
            align="start"
            confirm={alone ? t`Leave and delete ${household.name} for good?` : t("Leave and cancel your bookings?")}
            action={removeMemberAction.bind(null, user.id)}
          >
            {t`Leave ${household.name}`}
          </ActionButton>
        </div>
      </section>
      </div>
    </main>
  );
}
