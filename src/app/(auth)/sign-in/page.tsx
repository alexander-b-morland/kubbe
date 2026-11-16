import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser, safeNextPath } from "@/lib/session";
import { SignInForm } from "../auth-forms";

// This screen depends on who is signed in, so it is rendered per request.
export const instant = false;

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const { next } = await searchParams;
  const nextPath = typeof next === "string" ? safeNextPath(next, "") : "";
  if (await getUser()) redirect(nextPath || "/home");

  return (
    <>
      <h1 className="type-display text-5xl">Sign in</h1>
      <SignInForm next={nextPath || undefined} />
      <p>
        New here?{" "}
        <Link href={nextPath ? `/sign-up?next=${encodeURIComponent(nextPath)}` : "/sign-up"} className="font-bold underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </>
  );
}
