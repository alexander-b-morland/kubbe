import { describe, expect, it } from "vitest";
import { describeDinnerDay, describeRuleDays, minutesOf, missingDinnerDays, parseIngredients, rankDishes, weekdayOf } from "./plan";

describe("weekdayOf", () => {
  it("counts Monday as 1 and Sunday as 7", () => {
    expect(weekdayOf("2026-11-16")).toBe(1);
    expect(weekdayOf("2026-11-22")).toBe(7);
  });
});

describe("missingDinnerDays", () => {
  const rules = [
    { weekday: 1, time: 1080 },
    { weekday: 4, time: 1110 },
  ];

  it("finds every fixed day in the look-ahead, today included", () => {
    expect(missingDinnerDays(rules, new Set(), "2026-11-16", 14)).toEqual([
      { day: "2026-11-16", time: 1080 },
      { day: "2026-11-19", time: 1110 },
      { day: "2026-11-23", time: 1080 },
      { day: "2026-11-26", time: 1110 },
    ]);
  });

  it("leaves alone a day that already has a dinner, even one called off", () => {
    const days = missingDinnerDays(rules, new Set(["2026-11-19"]), "2026-11-16", 7).map((slot) => slot.day);
    expect(days).toEqual(["2026-11-16"]);
  });

  it("does not make a dinner for today once its time has passed", () => {
    const days = (nowMinutes: number) => missingDinnerDays(rules, new Set(), "2026-11-16", 7, nowMinutes).map((slot) => slot.day);
    expect(days(1079)).toEqual(["2026-11-16", "2026-11-19"]);
    expect(days(1080)).toEqual(["2026-11-19"]);
  });

  it("finds nothing without fixed days", () => {
    expect(missingDinnerDays([], new Set(), "2026-11-16")).toEqual([]);
  });
});

describe("minutesOf", () => {
  it("reads a clock time", () => {
    expect(minutesOf("18:30")).toBe(1110);
    expect(minutesOf("00:00")).toBe(0);
  });
  it("refuses anything else", () => {
    expect(minutesOf("24:00")).toBeNull();
    expect(minutesOf("6:30")).toBeNull();
    expect(minutesOf("")).toBeNull();
  });
});

describe("parseIngredients", () => {
  it("splits on commas and new lines, and tidies", () => {
    expect(parseIngredients("Tortillas,  minced   beef\n- Salsa\n\n")).toEqual(["Tortillas", "minced beef", "Salsa"]);
  });
  it("drops repeats whatever the case", () => {
    expect(parseIngredients("Rice, rice, RICE, Beans")).toEqual(["Rice", "Beans"]);
  });
  it("caps the list and the length of each", () => {
    const many = parseIngredients(Array.from({ length: 50 }, (_, index) => `thing ${index}`).join(","));
    expect(many).toHaveLength(30);
    expect(parseIngredients("x".repeat(200))[0]).toHaveLength(80);
  });
});

describe("rankDishes", () => {
  it("puts most votes first and keeps the order of ties", () => {
    const ranked = rankDishes([
      { title: "a", votes: ["1"] },
      { title: "b", votes: ["1", "2"] },
      { title: "c", votes: ["2"] },
    ]);
    expect(ranked.map((dish) => dish.title)).toEqual(["b", "a", "c"]);
  });
});

describe("wording", () => {
  it("names the fixed days in week order", () => {
    expect(describeRuleDays([{ weekday: 4, time: 0 }, { weekday: 1, time: 0 }])).toBe("Mondays and Thursdays");
    expect(describeRuleDays([{ weekday: 7, time: 0 }])).toBe("Sundays");
    expect(describeRuleDays([1, 3, 5].map((weekday) => ({ weekday, time: 0 })))).toBe("Mondays, Wednesdays and Fridays");
  });
  it("says today and tomorrow, then the date", () => {
    expect(describeDinnerDay("2026-11-16", "2026-11-16")).toBe("Today");
    expect(describeDinnerDay("2026-11-17", "2026-11-16")).toBe("Tomorrow");
    expect(describeDinnerDay("2026-11-19", "2026-11-16")).toBe("Thursday 19 Nov");
  });
});
