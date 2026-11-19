import type { Art } from "@/components/illustrations/room-art";
import { hasExtra, type ExtraKey } from "@/lib/extras";
import { m } from "@/lib/i18n";

// Everything a household does in the app, each with a colour and a drawing of its own.
// Booking and cleaning are always there; the rest can be switched off per household.

export type AreaKey = "shower" | "laundry" | "cleaning" | ExtraKey;

export type Area = {
  key: AreaKey;
  name: string;
  href: string;
  art: Art;
  /** Background and text for a band or tile in the area's colour. */
  band: string;
  /** The colour alone, for a dot in the calendar. */
  dot: string;
  /** A light wash of the colour, for rows and cards inside the area. */
  wash: string;
  /** The focus ring that shows on the band. */
  ring: string;
  /** The colour as CSS variables, for the main buttons inside the area. */
  vars: Record<"--area-bg" | "--area-fg", string>;
};

const paperOn = (colour: string) => ({ "--area-bg": `var(--color-${colour})`, "--area-fg": "var(--color-paper)" });
const inkOn = (colour: string) => ({ "--area-bg": `var(--color-${colour})`, "--area-fg": "var(--color-ink)" });

export const AREAS: readonly Area[] = [
  { key: "shower", name: m("Shower"), href: "/shower", art: "shower", band: "bg-fjord text-paper", dot: "bg-fjord", wash: "bg-fjord/10", ring: "focus-visible:ring-ochre", vars: paperOn("fjord") },
  { key: "laundry", name: m("Laundry"), href: "/laundry", art: "laundry", band: "bg-ochre text-ink", dot: "bg-ochre", wash: "bg-ochre/20", ring: "focus-visible:ring-ink", vars: inkOn("ochre") },
  { key: "cleaning", name: m("Cleaning"), href: "/cleaning", art: "cleaning", band: "bg-spruce text-paper", dot: "bg-spruce", wash: "bg-spruce/10", ring: "focus-visible:ring-ochre", vars: paperOn("spruce") },
  { key: "dinner", name: m("Dinner"), href: "/dinner", art: "dinner", band: "bg-salmon text-ink", dot: "bg-salmon", wash: "bg-salmon/25", ring: "focus-visible:ring-ink", vars: inkOn("salmon") },
  { key: "shopping", name: m("Shopping"), href: "/shopping", art: "shopping", band: "bg-sage text-ink", dot: "bg-sage", wash: "bg-sage/30", ring: "focus-visible:ring-ink", vars: inkOn("sage") },
  { key: "expenses", name: m("Expenses"), href: "/expenses", art: "money", band: "bg-heather text-ink", dot: "bg-heather", wash: "bg-heather/25", ring: "focus-visible:ring-ink", vars: inkOn("heather") },
  { key: "happenings", name: m("Happenings"), href: "/happenings", art: "happening", band: "bg-blush text-ink", dot: "bg-blush", wash: "bg-blush/25", ring: "focus-visible:ring-ink", vars: inkOn("blush") },
  { key: "board", name: m("Noticeboard"), href: "/board", art: "board", band: "bg-sky text-ink", dot: "bg-sky", wash: "bg-sky/30", ring: "focus-visible:ring-ink", vars: inkOn("sky") },
];

const always: readonly AreaKey[] = ["shower", "laundry", "cleaning"];

export function areaOf(key: AreaKey): Area {
  return AREAS.find((area) => area.key === key)!;
}

/** The areas this household uses. */
export function areasFor(household: { extras: string[] }): Area[] {
  return AREAS.filter((area) => always.includes(area.key) || hasExtra(household, area.key as ExtraKey));
}

/** Every area colour as a hex value, for checks that nothing else looks like one. */
export const AREA_COLOURS = ["#2E5270", "#D2A24C", "#476B52", "#D4805C", "#8DB07C", "#A48BC9", "#D97F98", "#78AFCB"] as const;
