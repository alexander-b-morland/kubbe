import { m } from "@/lib/i18n";

// The colour a roommate shows up with. These are people's colours only: none of them is
// a room colour (fjord, ochre, spruce) or the warning colour (barn), so a dot next to a
// name never reads as a room. Each is dark enough for paper-coloured text on top.
export const MEMBER_COLOURS = [
  "#7D4A78", // plum
  "#2C7A76", // teal
  "#A8502F", // clay
  "#4A4E99", // indigo
  "#6E7332", // olive
  "#B04F6C", // rose
  "#7A5440", // cocoa
  "#55657A", // slate
] as const;

/** What each colour is called, in the same order. Read out by screen readers. */
export const MEMBER_COLOUR_NAMES = [m("Plum"), m("Teal"), m("Clay"), m("Indigo"), m("Olive"), m("Rose"), m("Cocoa"), m("Slate")] as const;

/** The first colour nobody in the household has yet. Repeats once all are taken. */
export function nextMemberColour(taken: readonly string[]): string {
  return MEMBER_COLOURS.find((colour) => !taken.includes(colour)) ?? MEMBER_COLOURS[taken.length % MEMBER_COLOURS.length];
}
