import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser, safeNextPath } from "@/lib/session";
import { SignUpForm } from "../auth-forms";

// This screen depends on who is signed in, so it is rendered per request.
export const instant = false;

export const metadata: Metadata = { title: "Create account" };

export default async function SignUpPage({ searchParams }: PageProps<"/sign-up">) {
  const { next } = await searchParams;
  const nextPath = typeof next === "string" ? safeNextPath(next, "") : "";
  if (await getUser()) redirect(nextPath || "/home");

  return (
    <>
      <h1 className="type-display text-5xl">Create your account</h1>
      <SignUpForm next={nextPath || undefined} />
      <p>
        Already have an account?{" "}
        <Link href={nextPath ? `/sign-in?next=${encodeURIComponent(nextPath)}` : "/sign-in"} className="font-bold underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </>
  );
}
