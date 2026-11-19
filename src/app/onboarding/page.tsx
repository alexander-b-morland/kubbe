import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { signOut } from "@/app/(auth)/actions";
import { getHouseholdFor, requireUser } from "@/lib/session";
import { CreateHouseholdForm, JoinHouseholdForm } from "./onboarding-forms";
import { getT } from "@/lib/i18n/server";

// This screen depends on who is signed in, so it is rendered per request.
export const instant = false;

export const metadata: Metadata = { title: "Set up your household" };

export default async function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  const t = await getT();
  const user = await requireUser();
  const left = (await searchParams).left === "1";
  if (await getHouseholdFor(user.id)) redirect("/home");

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-10 p-6 pt-10">
      {left ? (
        <p role="status" className="rounded-xl border-2 border-ink px-4 py-3 font-semibold">
          {t("You've left your household. Start a new one or join another below.")}
        </p>
      ) : null}
      <h1 className="type-display text-5xl break-words">{t`Hi ${user.name}. Where do you live?`}</h1>

      <section className="flex flex-col gap-4">
        <h2 className="type-display text-3xl">{t("Start a household")}</h2>
        <p>{t("You become its admin and get a code to share with your roommates.")}</p>
        <CreateHouseholdForm />
      </section>

      <section className="flex flex-col gap-4 border-t-2 border-ink/15 pt-8">
        <h2 className="type-display text-3xl">{t("Join one")}</h2>
        <p>{t("Got a code from a roommate? Enter it here.")}</p>
        <JoinHouseholdForm />
      </section>

      <footer className="flex flex-col gap-1 border-t-2 border-ink/15 pt-6">
        <p className="text-ink-soft break-words">{t`Signed in as ${user.email}`}</p>
        <form action={signOut}>
          <button
            type="submit"
            className="flex min-h-11 items-center rounded font-bold underline underline-offset-4 outline-none focus-visible:ring-4 focus-visible:ring-fjord"
          >
            {t("Sign out")}
          </button>
        </form>
      </footer>
    </main>
  );
}
