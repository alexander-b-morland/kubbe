import { describe, expect, it } from "vitest";
import { formatJoinCode, generateJoinCode, isJoinCode, normaliseJoinCode } from "./join-code";

describe("join codes", () => {
  it("generates six characters from the safe alphabet", () => {
    for (let i = 0; i < 500; i++) {
      const code = generateJoinCode();
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
      expect(isJoinCode(code)).toBe(true);
    }
  });

  it("does not repeat in a small sample", () => {
    const codes = new Set(Array.from({ length: 200 }, generateJoinCode));
    expect(codes.size).toBe(200);
  });

  it("normalises what people type", () => {
    expect(normaliseJoinCode(" abc-d2f ")).toBe("ABCD2F");
    expect(normaliseJoinCode("abc d2f")).toBe("ABCD2F");
  });

  it("rejects wrong lengths and look-alike characters", () => {
    expect(isJoinCode("ABCDE")).toBe(false);
    expect(isJoinCode("ABCDEFG")).toBe(false);
    expect(isJoinCode("ABCD0F")).toBe(false);
    expect(isJoinCode("ABCDIF")).toBe(false);
    expect(isJoinCode("ABCDOF")).toBe(false);
    expect(isJoinCode("ABCD1F")).toBe(false);
  });

  it("formats for reading", () => {
    expect(formatJoinCode("ABCD2F")).toBe("ABC D2F");
  });
});
