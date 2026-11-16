import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { findHouseholdByCode } from "@/lib/households";
import { isJoinCode, normaliseJoinCode } from "@/lib/join-code";
import { getHouseholdFor, getUser } from "@/lib/session";
import { JoinHouseholdForm } from "../../onboarding/onboarding-forms";

// This screen depends on who is signed in, so it is rendered per request.
export const instant = false;

export const metadata: Metadata = { title: "Join a household" };

// A shared link: /join/ABCD2F. Works whether or not the visitor has an account yet.
export default async function JoinPage({ params }: PageProps<"/join/[code]">) {
  const code = normaliseJoinCode((await params).code);
  const user = await getUser();
  if (!user) redirect(`/sign-up?next=${encodeURIComponent(`/join/${code}`)}`);
  if (await getHouseholdFor(user.id)) redirect("/home");

  const found = isJoinCode(code) ? await findHouseholdByCode(code) : null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-6 pt-10">
      {found ? (
        <>
          <h1 className="type-display text-5xl">Join {found.name}?</h1>
          <p>You&apos;ll share its shower, laundry and cleaning schedule.</p>
          <JoinHouseholdForm code={code} />
        </>
      ) : (
        <>
          <h1 className="type-display text-5xl">That link doesn&apos;t work</h1>
          <p>
            The code may have been replaced. Ask your roommate for a new one, or enter a code
            yourself.
          </p>
          <Link href="/onboarding" className="font-bold underline underline-offset-4">
            Enter a code
          </Link>
        </>
      )}
    </main>
  );
}
