import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-next";

describe("where to go after signing in", () => {
  it("accepts an invite link", () => {
    expect(safeNextPath("/join/ABCD2F", "/home")).toBe("/join/ABCD2F");
    expect(safeNextPath("/join/abcd2f", "/home")).toBe("/join/abcd2f");
  });

  it("falls back for anything else inside the site", () => {
    expect(safeNextPath("/home", "/onboarding")).toBe("/onboarding");
    expect(safeNextPath("/join/ABCD2F/extra", "/home")).toBe("/home");
    expect(safeNextPath("/join/", "/home")).toBe("/home");
  });

  it("refuses every way of pointing at another site", () => {
    for (const attempt of [
      "//evil.com",
      "/\evil.com",
      "/\t/evil.com",
      "https://evil.com",
      "/join/ABCD2F?next=//evil.com",
      "/join/../../evil",
      "/join/ABC%2F%2Fevil.com",
      "javascript:alert(1)",
    ]) {
      expect(safeNextPath(attempt, "/home")).toBe("/home");
    }
  });

  it("refuses things that are not text", () => {
    expect(safeNextPath(undefined, "/home")).toBe("/home");
    expect(safeNextPath(null, "/home")).toBe("/home");
    expect(safeNextPath(["/join/ABCD2F"], "/home")).toBe("/home");
  });
});
