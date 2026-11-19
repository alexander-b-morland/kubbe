"use server";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/lib/auth";
import type { FormState } from "@/lib/form-state";
import { joinHousehold } from "@/lib/households";
import { isJoinCode, normaliseJoinCode } from "@/lib/join-code";
import { allowAttempt, clientAddress, tooManyAttempts } from "@/lib/rate-limit";
import { safeNextPath } from "@/lib/session";

const signUpSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(60, "Keep your name under 60 characters."),
  email: z.email("Enter a valid email address.").trim().toLowerCase(),
  password: z.string().min(8, "Use at least 8 characters for your password.").max(128, "Use at most 128 characters for your password."),
});

const signInSchema = z.object({
  email: z.email("Enter a valid email address.").trim().toLowerCase(),
  password: z.string().min(1, "Enter your password."),
});

const text = (form: FormData, key: string) => String(form.get(key) ?? "");

export async function signUp(_previous: FormState, form: FormData): Promise<FormState> {
  const values = { name: text(form, "name"), email: text(form, "email") };
  const parsed = signUpSchema.safeParse({ ...values, password: text(form, "password") });
  // Everything that is wrong at once, one line per field, so it takes one try to fix.
  if (!parsed.success) {
    const seen = new Set<PropertyKey>();
    const first = parsed.error.issues.filter((issue) => !seen.has(issue.path[0]) && seen.add(issue.path[0]));
    return { error: first.map((issue) => issue.message).join(" "), values };
  }
  // Creating accounts is open to anyone, so one address can only make so many an hour.
  if (!(await allowAttempt(`sign-up:${await clientAddress()}`, 20, 3600))) return { error: tooManyAttempts, values };

  let userId: string | undefined;
  try {
    const created = await auth.api.signUpEmail({ body: parsed.data, headers: await headers() });
    userId = created.user.id;
  } catch (error) {
    if (error instanceof APIError) {
      const taken = error.body?.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" || error.body?.code === "USER_ALREADY_EXISTS";
      return {
        error: taken
          ? "That email already has an account. Sign in instead."
          : "Couldn't create your account. Check your details and try again.",
        values,
      };
    }
    throw error;
  }
  const next = safeNextPath(form.get("next"), "/onboarding");
  // An account made from an invitation is for that household: join it now, with no second screen
  // asking the same thing. If the code no longer works, the invitation screen says so.
  const code = normaliseJoinCode(next.replace(/^\/join\//, ""));
  if (next.startsWith("/join/") && isJoinCode(code)) {
    if (userId && (await allowAttempt(`join:user:${userId}`, 10, 3600)) && (await allowAttempt(`join:address:${await clientAddress()}`, 30, 3600))) {
      const joined = await joinHousehold(userId, code);
      if (joined.ok) redirect("/home");
    }
  }
  redirect(next);
}

export async function signIn(_previous: FormState, form: FormData): Promise<FormState> {
  const values = { email: text(form, "email") };
  const parsed = signInSchema.safeParse({ ...values, password: text(form, "password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };
  // Guessing passwords is slowed down per account and per address.
  const [byEmail, byAddress] = await Promise.all([
    allowAttempt(`sign-in:email:${parsed.data.email}`, 8, 900),
    allowAttempt(`sign-in:address:${await clientAddress()}`, 40, 900),
  ]);
  if (!byEmail || !byAddress) return { error: tooManyAttempts, values };

  try {
    await auth.api.signInEmail({ body: parsed.data, headers: await headers() });
  } catch (error) {
    // Only a refusal from the auth library means the details were wrong.
    // Anything else is our fault, and goes to the error screen.
    if (error instanceof APIError && (error.status === "UNAUTHORIZED" || error.statusCode === 401)) {
      return { error: "Wrong email or password. Check both and try again.", values };
    }
    throw error;
  }
  redirect(safeNextPath(form.get("next"), "/home"));
}

export async function signOut() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/");
}
