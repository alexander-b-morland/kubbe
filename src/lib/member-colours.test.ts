import { describe, expect, it } from "vitest";
import { MEMBER_COLOURS, nextMemberColour } from "./member-colours";

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
});
