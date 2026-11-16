import { describe, expect, it } from "vitest";
import { listNames } from "./names";

const nameOf = (id: string) => ({ a: "Ida", b: "Knut", c: "Mo" })[id] ?? "Someone";

describe("listNames", () => {
  it("puts the reader first and calls them You", () => {
    expect(listNames(["a", "b"], "b", nameOf)).toBe("You and Ida");
    expect(listNames(["a", "b", "c"], "c", nameOf)).toBe("You, Ida and Knut");
  });
  it("handles one and none", () => {
    expect(listNames(["a"], "b", nameOf)).toBe("Ida");
    expect(listNames(["b"], "b", nameOf)).toBe("You");
    expect(listNames([], "b", nameOf)).toBe("");
  });
});
