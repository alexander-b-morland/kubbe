import { addDays, describeDay } from "@/lib/time";

// Pure dinner rules: which days get a dinner, how ideas are ranked, how typed
// ingredients are read. Nothing here touches the database.

export const LOOK_AHEAD_DAYS = 14;
export const TITLE_LENGTH = 60;
export const INGREDIENT_LENGTH = 60;
export const MAX_DISHES = 12;
export const MAX_INGREDIENTS = 30;

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

export type DinnerRule = { weekday: number; time: number };

/** 1 is Monday, 7 is Sunday, for a calendar date. */
export function weekdayOf(day: string): number {
  return new Date(`${day}T12:00:00Z`).getUTCDay() || 7;
}

/**
 * The days from `today` on that a fixed dinner day falls on and that have no dinner yet.
 * A day that already has one, even one that was called off, is left alone.
 */
export function missingDinnerDays(
  rules: readonly DinnerRule[],
  existingDays: ReadonlySet<string>,
  today: string,
  lookAhead = LOOK_AHEAD_DAYS,
): { day: string; time: number }[] {
  const timeOn = new Map(rules.map((rule) => [rule.weekday, rule.time]));
  const missing: { day: string; time: number }[] = [];
  for (let offset = 0; offset < lookAhead; offset++) {
    const day = addDays(today, offset);
    const time = timeOn.get(weekdayOf(day));
    if (time !== undefined && !existingDays.has(day)) missing.push({ day, time });
  }
  return missing;
}

/** Minutes after midnight from "18:30", or null when it is not a time. */
export function minutesOf(clock: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(clock);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/**
 * Ingredients as someone types them: one per line, or separated by commas.
 * Blank ones and repeats are dropped, long ones are cut, and the list is capped.
 */
export function parseIngredients(text: string): string[] {
  const seen = new Set<string>();
  const found: string[] = [];
  for (const part of text.split(/[\n,;]+/)) {
    const name = part.replace(/^[\s\-*•]+/, "").replace(/\s+/g, " ").trim().slice(0, INGREDIENT_LENGTH);
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    found.push(name);
    if (found.length === MAX_INGREDIENTS) break;
  }
  return found;
}

/** Most votes first. Ties keep the order the ideas came in. */
export function rankDishes<Dish extends { votes: readonly string[] }>(dishes: readonly Dish[]): Dish[] {
  return dishes
    .map((dish, index) => ({ dish, index }))
    .sort((a, b) => b.dish.votes.length - a.dish.votes.length || a.index - b.index)
    .map(({ dish }) => dish);
}

/** "Mondays", "Mondays and Thursdays", "Mondays, Wednesdays and Fridays". */
export function describeRuleDays(rules: readonly DinnerRule[]): string {
  const names = [...rules].sort((a, b) => a.weekday - b.weekday).map((rule) => `${WEEKDAYS[rule.weekday - 1]}s`);
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** "Today", "Tomorrow", or "Thursday 19 Nov". */
export function describeDinnerDay(day: string, today: string): string {
  if (day === today) return "Today";
  if (day === addDays(today, 1)) return "Tomorrow";
  const { weekday, dayOfMonth, monthShort } = describeDay(day);
  return `${weekday} ${dayOfMonth} ${monthShort}`;
}
