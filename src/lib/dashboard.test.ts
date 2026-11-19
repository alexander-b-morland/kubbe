import { describe, expect, it } from "vitest";
import { buildToDos, type ToDoInput } from "./dashboard";

const nothing: ToDoInput = { me: "me", today: "2026-11-16", turns: [], dinners: [], buying: [], tasks: [], unanswered: [] };
// A dinner the reader has said yes to, with nothing else on it.
const dinner = { id: "d1", day: "2026-11-19", time: 1110, cancelled: false, cookId: null, cleanerId: null, chosenTitle: null, ideas: 0, going: ["me"], notGoing: [], voters: [] };
const whats = (input: Partial<ToDoInput>) => buildToDos({ ...nothing, ...input }).map((item) => item.what);

describe("buildToDos", () => {
  it("is empty when nothing has your name on", () => {
    expect(buildToDos(nothing)).toEqual([]);
    expect(whats({ dinners: [dinner] })).toEqual([]);
  });

  it("lists a cleaning turn with how long is left", () => {
    const [turn] = buildToDos({ ...nothing, turns: [{ id: "a", name: "Kitchen", lastDay: "2026-11-18" }] });
    expect(turn).toMatchObject({ what: "Kitchen", detail: "Your turn. 2 days left.", href: "/cleaning", area: "cleaning" });
  });

  it("asks whether you are in for a dinner you have not answered, with the answer at hand", () => {
    const [ask] = buildToDos({ ...nothing, dinners: [{ ...dinner, going: [], chosenTitle: "Tacos" }] });
    expect(ask).toMatchObject({ what: "Are you in? Dinner Thursday 19 Nov", detail: "18:30, Tacos", ask: { kind: "dinner", id: "d1", title: "dinner (Tacos)" } });
    const [open] = buildToDos({ ...nothing, dinners: [{ ...dinner, going: [], day: "2026-11-17" }] });
    expect(open).toMatchObject({ what: "Are you in? Dinner tomorrow", detail: "18:30, not decided what yet" });
    // Saying no is an answer too.
    expect(whats({ dinners: [{ ...dinner, going: [], notGoing: ["me"] }] })).toEqual([]);
  });

  it("lists cooking and cleaning up for dinners this week", () => {
    const items = buildToDos({ ...nothing, dinners: [{ ...dinner, cookId: "me", cleanerId: "me", chosenTitle: "Tacos" }] });
    expect(items.map((item) => item.what)).toEqual(["Cook Tacos", "Clean up after dinner"]);
    expect(items[0]).toMatchObject({ detail: "Thursday 19 Nov at 18:30", href: "/dinner/d1" });
  });

  it("leaves out dinners that are called off, far away, or someone else's", () => {
    expect(whats({ dinners: [{ ...dinner, cookId: "me", cancelled: true }] })).toEqual([]);
    expect(whats({ dinners: [{ ...dinner, cookId: "me", day: "2026-11-30" }] })).toEqual([]);
    expect(whats({ dinners: [{ ...dinner, cookId: "ida" }] })).toEqual([]);
  });

  it("asks for a vote only from those who are in, while there is something to vote on", () => {
    expect(whats({ dinners: [{ ...dinner, ideas: 2 }] })).toEqual(["Vote on dinner"]);
    expect(whats({ dinners: [{ ...dinner, ideas: 0 }] })).toEqual([]);
    expect(whats({ dinners: [{ ...dinner, ideas: 2, voters: ["me"] }] })).toEqual([]);
    expect(whats({ dinners: [{ ...dinner, ideas: 2, going: [], notGoing: ["me"] }] })).toEqual([]);
    expect(whats({ dinners: [{ ...dinner, ideas: 2, chosenTitle: "Tacos" }] })).toEqual([]);
  });

  it("gathers what you said you would buy into one line", () => {
    expect(whats({ buying: ["Oat milk"] })).toEqual(["Buy Oat milk"]);
    const [many] = buildToDos({ ...nothing, buying: ["Oat milk", "Bread", "Salsa"] });
    expect(many).toMatchObject({ what: "Buy 3 things", detail: "Oat milk, Bread, Salsa", href: "/shopping" });
    expect(buildToDos({ ...nothing, buying: ["Bread"], buyingHref: "/dinner" })[0].href).toBe("/dinner");
  });

  it("shows a few to-dos and counts the rest", () => {
    const tasks = Array.from({ length: 6 }, (_, index) => ({ id: String(index), body: `Task ${index}` }));
    expect(whats({ tasks })).toEqual(["Task 0", "Task 1", "Task 2", "Task 3", "2 more to-dos"]);
  });

  it("lists plans to answer", () => {
    const [item] = buildToDos({ ...nothing, unanswered: [{ id: "h", title: "Film night", when: "19:30 on Monday" }] });
    expect(item).toMatchObject({ what: "Are you in? Film night", href: "/happenings#h", ask: { kind: "happening", id: "h", title: "Film night" } });
  });

  it("asks about the next two dinners and counts the rest", () => {
    const days = ["2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20"];
    const items = buildToDos({ ...nothing, dinners: days.map((day, index) => ({ ...dinner, id: `d${index}`, day, going: [] })) });
    expect(items.map((item) => item.what)).toEqual(["Are you in? Dinner tomorrow", "Are you in? Dinner Wednesday 18 Nov", "2 more dinners to answer"]);
    expect(items[2]).toMatchObject({ href: "/dinner", detail: "From Thursday 19 Nov." });
    expect(items[2].ask).toBeUndefined();
  });

  it("does not ask about a dinner that has been eaten", () => {
    const tonight = { ...dinner, day: "2026-11-16", going: [] };
    expect(whats({ dinners: [tonight], nowMinutes: 1200 })).toEqual([]);
    expect(whats({ dinners: [tonight], nowMinutes: 900 })).toEqual(["Are you in? Dinner today"]);
    // Cleaning up comes after the dinner, so it stays.
    expect(whats({ dinners: [{ ...tonight, going: ["me"], cleanerId: "me" }], nowMinutes: 1200 })).toEqual(["Clean up after dinner"]);
  });

  it("tells the cook what nobody is buying", () => {
    const [cook] = buildToDos({ ...nothing, dinners: [{ ...dinner, cookId: "me", chosenTitle: "Tacos", untaken: 3 }] });
    expect(cook.detail).toBe("Thursday 19 Nov at 18:30. 3 things nobody is buying yet.");
  });

  it("lists who to pay", () => {
    const [pay] = buildToDos({ ...nothing, owe: [{ to: "knut", name: "Knut", amount: "50 kr" }] });
    expect(pay).toMatchObject({ what: "Pay Knut 50 kr", href: "/expenses", area: "expenses" });
  });

  it("puts what is due first at the top", () => {
    const items = buildToDos({
      ...nothing,
      turns: [{ id: "a", name: "Kitchen", lastDay: "2026-11-21" }, { id: "b", name: "Trash", lastDay: "2026-11-16" }],
      dinners: [{ ...dinner, cookId: "me", day: "2026-11-17" }],
      tasks: [{ id: "t", body: "Fix the lamp" }],
      unanswered: [{ id: "h", title: "Film night", when: "19:30 today", day: "2026-11-16" }],
    });
    // Today's invitation and turn, tomorrow's dinner, the undated to-do, then the turn with days left.
    expect(items.map((item) => item.what)).toEqual(["Are you in? Film night", "Trash", "Cook dinner", "Fix the lamp", "Kitchen"]);
  });

  it("gives every line its own key", () => {
    const items = buildToDos({
      ...nothing,
      turns: [{ id: "a", name: "Kitchen", lastDay: "2026-11-16" }, { id: "b", name: "Bathroom", lastDay: "2026-11-16" }],
      dinners: [{ ...dinner, cookId: "me", cleanerId: "me" }, { ...dinner, id: "d2", day: "2026-11-17", ideas: 1 }, { ...dinner, id: "d3", going: [] }],
      buying: ["Bread"],
      tasks: [{ id: "t", body: "Fix the lamp" }],
    });
    expect(new Set(items.map((item) => item.key)).size).toBe(items.length);
  });
});
