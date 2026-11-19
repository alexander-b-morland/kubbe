import type { Art } from "@/components/illustrations/room-art";
import { m } from "@/lib/i18n";

// The parts of the app beyond booking and cleaning. A household can switch each off.

export const EXTRAS = [
  { key: "dinner", name: m("Dinner"), href: "/dinner", art: "dinner", blurb: m("Eat together: who is in, what to cook, who cooks.") },
  { key: "shopping", name: m("Shopping"), href: "/shopping", art: "shopping", blurb: m("One list for what the flat needs.") },
  { key: "expenses", name: m("Expenses"), href: "/expenses", art: "money", blurb: m("Who paid for what, and who owes whom.") },
  { key: "happenings", name: m("Happenings"), href: "/happenings", art: "happening", blurb: m("Things to do together, and who is in.") },
  { key: "board", name: m("Noticeboard"), href: "/board", art: "board", blurb: m("Notes and to-dos for everyone to see.") },
] as const satisfies readonly { key: string; name: string; href: string; art: Art; blurb: string }[];

export type ExtraKey = (typeof EXTRAS)[number]["key"];

export const EXTRA_KEYS = EXTRAS.map((extra) => extra.key) as ExtraKey[];

export function hasExtra(household: { extras: string[] }, key: ExtraKey): boolean {
  return household.extras.includes(key);
}
