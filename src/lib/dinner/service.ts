import { and, asc, count, desc, eq, gte, inArray, isNotNull, isNull, lt, lte } from "drizzle-orm";
import { db, type Transaction } from "@/db";
import { dinner, dinnerReply, dinnerRule, dish, dishIngredient, dishVote, membership, profile, shoppingItem } from "@/db/schema";
import { MAX_DISHES, MAX_INGREDIENTS, missingDinnerDays, weekdayOf, type DinnerRule } from "./plan";

// Dinners in the database. Callers have already established who is asking and which
// household they are in (see requireExtra); every query here is scoped to that household.

export type Dinner = typeof dinner.$inferSelect;

export async function listRules(householdId: string): Promise<DinnerRule[]> {
  return db
    .select({ weekday: dinnerRule.weekday, time: dinnerRule.time })
    .from(dinnerRule)
    .where(eq(dinnerRule.householdId, householdId))
    .orderBy(asc(dinnerRule.weekday));
}

/**
 * Set the fixed dinner days. Dinners already made from a day that is dropped or moved
 * to another time are removed, unless someone has put something on them.
 */
export async function saveRules(householdId: string, rules: readonly DinnerRule[], today: string) {
  await db.transaction(async (tx) => {
    const before = await tx.select().from(dinnerRule).where(eq(dinnerRule.householdId, householdId));
    const after = new Map(rules.map((rule) => [rule.weekday, rule.time]));
    await tx.delete(dinnerRule).where(eq(dinnerRule.householdId, householdId));
    if (rules.length > 0) {
      await tx.insert(dinnerRule).values(rules.map((rule) => ({ householdId, weekday: rule.weekday, time: rule.time })));
    }

    const stale = new Map(before.filter((rule) => after.get(rule.weekday) !== rule.time).map((rule) => [rule.weekday, rule.time]));
    if (stale.size === 0) return;
    const untouched = await tx
      .select({ id: dinner.id, day: dinner.day, time: dinner.time, dishes: count(dish.id) })
      .from(dinner)
      .leftJoin(dish, eq(dish.dinnerId, dinner.id))
      .where(
        and(
          eq(dinner.householdId, householdId),
          gte(dinner.day, today),
          eq(dinner.cancelled, false),
          isNull(dinner.cookId),
          isNull(dinner.cleanerId),
        ),
      )
      .groupBy(dinner.id);
    const gone = untouched.filter((row) => row.dishes === 0 && stale.get(weekdayOf(row.day)) === row.time).map((row) => row.id);
    if (gone.length > 0) await tx.delete(dinner).where(inArray(dinner.id, gone));
  });
}

/**
 * Dinners from today on, soonest first, with what the list needs to say about each.
 * Fixed dinner days that have no dinner yet get one here, so they exist once seen.
 */
export async function listUpcomingDinners(householdId: string, today: string) {
  const upcoming = and(eq(dinner.householdId, householdId), gte(dinner.day, today));
  const [rules, found] = await Promise.all([listRules(householdId), db.select().from(dinner).where(upcoming)]);
  let rows = found;
  const missing = missingDinnerDays(rules, new Set(rows.map((row) => row.day)), today);
  if (missing.length > 0) {
    await db.insert(dinner).values(missing.map((slot) => ({ householdId, ...slot }))).onConflictDoNothing();
    rows = await db.select().from(dinner).where(upcoming);
  }
  return describeDinners(rows);
}

/** Dinners on a stretch of days, as they are: nothing is made from the fixed days here. */
export async function listDinnersBetween(householdId: string, fromDay: string, toDay: string) {
  if (fromDay > toDay) return [];
  return describeDinners(await db.select().from(dinner).where(and(eq(dinner.householdId, householdId), gte(dinner.day, fromDay), lte(dinner.day, toDay))));
}

/** What the lists need to say about each dinner: its ideas, who answered, who voted. */
async function describeDinners(rows: Dinner[]) {
  rows.sort((a, b) => a.day.localeCompare(b.day));
  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.id);
  const [dishes, replies, votes] = await Promise.all([
    db.select({ id: dish.id, dinnerId: dish.dinnerId, title: dish.title }).from(dish).where(inArray(dish.dinnerId, ids)),
    db.select().from(dinnerReply).where(inArray(dinnerReply.dinnerId, ids)),
    db
      .selectDistinct({ dinnerId: dish.dinnerId, userId: dishVote.userId })
      .from(dishVote)
      .innerJoin(dish, eq(dish.id, dishVote.dishId))
      .where(inArray(dish.dinnerId, ids)),
  ]);
  return rows.map((row) => {
    const ideas = dishes.filter((idea) => idea.dinnerId === row.id);
    return {
      ...row,
      ideas: ideas.length,
      chosenTitle: ideas.find((idea) => idea.id === row.chosenDishId)?.title ?? null,
      /** Who said they are in, and who said they are not. Everyone else has not answered. */
      going: replies.filter((reply) => reply.dinnerId === row.id && reply.going).map((reply) => reply.userId),
      notGoing: replies.filter((reply) => reply.dinnerId === row.id && !reply.going).map((reply) => reply.userId),
      /** Everyone who has voted for at least one idea. */
      voters: votes.filter((vote) => vote.dinnerId === row.id).map((vote) => vote.userId),
    };
  });
}

export type UpcomingDinner = Awaited<ReturnType<typeof listUpcomingDinners>>[number];

/** One dinner with everything on it, or null when it is not this household's. */
export async function getDinner(householdId: string, dinnerId: string) {
  const [found] = await db.select().from(dinner).where(and(eq(dinner.id, dinnerId), eq(dinner.householdId, householdId)));
  if (!found) return null;
  const [dishes, replies] = await Promise.all([
    db.select().from(dish).where(eq(dish.dinnerId, dinnerId)).orderBy(asc(dish.createdAt)),
    db.select({ userId: dinnerReply.userId, going: dinnerReply.going }).from(dinnerReply).where(eq(dinnerReply.dinnerId, dinnerId)),
  ]);
  const dishIds = dishes.map((row) => row.id);
  const [votes, ingredients] =
    dishIds.length === 0
      ? [[], []]
      : await Promise.all([
          db.select().from(dishVote).where(inArray(dishVote.dishId, dishIds)),
          db
            .select({
              id: dishIngredient.id,
              dishId: dishIngredient.dishId,
              name: dishIngredient.name,
              atHome: dishIngredient.atHome,
              itemId: shoppingItem.id,
              claimedBy: shoppingItem.claimedBy,
              boughtAt: shoppingItem.boughtAt,
              boughtBy: shoppingItem.boughtBy,
            })
            .from(dishIngredient)
            .leftJoin(shoppingItem, eq(shoppingItem.ingredientId, dishIngredient.id))
            .where(inArray(dishIngredient.dishId, dishIds))
            .orderBy(asc(dishIngredient.name)),
        ]);
  return {
    ...found,
    going: replies.filter((reply) => reply.going).map((reply) => reply.userId),
    notGoing: replies.filter((reply) => !reply.going).map((reply) => reply.userId),
    dishes: dishes.map((row) => ({
      ...row,
      votes: votes.filter((vote) => vote.dishId === row.id).map((vote) => vote.userId),
      ingredients: ingredients.filter((ingredient) => ingredient.dishId === row.id),
    })),
  };
}

export type DinnerDetail = NonNullable<Awaited<ReturnType<typeof getDinner>>>;

/** What the household settled on lately, newest first. Used to avoid suggesting the same again. */
export async function recentDishTitles(householdId: string, today: string, limit = 10): Promise<string[]> {
  const rows = await db
    .select({ title: dish.title })
    .from(dinner)
    .innerJoin(dish, eq(dish.id, dinner.chosenDishId))
    .where(and(eq(dinner.householdId, householdId), lt(dinner.day, today)))
    .orderBy(desc(dinner.day))
    .limit(limit);
  return rows.map((row) => row.title);
}

/** What the people coming to a dinner wrote under "I don't eat". No names attached. */
export async function avoidsOfThoseComing(householdId: string, going: readonly string[]): Promise<{ people: number; avoids: string[] }> {
  const rows = await db
    .select({ userId: membership.userId, avoids: profile.avoids })
    .from(membership)
    .leftJoin(profile, eq(profile.userId, membership.userId))
    .where(eq(membership.householdId, householdId));
  const coming = rows.filter((row) => going.includes(row.userId));
  return { people: coming.length, avoids: coming.map((row) => (row.avoids ?? "").trim()).filter(Boolean) };
}

// ---------------------------------------------------------------------------
// Changing things. Each change runs in one transaction and ends by making the
// shopping list match the dinner.
// ---------------------------------------------------------------------------

async function lockDinner(tx: Transaction, householdId: string, dinnerId: string) {
  const [found] = await tx
    .select()
    .from(dinner)
    .where(and(eq(dinner.id, dinnerId), eq(dinner.householdId, householdId)))
    .for("update");
  return found ?? null;
}

/** The dinner a dish belongs to, locked, if it is this household's. */
async function lockDinnerOfDish(tx: Transaction, householdId: string, dishId: string) {
  const [found] = await tx.select({ dinnerId: dish.dinnerId, suggestedBy: dish.suggestedBy }).from(dish).where(eq(dish.id, dishId));
  if (!found) return null;
  const locked = await lockDinner(tx, householdId, found.dinnerId);
  return locked ? { dinner: locked, suggestedBy: found.suggestedBy } : null;
}

/**
 * Make the shopping list match the dinner: what the chosen dish needs and nobody has
 * at home is on the list, and nothing else from this dinner is. What is already
 * bought stays where it is.
 */
async function syncShopping(tx: Transaction, householdId: string, userId: string, dinnerId: string) {
  const [current] = await tx.select({ chosenDishId: dinner.chosenDishId, cancelled: dinner.cancelled }).from(dinner).where(eq(dinner.id, dinnerId));
  if (!current) return;
  const rows = await tx
    .select({
      id: dishIngredient.id,
      dishId: dishIngredient.dishId,
      name: dishIngredient.name,
      atHome: dishIngredient.atHome,
      itemId: shoppingItem.id,
      boughtAt: shoppingItem.boughtAt,
    })
    .from(dishIngredient)
    .innerJoin(dish, eq(dish.id, dishIngredient.dishId))
    .leftJoin(shoppingItem, eq(shoppingItem.ingredientId, dishIngredient.id))
    .where(eq(dish.dinnerId, dinnerId));
  const wanted = (row: (typeof rows)[number]) => !current.cancelled && row.dishId === current.chosenDishId && !row.atHome;

  const drop = rows.filter((row) => row.itemId && !row.boughtAt && !wanted(row)).map((row) => row.itemId!);
  // Someone may have ticked one off since it was read: what is bought is never dropped.
  if (drop.length > 0) await tx.delete(shoppingItem).where(and(inArray(shoppingItem.id, drop), isNull(shoppingItem.boughtAt)));
  const add = rows.filter((row) => !row.itemId && wanted(row));
  if (add.length > 0) {
    await tx.insert(shoppingItem).values(add.map((row) => ({ householdId, name: row.name, addedBy: userId, ingredientId: row.id })));
  }
}

/** Shopping items that are bought keep existing when their ingredient goes away. */
async function detachBought(tx: Transaction, ingredientIds: readonly string[]) {
  if (ingredientIds.length === 0) return;
  await tx
    .update(shoppingItem)
    .set({ ingredientId: null })
    .where(and(inArray(shoppingItem.ingredientId, [...ingredientIds]), isNotNull(shoppingItem.boughtAt)));
}

/** Plan a dinner on a day. A day has one dinner; one that was called off comes back. */
export async function addDinner(
  householdId: string,
  userId: string,
  day: string,
  time: number,
  /** Whether whoever plans it is coming. Nobody else is in until they say so. */
  plannerIsIn: boolean,
): Promise<{ id: string } | "taken"> {
  return db.transaction(async (tx) => {
    const answer = async (dinnerId: string) => {
      if (!plannerIsIn) return;
      await tx
        .insert(dinnerReply)
        .values({ dinnerId, userId, going: true })
        .onConflictDoUpdate({ target: [dinnerReply.dinnerId, dinnerReply.userId], set: { going: true } });
    };
    const [created] = await tx.insert(dinner).values({ householdId, day, time }).onConflictDoNothing().returning({ id: dinner.id });
    if (created) {
      await answer(created.id);
      return created;
    }
    const [revived] = await tx
      .update(dinner)
      .set({ cancelled: false, time })
      .where(and(eq(dinner.householdId, householdId), eq(dinner.day, day), eq(dinner.cancelled, true)))
      .returning({ id: dinner.id });
    if (!revived) return "taken";
    await answer(revived.id);
    // It comes back with its dish, so what that dish needs goes back on the list.
    await syncShopping(tx, householdId, userId, revived.id);
    return revived;
  });
}

/** Call a dinner off, or bring it back. A called-off dinner stays, so a fixed day does not make it again. */
export async function setCancelled(householdId: string, userId: string, dinnerId: string, cancelled: boolean) {
  await db.transaction(async (tx) => {
    if (!(await lockDinner(tx, householdId, dinnerId))) return;
    await tx.update(dinner).set({ cancelled }).where(eq(dinner.id, dinnerId));
    await syncShopping(tx, householdId, userId, dinnerId);
  });
}

/** "I'm in", or "Not this time". Someone who is not coming neither cooks nor cleans up. */
export async function setGoing(householdId: string, userId: string, dinnerId: string, going: boolean) {
  await db.transaction(async (tx) => {
    const found = await lockDinner(tx, householdId, dinnerId);
    if (!found) return;
    await tx
      .insert(dinnerReply)
      .values({ dinnerId, userId, going })
      .onConflictDoUpdate({ target: [dinnerReply.dinnerId, dinnerReply.userId], set: { going } });
    if (going) return;
    await tx
      .update(dinner)
      .set({ cookId: found.cookId === userId ? null : found.cookId, cleanerId: found.cleanerId === userId ? null : found.cleanerId })
      .where(eq(dinner.id, dinnerId));
  });
}

export type Duty = "cook" | "cleaner";

/** Volunteer to cook or to clean up, or step back. Returns "taken" when someone else already has it. */
export async function setDuty(householdId: string, userId: string, dinnerId: string, duty: Duty, take: boolean): Promise<"ok" | "taken" | "gone"> {
  return db.transaction(async (tx) => {
    const found = await lockDinner(tx, householdId, dinnerId);
    if (!found) return "gone";
    const holder = duty === "cook" ? found.cookId : found.cleanerId;
    if (take && holder && holder !== userId) return "taken";
    if (!take && holder !== userId) return "ok";
    await tx
      .update(dinner)
      .set(duty === "cook" ? { cookId: take ? userId : null } : { cleanerId: take ? userId : null })
      .where(eq(dinner.id, dinnerId));
    // Whoever cooks or cleans up is coming.
    if (take) {
      await tx
        .insert(dinnerReply)
        .values({ dinnerId, userId, going: true })
        .onConflictDoUpdate({ target: [dinnerReply.dinnerId, dinnerReply.userId], set: { going: true } });
    }
    return "ok";
  });
}

/**
 * Put a dish up for the vote. Whoever puts it up votes for it. `fromHelper` marks an
 * idea that came from the suggestions rather than from the person.
 */
export async function addDish(
  householdId: string,
  userId: string,
  dinnerId: string,
  input: { title: string; ingredients: readonly string[]; fromHelper: boolean },
): Promise<"ok" | "full" | "gone"> {
  return db.transaction(async (tx) => {
    if (!(await lockDinner(tx, householdId, dinnerId))) return "gone";
    const [existing] = await tx.select({ dishes: count() }).from(dish).where(eq(dish.dinnerId, dinnerId));
    if (existing.dishes >= MAX_DISHES) return "full";
    const [created] = await tx
      .insert(dish)
      .values({ dinnerId, title: input.title, suggestedBy: userId, fromHelper: input.fromHelper })
      .returning({ id: dish.id });
    await tx.insert(dishVote).values({ dishId: created.id, userId });
    const names = input.ingredients.slice(0, MAX_INGREDIENTS);
    if (names.length > 0) await tx.insert(dishIngredient).values(names.map((name) => ({ dishId: created.id, name })));
    return "ok";
  });
}

/** Take an idea down. Whoever put it up can, and so can an admin. An idea whose author moved out is anyone's to remove. */
export async function removeDish(householdId: string, userId: string, dishId: string, isAdmin: boolean) {
  await db.transaction(async (tx) => {
    const found = await lockDinnerOfDish(tx, householdId, dishId);
    if (!found) return;
    if (!isAdmin && found.suggestedBy !== null && found.suggestedBy !== userId) return;
    const ingredients = await tx.select({ id: dishIngredient.id }).from(dishIngredient).where(eq(dishIngredient.dishId, dishId));
    await detachBought(tx, ingredients.map((row) => row.id));
    if (found.dinner.chosenDishId === dishId) await tx.update(dinner).set({ chosenDishId: null }).where(eq(dinner.id, found.dinner.id));
    await tx.delete(dish).where(eq(dish.id, dishId));
  });
}

export async function setVote(householdId: string, userId: string, dishId: string, vote: boolean) {
  await db.transaction(async (tx) => {
    if (!(await lockDinnerOfDish(tx, householdId, dishId))) return;
    if (vote) await tx.insert(dishVote).values({ dishId, userId }).onConflictDoNothing();
    else await tx.delete(dishVote).where(and(eq(dishVote.dishId, dishId), eq(dishVote.userId, userId)));
  });
}

/** Settle on a dish, or open the vote again with `null`. What needs buying moves to the shopping list. */
export async function chooseDish(householdId: string, userId: string, dinnerId: string, dishId: string | null): Promise<"ok" | "gone"> {
  return db.transaction(async (tx) => {
    if (!(await lockDinner(tx, householdId, dinnerId))) return "gone";
    if (dishId) {
      const [found] = await tx.select({ id: dish.id }).from(dish).where(and(eq(dish.id, dishId), eq(dish.dinnerId, dinnerId)));
      if (!found) return "gone";
    }
    await tx.update(dinner).set({ chosenDishId: dishId }).where(eq(dinner.id, dinnerId));
    await syncShopping(tx, householdId, userId, dinnerId);
    return "ok";
  });
}

export async function addIngredient(householdId: string, userId: string, dishId: string, name: string): Promise<"ok" | "full" | "gone"> {
  return db.transaction(async (tx) => {
    const found = await lockDinnerOfDish(tx, householdId, dishId);
    if (!found) return "gone";
    const [existing] = await tx.select({ ingredients: count() }).from(dishIngredient).where(eq(dishIngredient.dishId, dishId));
    if (existing.ingredients >= MAX_INGREDIENTS) return "full";
    await tx.insert(dishIngredient).values({ dishId, name });
    await syncShopping(tx, householdId, userId, found.dinner.id);
    return "ok";
  });
}

/** The dinner an ingredient belongs to, locked, if it is this household's. */
async function lockDinnerOfIngredient(tx: Transaction, householdId: string, ingredientId: string) {
  const [found] = await tx.select({ dishId: dishIngredient.dishId }).from(dishIngredient).where(eq(dishIngredient.id, ingredientId));
  return found ? lockDinnerOfDish(tx, householdId, found.dishId) : null;
}

/** "We have it", or "we need to buy it after all". */
export async function setAtHome(householdId: string, userId: string, ingredientId: string, atHome: boolean) {
  await db.transaction(async (tx) => {
    const found = await lockDinnerOfIngredient(tx, householdId, ingredientId);
    if (!found) return;
    await tx.update(dishIngredient).set({ atHome }).where(eq(dishIngredient.id, ingredientId));
    await syncShopping(tx, householdId, userId, found.dinner.id);
  });
}

/** Make the shopping list match the dinner an ingredient belongs to. For changes made from the list itself. */
export async function resyncIngredient(householdId: string, userId: string, ingredientId: string) {
  await db.transaction(async (tx) => {
    const found = await lockDinnerOfIngredient(tx, householdId, ingredientId);
    if (found) await syncShopping(tx, householdId, userId, found.dinner.id);
  });
}

export async function removeIngredient(householdId: string, ingredientId: string) {
  await db.transaction(async (tx) => {
    if (!(await lockDinnerOfIngredient(tx, householdId, ingredientId))) return;
    await detachBought(tx, [ingredientId]);
    await tx.delete(dishIngredient).where(eq(dishIngredient.id, ingredientId));
  });
}

/**
 * When someone leaves the household, they no longer cook or clean up, and what they
 * said they would buy is open again. Their ideas stay.
 */
export async function releaseDinnerDuties(tx: Transaction, householdId: string, userId: string) {
  await tx
    .update(shoppingItem)
    .set({ claimedBy: null })
    .where(and(eq(shoppingItem.householdId, householdId), eq(shoppingItem.claimedBy, userId), isNull(shoppingItem.boughtAt)));
  await tx.update(dinner).set({ cookId: null }).where(and(eq(dinner.householdId, householdId), eq(dinner.cookId, userId)));
  await tx.update(dinner).set({ cleanerId: null }).where(and(eq(dinner.householdId, householdId), eq(dinner.cleanerId, userId)));
}
