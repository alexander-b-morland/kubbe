"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hasExtra } from "@/lib/extras";
import { requireExtra } from "@/lib/extras-guard";
import type { FormState } from "@/lib/form-state";
import { AMOUNT_MESSAGES, amountProblem, parseAmount } from "@/lib/money";
import { addItem, ITEM_LENGTH, MAX_ITEMS, payForBought, removeItem, setBought, setClaim } from "@/lib/shopping";

export type ShoppingState = (FormState & { saved?: boolean }) | undefined;

const idSchema = z.uuid();

function refresh() {
  revalidatePath("/shopping");
  revalidatePath("/expenses");
  revalidatePath("/dinner", "layout");
  revalidatePath("/home");
}

export async function addItemAction(_previous: ShoppingState, form: FormData): Promise<ShoppingState> {
  const { user, household } = await requireExtra("shopping");
  const name = String(form.get("name") ?? "").replace(/\s+/g, " ").trim();
  if (!name) return { error: "Write what to buy." };
  if (name.length > ITEM_LENGTH) return { error: `Keep it under ${ITEM_LENGTH} characters.`, values: { name } };
  const result = await addItem(household.id, user.id, name);
  if (result === "full") return { error: `The list holds ${MAX_ITEMS} things. Tick some off first.`, values: { name } };
  if (result === "already") return { error: `${name} is already on the list.`, values: { name } };
  refresh();
  return { saved: true };
}

export async function claimItemAction(itemId: string, claim: boolean): Promise<ShoppingState> {
  const { user, household } = await requireExtra("shopping");
  if (idSchema.safeParse(itemId).success) await setClaim(household.id, user.id, itemId, claim === true);
  refresh();
  return { saved: true };
}

export async function boughtItemAction(itemId: string, bought: boolean): Promise<ShoppingState> {
  const { user, household } = await requireExtra("shopping");
  if (idSchema.safeParse(itemId).success) await setBought(household.id, user.id, itemId, bought === true);
  refresh();
  return { saved: true };
}

export async function removeItemAction(itemId: string): Promise<ShoppingState> {
  const { household } = await requireExtra("shopping");
  if (idSchema.safeParse(itemId).success) await removeItem(household.id, itemId);
  refresh();
  return { saved: true };
}

/** "This is what I paid for what I ticked off": becomes one expense, split between the people chosen. */
export async function payForBoughtAction(_previous: ShoppingState, form: FormData): Promise<ShoppingState> {
  const { user, household } = await requireExtra("shopping");
  if (!hasExtra(household, "expenses")) return { error: "Expenses are switched off for this household." };
  const typed = String(form.get("amount") ?? "");
  const problem = amountProblem(typed);
  const amount = parseAmount(typed);
  if (problem === "empty" || problem === "not-a-number") return { error: "Enter what you paid, like 349 or 349,50.", values: { amount: typed } };
  if (problem || amount === null) return { error: AMOUNT_MESSAGES[problem ?? "not-a-number"], values: { amount: typed } };
  const sharedBy = form.getAll("sharedBy").map(String);
  if (sharedBy.length === 0) return { error: "Tick at least one person to split it between.", values: { amount: typed } };

  const result = await payForBought(household.id, user.id, amount, sharedBy, new Date());
  if (result === "nothing") return { error: "There is nothing ticked off to pay for. Tick off what you bought first." };
  if (result === "nobody") return { error: "None of those people live here any more.", values: { amount: typed } };
  refresh();
  return { saved: true };
}
