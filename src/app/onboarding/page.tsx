import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getHouseholdFor, requireUser } from "@/lib/session";
import { CreateHouseholdForm, JoinHouseholdForm } from "./onboarding-forms";

// This screen depends on who is signed in, so it is rendered per request.
export const instant = false;

export const metadata: Metadata = { title: "Set up your household" };

export default async function OnboardingPage() {
  const user = await requireUser();
  if (await getHouseholdFor(user.id)) redirect("/home");

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-10 p-6 pt-10">
      <h1 className="type-display text-5xl">Hi {user.name}. Where do you live?</h1>

      <section className="flex flex-col gap-4">
        <h2 className="type-display text-3xl">Start a household</h2>
        <p>You become its admin and get a code to share with your roommates.</p>
        <CreateHouseholdForm />
      </section>

      <section className="flex flex-col gap-4 border-t-2 border-ink/15 pt-8">
        <h2 className="type-display text-3xl">Join one</h2>
        <p>Got a code from a roommate? Enter it here.</p>
        <JoinHouseholdForm />
      </section>
    </main>
  );
}
