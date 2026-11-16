import type { Art } from "@/components/illustrations/room-art";

// The parts of the app beyond booking and cleaning. A household can switch each off.

export const EXTRAS = [
  { key: "dinner", name: "Dinner", href: "/dinner", art: "dinner", blurb: "Eat together: who is in, what to cook, who cooks." },
  { key: "shopping", name: "Shopping", href: "/shopping", art: "shopping", blurb: "One list for what the flat needs." },
  { key: "expenses", name: "Expenses", href: "/expenses", art: "money", blurb: "Who paid for what, and who owes whom." },
  { key: "happenings", name: "Happenings", href: "/happenings", art: "happening", blurb: "Things to do together, and who is in." },
  { key: "board", name: "Noticeboard", href: "/board", art: "board", blurb: "Notes and to-dos for everyone to see." },
] as const satisfies readonly { key: string; name: string; href: string; art: Art; blurb: string }[];

export type ExtraKey = (typeof EXTRAS)[number]["key"];

export const EXTRA_KEYS = EXTRAS.map((extra) => extra.key) as ExtraKey[];

export function hasExtra(household: { extras: string[] }, key: ExtraKey): boolean {
  return household.extras.includes(key);
}
