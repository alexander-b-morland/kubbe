import { describe, expect, it } from "vitest";
import { buildCalendar, isMonth, monthSheet, pickDay, shiftMonth, type CalendarInput } from "./calendar";

const nameOf = (id: string) => ({ ida: "Ida", knut: "Knut" })[id] ?? "Someone";
const empty: CalendarInput = { me: "ida", nameOf, bookings: [], dinners: [], happenings: [], turns: [] };

describe("buildCalendar", () => {
  it("puts a day in order, with what takes the whole day last", () => {
    const items = buildCalendar({
      ...empty,
      bookings: [{ id: "b", userId: "knut", kind: "washer", name: "Washing machine", day: "2026-11-19", from: 600, to: 720 }],
      dinners: [{ id: "d", day: "2026-11-19", time: 1110, cancelled: false, cookId: "knut", chosenTitle: "Tacos", going: ["knut"], notGoing: [] }],
      turns: [{ areaId: "a", name: "Kitchen", day: "2026-11-19", assigneeId: "ida", done: false }],
    });
    expect(items.map((item) => item.title)).toEqual(["Washing machine", "Dinner: Tacos", "Kitchen"]);
    expect(items[0]).toMatchObject({ area: "laundry", detail: "Knut, until 12:00", href: "/laundry?day=2026-11-19", mine: false });
    expect(items[2]).toMatchObject({ area: "cleaning", detail: "Your turn", mine: true, time: null });
  });

  it("asks for an answer only where none was given", () => {
    const dinner = { id: "d", day: "2026-11-19", time: 1110, cancelled: false, cookId: null, chosenTitle: null, going: [] as string[], notGoing: [] as string[] };
    expect(buildCalendar({ ...empty, dinners: [dinner] })[0].ask).toEqual({ kind: "dinner", id: "d" });
    expect(buildCalendar({ ...empty, dinners: [{ ...dinner, going: ["ida"] }] })[0].ask).toBeUndefined();
    expect(buildCalendar({ ...empty, dinners: [{ ...dinner, notGoing: ["ida"] }] })[0].ask).toBeUndefined();
    const happening = { id: "h", title: "Film night", day: "2026-11-20", time: 1170, place: "Our living room", going: ["knut"], notGoing: [] as string[] };
    expect(buildCalendar({ ...empty, happenings: [happening] })[0]).toMatchObject({ ask: { kind: "happening", id: "h" }, people: ["knut"], mine: false });
  });

  it("shows a fixed dinner day that is too far off to answer", () => {
    const [item] = buildCalendar({ ...empty, fixedDinners: [{ day: "2026-12-10", time: 1080 }] });
    expect(item).toMatchObject({ title: "Dinner", area: "dinner", href: "/dinner", day: "2026-12-10", time: 1080, mine: false });
    expect(item.ask).toBeUndefined();
  });

  it("says what the reader answered", () => {
    const happening = { id: "h", title: "Film night", day: "2026-11-20", time: 1170, place: "", going: [] as string[], notGoing: ["ida"] };
    expect(buildCalendar({ ...empty, happenings: [happening] })[0]).toMatchObject({ answer: { kind: "happening", id: "h", going: false }, href: "/happenings#h" });
    expect(buildCalendar({ ...empty, happenings: [{ ...happening, going: ["ida"], notGoing: [] }] })[0].answer).toMatchObject({ going: true });
    expect(buildCalendar({ ...empty, happenings: [{ ...happening, notGoing: [] }] })[0].answer).toBeUndefined();
  });

  it("leaves out a dinner that was called off", () => {
    const dinner = { id: "d", day: "2026-11-19", time: 1110, cancelled: true, cookId: null, chosenTitle: null, going: [], notGoing: [] };
    expect(buildCalendar({ ...empty, dinners: [dinner] })).toEqual([]);
  });

  it("says whose booking and whose turn it is", () => {
    const items = buildCalendar({
      ...empty,
      bookings: [{ id: "b", userId: "ida", kind: "shower", name: "Shower", day: "2026-11-18", from: 420, to: 440 }],
      turns: [{ areaId: "a", name: "Bathroom", day: "2026-11-18", assigneeId: "knut", done: true }],
    });
    expect(items[0]).toMatchObject({ detail: "You, until 07:20", mine: true, area: "shower" });
    expect(items[1]).toMatchObject({ detail: "Done", done: true, people: ["knut"] });
  });
});

describe("months", () => {
  it("lays a month out in whole weeks from Monday", () => {
    const sheet = monthSheet("2026-11");
    expect(sheet[0][0]).toBe("2026-10-26");
    expect(sheet[0][6]).toBe("2026-11-01");
    expect(sheet[sheet.length - 1][6]).toBe("2026-12-06");
    expect(sheet.every((week) => week.length === 7)).toBe(true);
    // A month that starts on a Monday starts its sheet on the 1st.
    expect(monthSheet("2027-02")[0][0]).toBe("2027-02-01");
    expect(monthSheet("2027-02")).toHaveLength(4);
  });

  it("moves between months and across years", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });

  it("only takes a month written as one", () => {
    expect(isMonth("2026-11")).toBe(true);
    expect(isMonth("2026-13")).toBe(false);
    expect(isMonth("november")).toBe(false);
    expect(isMonth(undefined)).toBe(false);
  });

  it("picks the day to open a month on", () => {
    expect(pickDay("2026-11", "2026-11-20", "2026-11-18")).toBe("2026-11-20");
    expect(pickDay("2026-11", "2026-12-20", "2026-11-18")).toBe("2026-11-18");
    expect(pickDay("2026-12", undefined, "2026-11-18")).toBe("2026-12-01");
    expect(pickDay("2026-11", "nonsense", "2026-11-18")).toBe("2026-11-18");
  });
});
