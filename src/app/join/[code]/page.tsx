import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { KubbeLogo } from "@/components/logo/kubbe-logo";
import { countMembers, findHouseholdByCode } from "@/lib/households";
import { isJoinCode, normaliseJoinCode } from "@/lib/join-code";
import { allowAttempt, clientAddress } from "@/lib/rate-limit";
import { getHouseholdFor, getUser } from "@/lib/session";
import { JoinByLinkForm } from "../../onboarding/onboarding-forms";
import type { Translate } from "@/lib/i18n";
import { getT } from "@/lib/i18n/server";

// This screen depends on who is signed in, so it is rendered per request.
export const instant = false;

export const metadata: Metadata = {
  title: "You're invited",
  description: "Someone you live with has invited you to their household on Kubbe.",
};

const primary =
  "flex h-14 items-center justify-center rounded-full bg-ink px-6 text-lg font-bold text-paper outline-none focus-visible:ring-4 focus-visible:ring-fjord";
const secondary =
  "flex h-14 items-center justify-center rounded-full border-2 border-ink px-6 text-lg font-bold outline-none focus-visible:ring-4 focus-visible:ring-fjord";

/**
 * A shared link: /join/ABCD2F. This is the first thing a new roommate sees, so it says
 * what they are invited to before asking for anything, and says at once if the link is dead.
 */
export default async function JoinPage({ params }: PageProps<"/join/[code]">) {
  const t = await getT();
  const code = normaliseJoinCode((await params).code);
  const user = await getUser();

  // Looking a code up tells you whether it exists, so lookups are counted like guesses.
  const allowed = await allowAttempt(`join-view:${user?.id ?? (await clientAddress())}`, 30, 3600);
  const found = allowed && isJoinCode(code) ? await findHouseholdByCode(code) : null;
  const current = user ? await getHouseholdFor(user.id) : null;
  if (found && current?.household.id === found.id) redirect("/home");

  const next = encodeURIComponent(`/join/${code}`);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-6 pt-10">
      <KubbeLogo label="" className="w-40" />

      {!found ? (
        <>
          <h1 className="type-display text-5xl">{t("That link doesn't work")}</h1>
          <p className="text-lg">
            {allowed
              ? t("The code may have been replaced. Ask your roommate for a new link.")
              : t("Too many tries. Wait a while, then open the link again.")}
          </p>
          {user ? (
            <Link href="/onboarding" className={secondary}>
              {t("Enter a code yourself")}
            </Link>
          ) : (
            // Someone new can still get started, and type a fresh code once they have one.
            <div className="flex flex-col gap-3">
              <Link href="/sign-up" className={primary}>
                {t("Create account")}
              </Link>
              <Link href="/sign-in" className={secondary}>
                {t("I already have an account")}
              </Link>
            </div>
          )}
        </>
      ) : current ? (
        <>
          <h1 className="type-display text-5xl break-words">{t`You're already in ${current.household.name}`}</h1>
          <p className="text-lg">
            {t`You can live in one household at a time. To join ${found.name}, first leave ${current.household.name} `}
            {t("under Household.")}
          </p>
          <Link href="/settings" className={secondary}>
            {t("Open Household")}
          </Link>
        </>
      ) : (
        <>
          <h1 className="type-display text-5xl break-words">
            {user ? t`Join ${found.name}?` : t`You're invited to ${found.name}`}
          </h1>
          <p className="text-lg">
            {t`${await describeSize(found.id, t)} You'll share the shower and laundry bookings and the cleaning turns.`}
          </p>
          {user ? (
            <JoinByLinkForm code={code} name={found.name} />
          ) : (
            <div className="flex flex-col gap-3">
              <Link href={`/sign-up?next=${next}`} className={primary}>
                {t("Create account")}
              </Link>
              <Link href={`/sign-in?next=${next}`} className={secondary}>
                {t("I already have an account")}
              </Link>
            </div>
          )}
        </>
      )}
    </main>
  );
}

async function describeSize(householdId: string, t: Translate) {
  const members = await countMembers(householdId);
  return members === 1 ? t("One person lives there so far.") : t`${members} people live there.`;
}
