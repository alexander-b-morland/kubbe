import { describe, expect, it } from "vitest";
import { balances, formatAmount, mySettlements, parseAmount, settleUp, sharesFor, splitEvenly } from "./money";

describe("reading an amount", () => {
  it("accepts whole numbers, and a comma or a dot for the decimals", () => {
    expect(parseAmount("349")).toBe(34900);
    expect(parseAmount("349,50")).toBe(34950);
    expect(parseAmount("349.5")).toBe(34950);
    expect(parseAmount(" 1 200 ")).toBe(120000);
  });

  it("refuses what is not an amount", () => {
    for (const bad of ["", "0", "0,00", "-5", "12,345", "abc", "1e5", "12.3.4"]) expect(parseAmount(bad)).toBeNull();
  });
});

describe("writing an amount", () => {
  it("drops the decimals when there are none", () => {
    expect(formatAmount(34900, "kr")).toBe("349 kr");
    expect(formatAmount(34950, "kr")).toBe("349.50 kr");
    expect(formatAmount(5, "kr")).toBe("0.05 kr");
  });

  it("writes the size of a negative amount", () => {
    expect(formatAmount(-12000, "kr")).toBe("120 kr");
  });
});

describe("splitting evenly", () => {
  it("always adds up to the amount", () => {
    for (const amount of [1, 100, 10001, 34950, 99999]) {
      for (const people of [1, 2, 3, 5, 7]) {
        const ids = Array.from({ length: people }, (_, index) => `p${index}`);
        const total = splitEvenly(amount, ids).reduce((sum, share) => sum + share.amount, 0);
        expect(total).toBe(amount);
      }
    }
  });

  it("gives the odd units to the first people", () => {
    expect(splitEvenly(100, ["a", "b", "c"]).map((share) => share.amount)).toEqual([34, 33, 33]);
  });

  it("gives nothing to nobody", () => {
    expect(splitEvenly(100, [])).toEqual([]);
  });
});

describe("who owes whom", () => {
  const groceries = { paidBy: "ida", amount: 30000, shares: splitEvenly(30000, ["ida", "knut", "per"]) };

  it("counts paying for you and your share against you", () => {
    const net = balances([groceries]);
    expect(net.get("ida")).toBe(20000);
    expect(net.get("knut")).toBe(-10000);
    expect(net.get("per")).toBe(-10000);
  });

  it("always sums to zero", () => {
    const net = balances([groceries, { paidBy: "knut", amount: 9901, shares: splitEvenly(9901, ["ida", "knut"]) }]);
    expect([...net.values()].reduce((sum, amount) => sum + amount, 0)).toBe(0);
  });

  it("suggests the payments that make everyone square", () => {
    expect(settleUp(balances([groceries]))).toEqual([
      { from: "knut", to: "ida", amount: 10000 },
      { from: "per", to: "ida", amount: 10000 },
    ]);
  });

  it("is square again once someone has paid back", () => {
    const paidBack = { paidBy: "knut", amount: 10000, shares: [{ userId: "ida", amount: 10000 }] };
    expect(settleUp(balances([groceries, paidBack]))).toEqual([{ from: "per", to: "ida", amount: 10000 }]);
  });

  it("needs no payments when nobody owes anything", () => {
    expect(settleUp(new Map([["ida", 0], ["knut", 0]]))).toEqual([]);
    expect(settleUp(new Map())).toEqual([]);
  });

  it("uses few payments when several people owe several others", () => {
    const net = new Map([["a", 500], ["b", 300], ["c", -600], ["d", -200]]);
    const transfers = settleUp(net);
    expect(transfers).toEqual([
      { from: "c", to: "a", amount: 500 },
      { from: "c", to: "b", amount: 100 },
      { from: "d", to: "b", amount: 200 },
    ]);
  });
});

describe("sharesFor", () => {
  it("splits evenly between the people ticked", () => {
    expect(sharesFor(100, { kind: "even", userIds: ["a", "b", "c"] })).toEqual([
      { userId: "a", amount: 34 },
      { userId: "b", amount: 33 },
      { userId: "c", amount: 33 },
    ]);
  });

  it("takes an amount each when they add up, leaving out anyone with nothing", () => {
    expect(sharesFor(10000, { kind: "amounts", parts: [{ userId: "a", amount: 7000 }, { userId: "b", amount: 3000 }, { userId: "c", amount: 0 }] })).toEqual([
      { userId: "a", amount: 7000 },
      { userId: "b", amount: 3000 },
    ]);
  });

  it("refuses parts that do not add up, and a cost nobody shares", () => {
    expect(sharesFor(10000, { kind: "amounts", parts: [{ userId: "a", amount: 7000 }] })).toBe("mismatch");
    expect(sharesFor(10000, { kind: "amounts", parts: [] })).toBe("empty");
    expect(sharesFor(10000, { kind: "even", userIds: [] })).toBe("empty");
  });
});

describe("mySettlements", () => {
  it("separates what you owe from what you are owed", () => {
    const transfers = [
      { from: "me", to: "ida", amount: 50 },
      { from: "knut", to: "me", amount: 20 },
      { from: "knut", to: "ida", amount: 10 },
    ];
    expect(mySettlements(transfers, "me")).toEqual({ owe: [transfers[0]], owed: [transfers[1]] });
  });
});
