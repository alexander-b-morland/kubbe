import { describe, expect, it } from "vitest";
import { assigneeFor, describeDue, describeInterval, periodDays, periodOn, startDayFor } from "./rota";

const weekly = { id: "bathroom", startDay: "2026-11-16", intervalDays: 7 }; // a Monday
const people = ["ida", "knut", "per"];

describe("when a room's rhythm starts", () => {
  it("anchors weekly rooms to the Monday of the week", () => {
    expect(startDayFor("2026-11-16", 7)).toBe("2026-11-16"); // Monday
    expect(startDayFor("2026-11-19", 7)).toBe("2026-11-16"); // Thursday
    expect(startDayFor("2026-11-22", 14)).toBe("2026-11-16"); // Sunday
  });

  it("starts other rhythms on the day itself", () => {
    expect(startDayFor("2026-11-19", 3)).toBe("2026-11-19");
  });
});

describe("periods", () => {
  it("counts whole intervals from the start day", () => {
    expect(periodOn(weekly, "2026-11-16")).toBe(0);
    expect(periodOn(weekly, "2026-11-22")).toBe(0);
    expect(periodOn(weekly, "2026-11-23")).toBe(1);
    expect(periodOn(weekly, "2027-01-04")).toBe(7);
  });

  it("never goes below the first period", () => {
    expect(periodOn(weekly, "2026-11-01")).toBe(0);
  });

  it("knows the first and last day of a period", () => {
    expect(periodDays(weekly, 0)).toEqual({ from: "2026-11-16", to: "2026-11-22" });
    expect(periodDays(weekly, 2)).toEqual({ from: "2026-11-30", to: "2026-12-06" });
    expect(periodDays({ ...weekly, intervalDays: 3 }, 1)).toEqual({ from: "2026-11-19", to: "2026-11-21" });
  });
});

describe("whose turn it is", () => {
  it("goes round in the order people joined", () => {
    const turn = (period: number) => assigneeFor({ period, areaIndex: 0, memberIds: people });
    expect([0, 1, 2, 3, 4].map(turn)).toEqual(["ida", "knut", "per", "ida", "knut"]);
  });

  it("starts each room one person further along", () => {
    const first = (areaIndex: number) => assigneeFor({ period: 0, areaIndex, memberIds: people });
    expect([0, 1, 2, 3].map(first)).toEqual(["ida", "knut", "per", "ida"]);
  });

  it("gives a period to whoever took it over", () => {
    expect(assigneeFor({ period: 0, areaIndex: 0, memberIds: people, takenBy: "per" })).toBe("per");
  });

  it("ignores a takeover by someone who has moved out", () => {
    expect(assigneeFor({ period: 0, areaIndex: 0, memberIds: people, takenBy: "gone" })).toBe("ida");
  });

  it("has nobody when the household is empty", () => {
    expect(assigneeFor({ period: 3, areaIndex: 1, memberIds: [] })).toBeNull();
  });

  it("is always the same person when one person lives alone", () => {
    expect(assigneeFor({ period: 9, areaIndex: 2, memberIds: ["ida"] })).toBe("ida");
  });
});

describe("wording", () => {
  it("describes how often", () => {
    expect(describeInterval(1)).toBe("Every day");
    expect(describeInterval(7)).toBe("Every week");
    expect(describeInterval(14)).toBe("Every 2 weeks");
    expect(describeInterval(3)).toBe("Every 3 days");
  });

  it("describes how long is left", () => {
    expect(describeDue("2026-11-22", "2026-11-22")).toBe("Due today");
    expect(describeDue("2026-11-21", "2026-11-22")).toBe("1 day left");
    expect(describeDue("2026-11-16", "2026-11-22")).toBe("6 days left");
  });
});
