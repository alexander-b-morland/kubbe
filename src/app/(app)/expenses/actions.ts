"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireExtra } from "@/lib/extras-guard";
import type { FormState } from "@/lib/form-state";
import { parseAmount } from "@/lib/money";
import { addExpense, addSettlement, removeExpense } from "@/lib/shopping";

export type ExpenseState = (FormState & { saved?: boolean }) | undefined;

function refresh() {
  revalidatePath("/expenses");
  revalidatePath("/shopping");
  revalidatePath("/home");
}

const personSchema = z.string().min(1).max(64);

export async function addExpenseAction(_previous: ExpenseState, form: FormData): Promise<ExpenseState> {
  const { user, household } = await requireExtra("expenses");
  const description = String(form.get("description") ?? "").trim();
  const typed = String(form.get("amount") ?? "");
  const values = { description, amount: typed };
  if (!description) return { error: "Say what it was for.", values };
  if (description.length > 80) return { error: "Keep the description under 80 characters.", values };
  const amount = parseAmount(typed);
  if (amount === null) return { error: "Enter an amount, like 349 or 349,50.", values };
  const sharedBy = form.getAll("sharedBy").map(String);
  if (sharedBy.length === 0) return { error: "Tick at least one person to split it between.", values };

  const paidBy = personSchema.safeParse(form.get("paidBy") ?? user.id);
  const result = await addExpense(household.id, { paidBy: paidBy.success ? paidBy.data : user.id, amount, description, sharedBy });
  if (result === "nobody") return { error: "Some of those people don't live here any more. Reload and try again.", values };
  refresh();
  return { saved: true };
}

/** Record that one person has paid another back. Either of the two can, and so can an admin. */
export async function settleAction(from: string, to: string, amount: number): Promise<ExpenseState> {
  const { user, household, membership } = await requireExtra("expenses");
  const valid =
    personSchema.safeParse(from).success &&
    personSchema.safeParse(to).success &&
    z.number().int().positive().max(1_000_000_000).safeParse(amount).success;
  if (!valid) return { error: "That payment doesn't add up. Reload and try again." };
  if (user.id !== from && user.id !== to && membership.role !== "admin") {
    return { error: "Only the two people involved, or an admin, can mark this as paid." };
  }
  if ((await addSettlement(household.id, from, to, amount)) === "nobody") {
    return { error: "One of them doesn't live here any more." };
  }
  refresh();
  return { saved: true };
}

export async function removeExpenseAction(expenseId: string): Promise<ExpenseState> {
  const { user, household, membership } = await requireExtra("expenses");
  if (z.uuid().safeParse(expenseId).success) {
    await removeExpense(household.id, user.id, expenseId, membership.role === "admin");
  }
  refresh();
  return { saved: true };
}
