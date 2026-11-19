"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { DishIdea } from "@/lib/dinner/cookbook";
import { suggestDishes, suggestNeeds } from "@/lib/dinner/ideas";
import { getLocale } from "@/lib/i18n/server";
import { INGREDIENT_LENGTH, MAX_DISHES, MAX_INGREDIENTS, minutesOf, parseIngredients, TITLE_LENGTH } from "@/lib/dinner/plan";
import {
  addDinner,
  addDish,
  addIngredients,
  avoidsOfThoseComing,
  chooseDish,
  getDinner,
  recentDishTitles,
  removeDish,
  removeIngredient,
  saveRules,
  setGoing,
  setAtHome,
  setCancelled,
  setDuty,
  setVote,
} from "@/lib/dinner/service";
import { requireExtra } from "@/lib/extras-guard";
import type { FormState } from "@/lib/form-state";
import { allowAttempt } from "@/lib/rate-limit";
import { setBought, setClaim } from "@/lib/shopping";
import { addDays, dayInZone, daysBetween, isDay } from "@/lib/time";

export type DinnerState = (FormState & { saved?: boolean }) | undefined;

const idSchema = z.uuid();
const isId = (value: unknown): value is string => idSchema.safeParse(value).success;

function refresh() {
  revalidatePath("/dinner", "layout");
  revalidatePath("/shopping");
  revalidatePath("/home");
}

/** The fixed dinner days. Admins set them. */
export async function saveRulesAction(_previous: DinnerState, form: FormData): Promise<DinnerState> {
  const { household, membership } = await requireExtra("dinner");
  if (membership.role !== "admin") return { error: "Only an admin can set the fixed dinner days." };
  const time = minutesOf(String(form.get("time") ?? ""));
  if (time === null) return { error: "Pick a time for dinner." };
  const weekdays = [...new Set(form.getAll("weekday").map(Number))].filter((weekday) => Number.isInteger(weekday) && weekday >= 1 && weekday <= 7);
  await saveRules(
    household.id,
    weekdays.map((weekday) => ({ weekday, time })),
    dayInZone(new Date(), household.timeZone),
  );
  refresh();
  return { saved: true };
}

/** Plan a dinner on one day, then go to it. */
export async function addDinnerAction(_previous: DinnerState, form: FormData): Promise<DinnerState> {
  const { user, household } = await requireExtra("dinner");
  const values = { day: String(form.get("day") ?? ""), time: String(form.get("time") ?? "") };
  const time = minutesOf(values.time);
  if (!isDay(values.day)) return { error: "Pick a day.", values };
  if (time === null) return { error: "Pick a time.", values };
  const today = dayInZone(new Date(), household.timeZone);
  const ahead = daysBetween(today, values.day);
  if (ahead < 0) return { error: "That day has passed. Pick today or later.", values };
  if (ahead > 90) return { error: `Pick a day before ${addDays(today, 91)}.`, values };

  const result = await addDinner(household.id, user.id, values.day, time, form.get("in") === "on");
  if (result === "taken") return { error: "There is already a dinner that day. Open it from the list above.", values };
  refresh();
  redirect(`/dinner/${result.id}`);
}

export async function cancelDinnerAction(dinnerId: string, cancelled: boolean): Promise<DinnerState> {
  const { user, household } = await requireExtra("dinner");
  if (isId(dinnerId)) await setCancelled(household.id, user.id, dinnerId, cancelled === true);
  refresh();
  return { saved: true };
}

export async function goingAction(dinnerId: string, going: boolean): Promise<DinnerState> {
  const { user, household } = await requireExtra("dinner");
  if (isId(dinnerId)) await setGoing(household.id, user.id, dinnerId, going === true);
  refresh();
  return { saved: true };
}

export async function dutyAction(dinnerId: string, duty: "cook" | "cleaner", take: boolean): Promise<DinnerState> {
  const { user, household } = await requireExtra("dinner");
  if (!isId(dinnerId) || (duty !== "cook" && duty !== "cleaner")) return { error: "That dinner is gone." };
  const result = await setDuty(household.id, user.id, dinnerId, duty, take === true);
  refresh();
  if (result === "taken") return { error: "Someone else just took that." };
  return result === "gone" ? { error: "That dinner is gone." } : { saved: true };
}

function dishProblem(title: string, ingredients: readonly string[]): string | null {
  if (!title) return "Name the dish.";
  if (title.length > TITLE_LENGTH) return `Keep the name under ${TITLE_LENGTH} characters.`;
  if (ingredients.length > MAX_INGREDIENTS) return `Keep it to ${MAX_INGREDIENTS} ingredients.`;
  return null;
}

async function putUp(dinnerId: string, title: string, ingredients: readonly string[], fromHelper: boolean): Promise<string | null> {
  const { user, household } = await requireExtra("dinner");
  const result = await addDish(household.id, user.id, dinnerId, { title, ingredients, fromHelper });
  if (result === "full") return `A dinner holds ${MAX_DISHES} ideas. Take one down first.`;
  if (result === "gone") return "That dinner is gone.";
  refresh();
  return null;
}

/** Suggest a dish, with what it needs. */
export async function addDishAction(dinnerId: string, _previous: DinnerState, form: FormData): Promise<DinnerState> {
  const values = { title: String(form.get("title") ?? "").trim(), ingredients: String(form.get("ingredients") ?? "") };
  if (!isId(dinnerId)) return { error: "That dinner is gone." };
  if (values.ingredients.length > 2000) return { error: "That is a long list. Keep it to the main ingredients.", values };
  const ingredients = parseIngredients(values.ingredients);
  const problem = dishProblem(values.title, ingredients) ?? (await putUp(dinnerId, values.title, ingredients, false));
  return problem ? { error: problem, values } : { saved: true };
}

/** Put one of the suggested ideas to the vote. It arrives from the browser, so it is checked like anything typed. */
export async function addIdeaAction(dinnerId: string, title: string, ingredients: string[]): Promise<DinnerState> {
  if (!isId(dinnerId) || typeof title !== "string" || !Array.isArray(ingredients) || ingredients.length > MAX_INGREDIENTS) {
    return { error: "That idea could not be added. Type it in instead." };
  }
  const clean = parseIngredients(ingredients.filter((name) => typeof name === "string").map((name) => name.slice(0, INGREDIENT_LENGTH)).join("\n"));
  const name = title.trim();
  const problem = dishProblem(name, clean) ?? (await putUp(dinnerId, name, clean, true));
  return problem ? { error: problem } : { saved: true };
}

export type IdeasState = { ideas?: DishIdea[]; source?: "claude" | "cookbook"; error?: string } | undefined;

/** A few dishes that fit who is coming. From Claude when a key is set, otherwise from the cookbook. */
export async function ideasAction(dinnerId: string): Promise<IdeasState> {
  const { user, household } = await requireExtra("dinner");
  if (!isId(dinnerId)) return { error: "That dinner is gone." };
  // Each answer costs money, so asking is capped per person, per household and for the whole app.
  const allowed =
    (await allowAttempt(`dinner-ideas:user:${user.id}`, 20, 86_400)) &&
    (await allowAttempt(`dinner-ideas:${household.id}`, 40, 86_400)) &&
    (await allowAttempt("dinner-ideas:everyone", 300, 86_400));
  if (!allowed) return { error: "That is a lot of ideas for one day. Try again tomorrow, or type one in." };
  const found = await getDinner(household.id, dinnerId);
  if (!found) return { error: "That dinner is gone." };
  const [coming, recent] = await Promise.all([
    // The person asking counts too, whether or not they have said they are in yet.
    avoidsOfThoseComing(household.id, [...found.going, user.id]),
    recentDishTitles(household.id, dayInZone(new Date(), household.timeZone)),
  ]);
  const { ideas, source } = await suggestDishes({
    people: Math.max(coming.people, 1),
    avoids: coming.avoids,
    recent,
    already: found.dishes.map((dish) => dish.title),
    language: await getLocale(),
  });
  if (ideas.length === 0) return { error: "No ideas this time. Type one in instead." };
  return { ideas, source };
}

export type NeedsState = { ingredients?: string[]; source?: "claude" | "cookbook" } | undefined;

/**
 * What a dish needs, for the name being typed in the "Suggest a dish" form. Nothing is
 * stored: the answer fills the form, and the person decides whether to use it.
 */
export async function needsAction(dinnerId: string, title: string): Promise<NeedsState> {
  const { user, household } = await requireExtra("dinner");
  if (!isId(dinnerId) || typeof title !== "string" || title.trim().length < 3 || title.length > TITLE_LENGTH) return undefined;
  const allowed =
    (await allowAttempt(`dinner-needs:user:${user.id}`, 60, 86_400)) &&
    (await allowAttempt(`dinner-needs:${household.id}`, 150, 86_400)) &&
    (await allowAttempt("dinner-needs:everyone", 600, 86_400));
  if (!allowed) return undefined;
  const found = await getDinner(household.id, dinnerId);
  if (!found) return undefined;
  const coming = await avoidsOfThoseComing(household.id, [...found.going, user.id]);
  const needs = await suggestNeeds({ title, avoids: coming.avoids, language: await getLocale() });
  return needs ?? undefined;
}

export async function removeDishAction(dishId: string): Promise<DinnerState> {
  const { user, household, membership } = await requireExtra("dinner");
  if (isId(dishId)) await removeDish(household.id, user.id, dishId, membership.role === "admin");
  refresh();
  return { saved: true };
}

export async function voteAction(dishId: string, vote: boolean): Promise<DinnerState> {
  const { user, household } = await requireExtra("dinner");
  if (isId(dishId)) await setVote(household.id, user.id, dishId, vote === true);
  refresh();
  return { saved: true };
}

/** Settle on a dish, or open the vote again with no dish. */
export async function chooseAction(dinnerId: string, dishId: string | null): Promise<DinnerState> {
  const { user, household } = await requireExtra("dinner");
  if (!isId(dinnerId) || (dishId !== null && !isId(dishId))) return { error: "That dish is gone." };
  const result = await chooseDish(household.id, user.id, dinnerId, dishId);
  refresh();
  if (result === "not-in") return { error: "Say you're in first. Whoever is eating decides what is cooked." };
  return result === "gone" ? { error: "That dish is gone." } : { saved: true };
}

export async function addIngredientAction(dishId: string, _previous: DinnerState, form: FormData): Promise<DinnerState> {
  const { user, household } = await requireExtra("dinner");
  const name = String(form.get("name") ?? "");
  // Several at once, separated by commas, the way the suggest form takes them.
  const names = parseIngredients(name);
  if (names.length === 0) return { error: "Write what is needed." };
  if (name.split(/[\n,;]+/).some((part) => part.trim().length > INGREDIENT_LENGTH)) {
    return { error: `Keep each one under ${INGREDIENT_LENGTH} characters.`, values: { name } };
  }
  if (!isId(dishId)) return { error: "That dish is gone." };
  const result = await addIngredients(household.id, user.id, dishId, names);
  if (result === "full") return { error: `A dish holds ${MAX_INGREDIENTS} ingredients.`, values: { name } };
  if (result === "gone") return { error: "That dish is gone." };
  refresh();
  if (result === 0) return { error: names.length === 1 ? `${names[0]} is already listed.` : "Those are already listed.", values: { name } };
  return { saved: true };
}

/** Take an ingredient off a dish, for one that was added by mistake. */
export async function removeIngredientAction(ingredientId: string): Promise<DinnerState> {
  const { household } = await requireExtra("dinner");
  if (isId(ingredientId)) await removeIngredient(household.id, ingredientId);
  refresh();
  return { saved: true };
}

export async function atHomeAction(ingredientId: string, atHome: boolean): Promise<DinnerState> {
  const { user, household } = await requireExtra("dinner");
  if (isId(ingredientId)) await setAtHome(household.id, user.id, ingredientId, atHome === true);
  refresh();
  return { saved: true };
}

/** "I'll buy it" for something a dinner needs. The same claim the shopping list shows. */
export async function claimIngredientAction(itemId: string, claim: boolean): Promise<DinnerState> {
  const { user, household } = await requireExtra("dinner");
  if (isId(itemId)) await setClaim(household.id, user.id, itemId, claim === true);
  refresh();
  return { saved: true };
}

export async function gotIngredientAction(itemId: string, bought: boolean): Promise<DinnerState> {
  const { user, household } = await requireExtra("dinner");
  if (isId(itemId)) await setBought(household.id, user.id, itemId, bought === true);
  refresh();
  return { saved: true };
}
