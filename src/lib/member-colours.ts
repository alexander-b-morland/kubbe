// The colour a roommate shows up with. Muted, and told apart at a glance.
export const MEMBER_COLOURS = [
  "#A6402F", // barn red
  "#2E5270", // fjord
  "#D2A24C", // ochre
  "#476B52", // spruce
  "#7A5C8E", // heather
  "#3F7F86", // sea
  "#B5683C", // rust
  "#6B7385", // slate
] as const;

/** The first colour nobody in the household has yet. Repeats once all are taken. */
export function nextMemberColour(taken: readonly string[]): string {
  return MEMBER_COLOURS.find((colour) => !taken.includes(colour)) ?? MEMBER_COLOURS[taken.length % MEMBER_COLOURS.length];
}
