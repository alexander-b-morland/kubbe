import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser, safeNextPath } from "@/lib/session";
import { SignInForm } from "../auth-forms";
import { getT } from "@/lib/i18n/server";

// This screen depends on who is signed in, so it is rendered per request.
export const instant = false;

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const t = await getT();
  const { next } = await searchParams;
  const nextPath = typeof next === "string" ? safeNextPath(next, "") : "";
  if (await getUser()) redirect(nextPath || "/home");

  return (
    <>
      <h1 className="type-display text-5xl">{t("Sign in")}</h1>
      <SignInForm next={nextPath || undefined} />
      <p className="text-ink-soft">
        {t("Forgot your password? Resetting it isn't possible yet. Press Show to check what you typed.")}
      </p>
      <p>
        {t("New here?")}{" "}
        <Link href={nextPath ? `/sign-up?next=${encodeURIComponent(nextPath)}` : "/sign-up"} className="font-bold underline underline-offset-4">
          {t("Create an account")}
        </Link>
      </p>
    </>
  );
}
