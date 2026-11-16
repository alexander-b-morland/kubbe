import { describe, expect, it } from "vitest";
import { COOKBOOK, pickFromCookbook, ruledOut } from "./cookbook";

const first = () => 0;

describe("ruledOut", () => {
  it("reads diets and single foods from free text", () => {
    expect([...ruledOut(["Vegetarian"])].sort()).toEqual(["fish", "meat", "pork"]);
    expect([...ruledOut(["no pork please", "lactose intolerant"])].sort()).toEqual(["dairy", "pork"]);
    expect(ruledOut(["nothing, I eat everything"]).size).toBe(0);
  });
});

describe("pickFromCookbook", () => {
  it("picks the number asked for, all different", () => {
    const picked = pickFromCookbook([], [], 3);
    expect(picked).toHaveLength(3);
    expect(new Set(picked.map((dish) => dish.title)).size).toBe(3);
  });

  it("only picks what everyone can eat", () => {
    const vegan = new Set(COOKBOOK.filter((recipe) => recipe.contains.every((kind) => kind === "gluten" || kind === "nuts")).map((recipe) => recipe.title));
    for (let run = 0; run < 20; run++) {
      for (const dish of pickFromCookbook(["vegan"], [], 3)) expect(vegan.has(dish.title)).toBe(true);
    }
  });

  it("skips what was cooked recently", () => {
    const [dish] = pickFromCookbook([], [COOKBOOK[0].title.toUpperCase()], 1, first);
    expect(dish.title).toBe(COOKBOOK[1].title);
  });

  it("repeats rather than coming back empty", () => {
    const everything = COOKBOOK.map((recipe) => recipe.title);
    expect(pickFromCookbook([], everything, 3)).toHaveLength(3);
  });

  it("has enough for a flat that eats neither meat, fish, dairy, egg nor gluten", () => {
    expect(pickFromCookbook(["vegan", "gluten"], [], 3)).toHaveLength(3);
  });

  it("every recipe is something to shop for", () => {
    for (const recipe of COOKBOOK) {
      expect(recipe.title.length).toBeLessThanOrEqual(60);
      expect(recipe.ingredients.length).toBeGreaterThanOrEqual(4);
    }
  });
});
