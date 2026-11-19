import { en, m, type Translate } from "@/lib/i18n";

// What a new household starts with. An admin can change all of it later.
const hour = 60;

export const DEFAULT_RESOURCES = [
  { kind: "shower", name: m("Shower"), enabled: true, slotMinutes: 20, opensAt: 6 * hour, closesAt: 23 * hour, maxPerDay: 3 },
  { kind: "washer", name: m("Washing machine"), enabled: true, slotMinutes: 120, opensAt: 7 * hour, closesAt: 23 * hour, maxPerDay: 2 },
  // Not every household has a dryer, so it starts switched off.
  { kind: "dryer", name: m("Dryer"), enabled: false, slotMinutes: 120, opensAt: 7 * hour, closesAt: 23 * hour, maxPerDay: 2 },
] as const;

export function defaultResourcesFor(householdId: string, t: Translate = en) {
  return DEFAULT_RESOURCES.map((defaults) => ({
    ...defaults,
    name: t(defaults.name),
    householdId,
    allowBackToBack: false,
    bookAheadDays: 7,
  }));
}
