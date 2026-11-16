import { and, asc, count, desc, eq, gte, inArray, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db";
import { expense, expenseShare, membership, shoppingItem } from "@/db/schema";
import { splitEvenly } from "@/lib/money";

// The shopping list and what was paid for it. Callers have already established who is
// asking and which household they are in (see requireExtra).

export const MAX_ITEMS = 200;
export const ITEM_LENGTH = 60;

/** What still needs buying, oldest first, so the list keeps its order as people add to it. */
export async function listToBuy(householdId: string) {
  return db
    .select()
    .from(shoppingItem)
    .where(and(eq(shoppingItem.householdId, householdId), isNull(shoppingItem.boughtAt)))
    .orderBy(asc(shoppingItem.createdAt));
}

/** What has been bought but not paid up for yet, from the last two weeks. */
export async function listBought(householdId: string, now: Date) {
  const since = new Date(now.getTime() - 14 * 86_400_000);
  return db
    .select()
    .from(shoppingItem)
    .where(
      and(
        eq(shoppingItem.householdId, householdId),
        isNotNull(shoppingItem.boughtAt),
        isNull(shoppingItem.expenseId),
        gte(shoppingItem.boughtAt, since),
      ),
    )
    .orderBy(desc(shoppingItem.boughtAt));
}

export async function addItem(householdId: string, userId: string, name: string): Promise<"ok" | "full"> {
  const [open] = await db
    .select({ items: count() })
    .from(shoppingItem)
    .where(and(eq(shoppingItem.householdId, householdId), isNull(shoppingItem.boughtAt)));
  if (open.items >= MAX_ITEMS) return "full";
  await db.insert(shoppingItem).values({ householdId, name, addedBy: userId });
  return "ok";
}

const inHousehold = (householdId: string, itemId: string) =>
  and(eq(shoppingItem.id, itemId), eq(shoppingItem.householdId, householdId));

/** Say "I'll buy it", or take that back. */
export async function setClaim(householdId: string, userId: string, itemId: string, claim: boolean) {
  await db
    .update(shoppingItem)
    .set({ claimedBy: claim ? userId : null })
    .where(and(inHousehold(householdId, itemId), isNull(shoppingItem.boughtAt)));
}

/** Tick an item off as bought, or put it back on the list. Only what is not paid up for can go back. */
export async function setBought(householdId: string, userId: string, itemId: string, bought: boolean) {
  await db
    .update(shoppingItem)
    .set(bought ? { boughtAt: new Date(), boughtBy: userId } : { boughtAt: null, boughtBy: null })
    .where(and(inHousehold(householdId, itemId), isNull(shoppingItem.expenseId)));
}

export async function removeItem(householdId: string, itemId: string) {
  await db.delete(shoppingItem).where(and(inHousehold(householdId, itemId), isNull(shoppingItem.expenseId)));
}

/** The ids among these that are members of the household. */
async function membersAmong(householdId: string, userIds: readonly string[]) {
  if (userIds.length === 0) return [];
  const rows = await db
    .select({ userId: membership.userId })
    .from(membership)
    .where(and(eq(membership.householdId, householdId), inArray(membership.userId, [...userIds])))
    .orderBy(asc(membership.joinedAt), asc(membership.userId));
  return rows.map((row) => row.userId);
}

export type ExpenseInput = { paidBy: string; amount: number; description: string; sharedBy: readonly string[] };

/**
 * Record that someone paid for something, shared evenly between some of the household.
 * Returns "nobody" when none of the people named live there.
 */
export async function addExpense(householdId: string, input: ExpenseInput): Promise<"ok" | "nobody"> {
  const [payer] = await membersAmong(householdId, [input.paidBy]);
  const sharers = await membersAmong(householdId, input.sharedBy);
  if (!payer || sharers.length === 0) return "nobody";
  await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(expense)
      .values({ householdId, paidBy: payer, amount: input.amount, description: input.description })
      .returning({ id: expense.id });
    await tx.insert(expenseShare).values(splitEvenly(input.amount, sharers).map((share) => ({ expenseId: created.id, ...share })));
  });
  return "ok";
}

/**
 * "This is what I paid for what I bought": turn the items this person has ticked off
 * into one expense. The items then leave the list for good.
 */
export async function payForBought(
  householdId: string,
  userId: string,
  amount: number,
  sharedBy: readonly string[],
): Promise<"ok" | "nothing" | "nobody"> {
  const sharers = await membersAmong(householdId, sharedBy);
  if (sharers.length === 0) return "nobody";
  return db.transaction(async (tx) => {
    const items = await tx
      .select({ id: shoppingItem.id, name: shoppingItem.name })
      .from(shoppingItem)
      .where(
        and(
          eq(shoppingItem.householdId, householdId),
          eq(shoppingItem.boughtBy, userId),
          isNotNull(shoppingItem.boughtAt),
          isNull(shoppingItem.expenseId),
        ),
      )
      // In the order they were ticked off, so the description reads the way the shop went.
      .orderBy(asc(shoppingItem.boughtAt))
      .for("update");
    if (items.length === 0) return "nothing";

    const names = items.map((item) => item.name).join(", ");
    const description = `Shopping: ${names.length > 140 ? `${names.slice(0, 137)}…` : names}`;
    const [created] = await tx
      .insert(expense)
      .values({ householdId, paidBy: userId, amount, description })
      .returning({ id: expense.id });
    await tx.insert(expenseShare).values(splitEvenly(amount, sharers).map((share) => ({ expenseId: created.id, ...share })));
    await tx
      .update(shoppingItem)
      .set({ expenseId: created.id })
      .where(inArray(shoppingItem.id, items.map((item) => item.id)));
    return "ok";
  });
}

/** One person paying another back. Stored as an expense whose only share is the receiver's. */
export async function addSettlement(householdId: string, from: string, to: string, amount: number): Promise<"ok" | "nobody"> {
  const both = await membersAmong(householdId, [from, to]);
  if (from === to || both.length !== 2) return "nobody";
  await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(expense)
      .values({ householdId, paidBy: from, amount, description: "Paid back", isSettlement: true })
      .returning({ id: expense.id });
    await tx.insert(expenseShare).values({ expenseId: created.id, userId: to, amount });
  });
  return "ok";
}

/** Every expense of the household with its shares, newest first. */
export async function listExpenses(householdId: string) {
  const rows = await db.select().from(expense).where(eq(expense.householdId, householdId)).orderBy(desc(expense.createdAt));
  if (rows.length === 0) return [];
  const shares = await db
    .select()
    .from(expenseShare)
    .where(inArray(expenseShare.expenseId, rows.map((row) => row.id)));
  return rows.map((row) => ({
    ...row,
    shares: shares.filter((share) => share.expenseId === row.id).map(({ userId, amount }) => ({ userId, amount })),
  }));
}

/** Take an expense back. Whoever paid can, and so can an admin. Its shopping items return to "bought". */
export async function removeExpense(householdId: string, userId: string, expenseId: string, isAdmin: boolean) {
  const mine = and(eq(expense.id, expenseId), eq(expense.householdId, householdId));
  await db.delete(expense).where(isAdmin ? mine : and(mine, eq(expense.paidBy, userId)));
}
