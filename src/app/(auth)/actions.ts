"use server";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/lib/auth";
import type { FormState } from "@/lib/form-state";
import { safeNextPath } from "@/lib/session";

const signUpSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(60, "Keep your name under 60 characters."),
  email: z.email("Enter a valid email address.").trim().toLowerCase(),
  password: z.string().min(8, "Use at least 8 characters for your password.").max(128, "That password is too long."),
});

const signInSchema = z.object({
  email: z.email("Enter a valid email address.").trim().toLowerCase(),
  password: z.string().min(1, "Enter your password."),
});

const text = (form: FormData, key: string) => String(form.get(key) ?? "");

export async function signUp(_previous: FormState, form: FormData): Promise<FormState> {
  const values = { name: text(form, "name"), email: text(form, "email") };
  const parsed = signUpSchema.safeParse({ ...values, password: text(form, "password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };

  try {
    await auth.api.signUpEmail({ body: parsed.data });
  } catch (error) {
    if (error instanceof APIError) {
      const taken = error.body?.code === "USER_ALREADY_EXISTS" || error.status === "UNPROCESSABLE_ENTITY";
      return {
        error: taken
          ? "That email already has an account. Sign in instead."
          : "Couldn't create your account. Check your details and try again.",
        values,
      };
    }
    throw error;
  }
  redirect(safeNextPath(form.get("next"), "/onboarding"));
}

export async function signIn(_previous: FormState, form: FormData): Promise<FormState> {
  const values = { email: text(form, "email") };
  const parsed = signInSchema.safeParse({ ...values, password: text(form, "password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };

  try {
    await auth.api.signInEmail({ body: parsed.data });
  } catch (error) {
    if (error instanceof APIError) return { error: "Wrong email or password.", values };
    throw error;
  }
  redirect(safeNextPath(form.get("next"), "/home"));
}

export async function signOut() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/");
}
