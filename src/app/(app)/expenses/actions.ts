"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireExtra } from "@/lib/extras-guard";
import type { FormState } from "@/lib/form-state";
import { formatAmount, parseAmount, type Split } from "@/lib/money";
import { addExpense, addSettlement, removeExpense, updateExpense, type ExpenseInput } from "@/lib/shopping";

export type ExpenseState = (FormState & { saved?: boolean }) | undefined;

function refresh() {
  revalidatePath("/expenses");
  revalidatePath("/shopping");
  revalidatePath("/home");
}

const personSchema = z.string().min(1).max(64);

/** Read an expense out of its form. A string is what is wrong with it. */
function readExpense(form: FormData, me: string, currency: string): { input: ExpenseInput; values: Record<string, string> } | { error: string; values: Record<string, string> } {
  const description = String(form.get("description") ?? "").replace(/\s+/g, " ").trim();
  const typed = String(form.get("amount") ?? "");
  const values = { description, amount: typed };
  if (!description) return { error: "Say what it was for.", values };
  if (description.length > 80) return { error: "Keep the description under 80 characters.", values };
  const amount = parseAmount(typed);
  if (amount === null) return { error: "Enter an amount, like 349 or 349,50.", values };

  let split: Split;
  if (form.get("split") === "amounts") {
    const parts: { userId: string; amount: number }[] = [];
    for (const [name, value] of form) {
      if (!name.startsWith("share-") || String(value).trim() === "") continue;
      const userId = personSchema.safeParse(name.slice("share-".length));
      const part = parseAmount(String(value));
      if (!userId.success || part === null) return { error: "Enter each person's part as an amount, like 120 or 120,50. Leave a box empty for nothing.", values };
      parts.push({ userId: userId.data, amount: part });
    }
    if (parts.length === 0) return { error: "Enter at least one person's part.", values };
    const sum = parts.reduce((total, part) => total + part.amount, 0);
    if (sum !== amount) {
      return { error: `The parts add up to ${formatAmount(sum, currency)}, but the amount is ${formatAmount(amount, currency)}. Make them match.`, values };
    }
    split = { kind: "amounts", parts };
  } else {
    const userIds = form.getAll("sharedBy").map(String).filter((id) => personSchema.safeParse(id).success);
    if (userIds.length === 0) return { error: "Tick at least one person to split it between.", values };
    split = { kind: "even", userIds };
  }
  const paidBy = personSchema.safeParse(form.get("paidBy") ?? me);
  return { input: { paidBy: paidBy.success ? paidBy.data : me, amount, description, split }, values };
}

const gone = "Some of those people don't live here any more. Reload and try again.";

export async function addExpenseAction(_previous: ExpenseState, form: FormData): Promise<ExpenseState> {
  const { user, household } = await requireExtra("expenses");
  const read = readExpense(form, user.id, household.currency);
  if ("error" in read) return read;
  const result = await addExpense(household.id, user.id, read.input);
  if (result === "nobody") return { error: gone, values: read.values };
  if (result === "mismatch") return { error: "The parts don't add up to the amount. Make them match.", values: read.values };
  if (result === "full") return { error: "The expense list is full. Remove old ones you no longer need.", values: read.values };
  refresh();
  return { saved: true };
}

/** Correct an expense. Whoever paid or entered it can, and so can an admin. */
export async function updateExpenseAction(expenseId: string, _previous: ExpenseState, form: FormData): Promise<ExpenseState> {
  const { user, household, membership } = await requireExtra("expenses");
  if (!z.uuid().safeParse(expenseId).success) return { error: "That expense is gone." };
  const read = readExpense(form, user.id, household.currency);
  if ("error" in read) return read;
  const result = await updateExpense(household.id, user.id, expenseId, membership.role === "admin", read.input);
  if (result === "nobody") return { error: gone, values: read.values };
  if (result === "mismatch") return { error: "The parts don't add up to the amount. Make them match.", values: read.values };
  if (result === "gone") return { error: "That expense is gone, or it is not yours to change." };
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
  const result = await addSettlement(household.id, user.id, from, to, amount);
  refresh();
  if (result === "settled") return { error: "That is already paid, or the amounts have changed. What is left is shown here now." };
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
