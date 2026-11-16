"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/lib/form-state";
import { createHousehold, joinHousehold } from "@/lib/households";
import { isJoinCode, normaliseJoinCode } from "@/lib/join-code";
import { allowAttempt, clientAddress, tooManyAttempts } from "@/lib/rate-limit";
import { requireUser } from "@/lib/session";

const nameSchema = z
  .string()
  .trim()
  .min(1, "Give your household a name.")
  .max(40, "Keep the name under 40 characters.");

export async function createHouseholdAction(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const name = String(form.get("name") ?? "");
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { error: parsed.error.issues[0].message, values: { name } };

  await createHousehold(user.id, parsed.data, String(form.get("timeZone") ?? ""));
  // Freshly created, or already in a household: either way, home is the place.
  redirect("/home");
}

export async function joinHouseholdAction(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const typed = String(form.get("code") ?? "");
  const code = normaliseJoinCode(typed);
  if (!isJoinCode(code)) {
    return {
      error: "A join code is 6 letters and numbers. Check it and try again.",
      values: { code: typed },
    };
  }

  // A join code is short enough to guess at, given enough tries. So tries are counted.
  const [byUser, byAddress] = await Promise.all([
    allowAttempt(`join:user:${user.id}`, 10, 3600),
    allowAttempt(`join:address:${await clientAddress()}`, 30, 3600),
  ]);
  if (!byUser || !byAddress) return { error: tooManyAttempts, values: { code: typed } };

  const result = await joinHousehold(user.id, code);
  if (!result.ok && result.reason === "not-found") {
    return {
      error: "No household has that code. Check it with the person who shared it.",
      values: { code: typed },
    };
  }
  if (!result.ok && result.reason === "full") {
    return { error: "That household is full. Ask its admin to make room.", values: { code: typed } };
  }
  redirect("/home");
}
