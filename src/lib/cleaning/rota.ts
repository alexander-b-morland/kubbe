import { addDays, daysBetween } from "@/lib/time";

// The cleaning rota, as pure functions. Turns are never stored: who cleans what, and when,
// follows from each room's start day and interval and the order people joined in.
// Only the exceptions are stored: a turn that was done, and a turn someone took over.

export type RotaArea = {
  id: string;
  /** The first day of the room's first period, as YYYY-MM-DD in the household's zone. */
  startDay: string;
  intervalDays: number;
};

/** A weekly rhythm should run Monday to Sunday, so anchor those rooms to a Monday. */
export function startDayFor(today: string, intervalDays: number): string {
  if (intervalDays % 7 !== 0) return today;
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay(); // 0 is Sunday
  return addDays(today, -((weekday + 6) % 7));
}

/** Which period of the room a day falls in. Period 0 starts on the start day. */
export function periodOn(area: RotaArea, day: string): number {
  return Math.max(0, Math.floor(daysBetween(area.startDay, day) / area.intervalDays));
}

/** The first and last day of a period. */
export function periodDays(area: RotaArea, period: number): { from: string; to: string } {
  const from = addDays(area.startDay, period * area.intervalDays);
  return { from, to: addDays(from, area.intervalDays - 1) };
}

/**
 * Whose turn a period is. People take turns in the order they joined. Each room starts
 * the rotation one person further along, so one person does not get every room at once.
 * A period somebody took over belongs to them, as long as they still live there.
 */
export function assigneeFor(input: {
  period: number;
  /** The room's place among the household's rooms: 0 for the first, 1 for the second. */
  areaIndex: number;
  /** Member ids, in the order they joined. */
  memberIds: readonly string[];
  /** Who took this period over, if anyone. */
  takenBy?: string;
}): string | null {
  const { period, areaIndex, memberIds, takenBy } = input;
  if (memberIds.length === 0) return null;
  if (takenBy && memberIds.includes(takenBy)) return takenBy;
  return memberIds[(period + areaIndex) % memberIds.length];
}

/** "Every week", "Every 2 weeks", "Every 3 days". */
export function describeInterval(intervalDays: number): string {
  if (intervalDays === 1) return "Every day";
  if (intervalDays === 7) return "Every week";
  if (intervalDays % 7 === 0) return `Every ${intervalDays / 7} weeks`;
  return `Every ${intervalDays} days`;
}

/** "Due today", "1 day left", "5 days left". */
export function describeDue(today: string, lastDay: string): string {
  const left = daysBetween(today, lastDay);
  if (left <= 0) return "Due today";
  return left === 1 ? "1 day left" : `${left} days left`;
}
