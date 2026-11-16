import { describe, expect, it } from "vitest";
import { MEMBER_COLOUR_NAMES, MEMBER_COLOURS, nextMemberColour } from "./member-colours";

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5]
    .map((index) => parseInt(hex.slice(index, index + 2), 16) / 255)
    .map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
};

describe("member colours", () => {
  it("gives the first person the first colour", () => {
    expect(nextMemberColour([])).toBe(MEMBER_COLOURS[0]);
  });

  it("skips colours that are taken", () => {
    expect(nextMemberColour([MEMBER_COLOURS[0], MEMBER_COLOURS[1]])).toBe(MEMBER_COLOURS[2]);
    expect(nextMemberColour([MEMBER_COLOURS[1]])).toBe(MEMBER_COLOURS[0]);
  });

  it("starts again when every colour is taken", () => {
    expect(MEMBER_COLOURS).toContain(nextMemberColour([...MEMBER_COLOURS]));
  });

  it("has a name for every colour", () => {
    expect(MEMBER_COLOUR_NAMES).toHaveLength(MEMBER_COLOURS.length);
  });

  it("is readable with paper-coloured initials on top, and as a dot on paper", () => {
    for (const colour of MEMBER_COLOURS) expect(contrast(colour, "#F5F4EF")).toBeGreaterThanOrEqual(4.5);
  });

  it("never reuses a room colour or the warning colour", () => {
    for (const room of ["#2E5270", "#D2A24C", "#476B52", "#A6402F"]) expect(MEMBER_COLOURS).not.toContain(room);
  });
});
