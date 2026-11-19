import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { findHouseholdByCode } from "@/lib/households";
import { isJoinCode, normaliseJoinCode } from "@/lib/join-code";
import { allowAttempt, clientAddress } from "@/lib/rate-limit";
import { getUser, safeNextPath } from "@/lib/session";
import { SignUpForm } from "../auth-forms";
import { getT } from "@/lib/i18n/server";

// This screen depends on who is signed in, so it is rendered per request.
export const instant = false;

export const metadata: Metadata = { title: "Create account" };

export default async function SignUpPage({ searchParams }: PageProps<"/sign-up">) {
  const t = await getT();
  const { next } = await searchParams;
  const nextPath = typeof next === "string" ? safeNextPath(next, "") : "";
  if (await getUser()) redirect(nextPath || "/home");

  // Coming from an invitation: say which household the account is for. Looking a code up
  // tells you whether it exists, so it is counted like the invitation screen's own lookups.
  const code = normaliseJoinCode(nextPath.replace(/^\/join\//, ""));
  const invitedTo =
    nextPath && isJoinCode(code) && (await allowAttempt(`join-view:${await clientAddress()}`, 30, 3600)) ? await findHouseholdByCode(code) : null;

  return (
    <>
      <h1 className="type-display text-5xl">{t("Create your account")}</h1>
      {invitedTo ? (
        <p className="text-lg break-words" data-testid="invited-to">
          {t`Then you are in ${invitedTo.name} straight away.`}
        </p>
      ) : null}
      <SignUpForm next={nextPath || undefined} />
      <p>
        {t("Already have an account?")}{" "}
        <Link href={nextPath ? `/sign-in?next=${encodeURIComponent(nextPath)}` : "/sign-in"} className="font-bold underline underline-offset-4">
          {t("Sign in")}
        </Link>
      </p>
    </>
  );
}
