import { and, asc, count, desc, eq, gte, inArray, isNotNull, isNull, or } from "drizzle-orm";
import { db, type Transaction } from "@/db";
import { dinner, dinnerReply, dish, dishIngredient, expense, expenseShare, membership, shoppingItem } from "@/db/schema";
import { resyncIngredient } from "@/lib/dinner/service";
import { balances, settleUp, sharesFor, splitEvenly, type Split } from "@/lib/money";
import { lockHousehold } from "@/lib/settings";

// The shopping list and what was paid for it. Callers have already established who is
// asking and which household they are in (see requireExtra).

export const MAX_ITEMS = 200;
export const ITEM_LENGTH = 80;
export const MAX_EXPENSES = 5000;
/** How long something ticked off waits to be paid up for. */
const BAG_DAYS = 14;

// An item, with the dinner it is for when it is an ingredient.
const itemFields = {
  id: shoppingItem.id,
  name: shoppingItem.name,
  addedBy: shoppingItem.addedBy,
  claimedBy: shoppingItem.claimedBy,
  boughtAt: shoppingItem.boughtAt,
  boughtBy: shoppingItem.boughtBy,
  ingredientId: shoppingItem.ingredientId,
  createdAt: shoppingItem.createdAt,
  dinnerId: dish.dinnerId,
  dinnerDay: dinner.day,
  dishTitle: dish.title,
};

const items = () =>
  db
    .select(itemFields)
    .from(shoppingItem)
    .leftJoin(dishIngredient, eq(dishIngredient.id, shoppingItem.ingredientId))
    .leftJoin(dish, eq(dish.id, dishIngredient.dishId))
    .leftJoin(dinner, eq(dinner.id, dish.dinnerId));

/** What still needs buying, oldest first, so the list keeps its order as people add to it. */
export async function listToBuy(householdId: string) {
  return items()
    .where(and(eq(shoppingItem.householdId, householdId), isNull(shoppingItem.boughtAt)))
    // A dinner's ingredients arrive together, so the name settles their order.
    .orderBy(asc(shoppingItem.createdAt), asc(shoppingItem.name));
}

/** Who said they are in for a dinner: the people a dinner's shopping is split between. */
export async function goingTo(dinnerId: string): Promise<string[]> {
  const rows = await db
    .select({ userId: dinnerReply.userId })
    .from(dinnerReply)
    .where(and(eq(dinnerReply.dinnerId, dinnerId), eq(dinnerReply.going, true)));
  return rows.map((row) => row.userId);
}

/** What has been bought but not paid up for yet, from the last two weeks. */
export async function listBought(householdId: string, now: Date) {
  const since = new Date(now.getTime() - BAG_DAYS * 86_400_000);
  return items()
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

export async function addItem(householdId: string, userId: string, name: string): Promise<"ok" | "full" | "already"> {
  const open = await db
    .select({ name: shoppingItem.name })
    .from(shoppingItem)
    .where(and(eq(shoppingItem.householdId, householdId), isNull(shoppingItem.boughtAt)));
  if (open.length >= MAX_ITEMS) return "full";
  if (open.some((item) => item.name.trim().toLowerCase() === name.toLowerCase())) return "already";
  await db.insert(shoppingItem).values({ householdId, name, addedBy: userId });
  return "ok";
}

const inHousehold = (householdId: string, itemId: string) =>
  and(eq(shoppingItem.id, itemId), eq(shoppingItem.householdId, householdId));

/** Say "I'll buy it", or take that back. Nobody takes over or drops someone else's claim. */
export async function setClaim(householdId: string, userId: string, itemId: string, claim: boolean) {
  const [changed] = await db
    .update(shoppingItem)
    .set({ claimedBy: claim ? userId : null })
    .where(
      and(
        inHousehold(householdId, itemId),
        isNull(shoppingItem.boughtAt),
        claim ? isNull(shoppingItem.claimedBy) : eq(shoppingItem.claimedBy, userId),
      ),
    )
    .returning({ ingredientId: shoppingItem.ingredientId });
  // The dinner remembers the promise too, so it survives the vote being opened again.
  if (changed?.ingredientId) {
    await db.update(dishIngredient).set({ claimedBy: claim ? userId : null }).where(eq(dishIngredient.id, changed.ingredientId));
  }
}

/**
 * "I'll buy everything left" for a dinner's dish: every thing on the list for it that is
 * not bought and that nobody has said they will buy. What someone else took stays theirs.
 */
export async function claimAllForDish(householdId: string, userId: string, dishId: string): Promise<number> {
  const open = await db
    .select({ id: shoppingItem.id })
    .from(shoppingItem)
    .innerJoin(dishIngredient, eq(shoppingItem.ingredientId, dishIngredient.id))
    .where(and(eq(shoppingItem.householdId, householdId), eq(dishIngredient.dishId, dishId), isNull(shoppingItem.boughtAt), isNull(shoppingItem.claimedBy)));
  if (open.length === 0) return 0;
  // Claimed only if still free at this moment, and the dinner remembers exactly those.
  const taken = await db
    .update(shoppingItem)
    .set({ claimedBy: userId })
    .where(and(inArray(shoppingItem.id, open.map((item) => item.id)), isNull(shoppingItem.claimedBy), isNull(shoppingItem.boughtAt)))
    .returning({ ingredientId: shoppingItem.ingredientId });
  const ingredientIds = taken.map((item) => item.ingredientId).filter((id) => id !== null);
  if (ingredientIds.length > 0) await db.update(dishIngredient).set({ claimedBy: userId }).where(inArray(dishIngredient.id, ingredientIds));
  return taken.length;
}

/**
 * Tick an item off as bought, or put it back on the list. Only what is not paid up for
 * can go back, and only by whoever ticked it off. Something already ticked off stays
 * with whoever got there first.
 */
export async function setBought(householdId: string, userId: string, itemId: string, bought: boolean) {
  const [changed] = await db
    .update(shoppingItem)
    .set(bought ? { boughtAt: new Date(), boughtBy: userId } : { boughtAt: null, boughtBy: null })
    .where(
      and(
        inHousehold(householdId, itemId),
        isNull(shoppingItem.expenseId),
        bought ? isNull(shoppingItem.boughtAt) : eq(shoppingItem.boughtBy, userId),
      ),
    )
    .returning({ ingredientId: shoppingItem.ingredientId });
  // Back on the list, a dinner ingredient is only wanted if the dinner still needs it.
  if (!bought && changed?.ingredientId) await resyncIngredient(householdId, userId, changed.ingredientId);
}

/**
 * Take an item off the list. For a dinner ingredient that means nobody needs to buy it,
 * so the dinner then shows it as something the flat already has.
 */
export async function removeItem(householdId: string, itemId: string) {
  await db.transaction(async (tx) => {
    const [removed] = await tx
      .delete(shoppingItem)
      .where(and(inHousehold(householdId, itemId), isNull(shoppingItem.expenseId)))
      .returning({ ingredientId: shoppingItem.ingredientId, boughtAt: shoppingItem.boughtAt });
    if (removed?.ingredientId && !removed.boughtAt) {
      await tx.update(dishIngredient).set({ atHome: true }).where(eq(dishIngredient.id, removed.ingredientId));
    }
  });
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

export type ExpenseInput = { paidBy: string; amount: number; description: string; split: Split };

/** Who paid and each person's part, once everyone named is known to live here and the parts add up. */
async function checkExpense(householdId: string, input: ExpenseInput) {
  const named = input.split.kind === "even" ? input.split.userIds : input.split.parts.map((part) => part.userId);
  const [payers, inOrder] = await Promise.all([membersAmong(householdId, [input.paidBy]), membersAmong(householdId, named)]);
  if (payers.length === 0) return "nobody" as const;
  // When an amount does not divide evenly, whoever paid takes the odd øre, not a roommate.
  const sharers = [...inOrder].sort((a, b) => Number(b === payers[0]) - Number(a === payers[0]));
  // Only people who live here share a cost, in the order they joined, so the odd unit lands the same way each time.
  const split: Split =
    input.split.kind === "even"
      ? { kind: "even", userIds: sharers }
      : { kind: "amounts", parts: input.split.parts.filter((part) => sharers.includes(part.userId)) };
  if (input.split.kind === "amounts" && split.kind === "amounts" && split.parts.length !== input.split.parts.length) return "nobody" as const;
  const shares = sharesFor(input.amount, split);
  if (shares === "empty") return "nobody" as const;
  if (shares === "mismatch") return "mismatch" as const;
  return { payer: payers[0], shares };
}

/**
 * Record that someone paid for something, shared between some of the household.
 * Returns "nobody" when the people named do not live there, "mismatch" when the parts
 * do not add up to the amount.
 */
export async function addExpense(householdId: string, createdBy: string, input: ExpenseInput): Promise<"ok" | "nobody" | "mismatch" | "full"> {
  const checked = await checkExpense(householdId, input);
  if (typeof checked === "string") return checked;
  const [existing] = await db.select({ expenses: count() }).from(expense).where(eq(expense.householdId, householdId));
  if (existing.expenses >= MAX_EXPENSES) return "full";
  await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(expense)
      .values({ householdId, paidBy: checked.payer, createdBy, amount: input.amount, description: input.description })
      .returning({ id: expense.id });
    await tx.insert(expenseShare).values(checked.shares.map((share) => ({ expenseId: created.id, ...share })));
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
  now: Date,
): Promise<"ok" | "nothing" | "nobody"> {
  const sharers = await membersAmong(householdId, sharedBy);
  if (sharers.length === 0) return "nobody";
  // The same things the screen shows as "You got": nothing older is swept along.
  const since = new Date(now.getTime() - BAG_DAYS * 86_400_000);
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
          gte(shoppingItem.boughtAt, since),
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
      .values({ householdId, paidBy: userId, createdBy: userId, amount, description })
      .returning({ id: expense.id });
    await tx.insert(expenseShare).values(splitEvenly(amount, sharers).map((share) => ({ expenseId: created.id, ...share })));
    await tx
      .update(shoppingItem)
      .set({ expenseId: created.id })
      .where(inArray(shoppingItem.id, items.map((item) => item.id)));
    return "ok";
  });
}

/**
 * One person paying another back. Stored as an expense whose only share is the receiver's.
 *
 * It applies to what was on screen: the payment is only recorded while the books still
 * say that much is owed between those two. So two people pressing "Paid" on the same
 * line record it once, and a debt with someone who has moved out can still be closed.
 */
export async function addSettlement(householdId: string, actorId: string, from: string, to: string, amount: number): Promise<"ok" | "settled"> {
  return db.transaction(async (tx) => {
    await lockHousehold(tx, householdId);
    const owed = settleUp(balances(await readExpenses(tx, householdId)));
    if (!owed.some((transfer) => transfer.from === from && transfer.to === to && transfer.amount >= amount)) return "settled";
    const [created] = await tx
      .insert(expense)
      .values({ householdId, paidBy: from, createdBy: actorId, amount, description: "Paid back", isSettlement: true })
      .returning({ id: expense.id });
    await tx.insert(expenseShare).values({ expenseId: created.id, userId: to, amount });
    return "ok";
  });
}

/** Every expense of the household with its shares, newest first. */
export async function listExpenses(householdId: string) {
  return readExpenses(db, householdId);
}

async function readExpenses(executor: typeof db | Transaction, householdId: string) {
  const rows = await executor.select().from(expense).where(eq(expense.householdId, householdId)).orderBy(desc(expense.createdAt));
  if (rows.length === 0) return [];
  const shares = await executor
    .select()
    .from(expenseShare)
    .where(inArray(expenseShare.expenseId, rows.map((row) => row.id)));
  return rows.map((row) => ({
    ...row,
    shares: shares.filter((share) => share.expenseId === row.id).map(({ userId, amount }) => ({ userId, amount })),
  }));
}

/** This expense, if this person may change it: whoever paid, whoever entered it, or an admin. */
const changeable = (householdId: string, userId: string, expenseId: string, isAdmin: boolean) => {
  const found = and(eq(expense.id, expenseId), eq(expense.householdId, householdId));
  return isAdmin ? found : and(found, or(eq(expense.paidBy, userId), eq(expense.createdBy, userId)));
};

/** Take an expense back. Its shopping items return to "bought". */
export async function removeExpense(householdId: string, userId: string, expenseId: string, isAdmin: boolean) {
  await db.delete(expense).where(changeable(householdId, userId, expenseId, isAdmin));
}

/** Correct an expense: what it was for, the amount, who paid and how it is shared. Not for repayments. */
export async function updateExpense(
  householdId: string,
  userId: string,
  expenseId: string,
  isAdmin: boolean,
  input: ExpenseInput,
): Promise<"ok" | "nobody" | "mismatch" | "gone"> {
  const checked = await checkExpense(householdId, input);
  if (typeof checked === "string") return checked;
  return db.transaction(async (tx) => {
    const [changed] = await tx
      .update(expense)
      .set({ paidBy: checked.payer, amount: input.amount, description: input.description })
      .where(and(changeable(householdId, userId, expenseId, isAdmin), eq(expense.isSettlement, false)))
      .returning({ id: expense.id });
    if (!changed) return "gone";
    await tx.delete(expenseShare).where(eq(expenseShare.expenseId, expenseId));
    await tx.insert(expenseShare).values(checked.shares.map((share) => ({ expenseId, ...share })));
    return "ok";
  });
}
