import { describe, expect, it } from "vitest";
import { buildToDos, type ToDoInput } from "./dashboard";

const nothing: ToDoInput = { me: "me", today: "2026-11-16", turns: [], dinners: [], buying: [], tasks: [], unanswered: [], owes: [] };
const dinner = { id: "d1", day: "2026-11-19", time: 1110, cancelled: false, cookId: null, cleanerId: null, chosenTitle: null, ideas: 0, absent: [], voters: [] };
const whats = (input: Partial<ToDoInput>) => buildToDos({ ...nothing, ...input }).map((item) => item.what);

describe("buildToDos", () => {
  it("is empty when nothing has your name on", () => {
    expect(buildToDos(nothing)).toEqual([]);
  });

  it("lists a cleaning turn with how long is left", () => {
    const [turn] = buildToDos({ ...nothing, turns: [{ id: "a", name: "Kitchen", lastDay: "2026-11-18" }] });
    expect(turn).toMatchObject({ what: "Kitchen", detail: "Your turn. 2 days left.", href: "/cleaning", art: "cleaning" });
  });

  it("lists cooking and cleaning up for dinners this week", () => {
    const items = buildToDos({ ...nothing, dinners: [{ ...dinner, cookId: "me", cleanerId: "me", chosenTitle: "Tacos" }] });
    expect(items.map((item) => item.what)).toEqual(["Cook Tacos", "Clean up after dinner"]);
    expect(items[0]).toMatchObject({ detail: "Thursday 19 Nov at 18:30", href: "/dinner/d1" });
  });

  it("leaves out dinners that are called off, far away, or someone else's", () => {
    expect(whats({ dinners: [{ ...dinner, cookId: "me", cancelled: true }] })).toEqual([]);
    expect(whats({ dinners: [{ ...dinner, cookId: "me", day: "2026-11-23" }] })).toEqual([]);
    expect(whats({ dinners: [{ ...dinner, cookId: "ida" }] })).toEqual([]);
  });

  it("asks for a vote only while there is something to vote on", () => {
    expect(whats({ dinners: [{ ...dinner, ideas: 2 }] })).toEqual(["Vote on dinner"]);
    expect(whats({ dinners: [{ ...dinner, ideas: 0 }] })).toEqual([]);
    expect(whats({ dinners: [{ ...dinner, ideas: 2, voters: ["me"] }] })).toEqual([]);
    expect(whats({ dinners: [{ ...dinner, ideas: 2, absent: ["me"] }] })).toEqual([]);
    expect(whats({ dinners: [{ ...dinner, ideas: 2, chosenTitle: "Tacos" }] })).toEqual([]);
  });

  it("gathers what you said you would buy into one line", () => {
    expect(whats({ buying: ["Oat milk"] })).toEqual(["Buy Oat milk"]);
    const [many] = buildToDos({ ...nothing, buying: ["Oat milk", "Bread", "Salsa"] });
    expect(many).toMatchObject({ what: "Buy 3 things", detail: "Oat milk, Bread, Salsa", href: "/shopping" });
  });

  it("shows a few to-dos and counts the rest", () => {
    const tasks = Array.from({ length: 6 }, (_, index) => ({ id: String(index), body: `Task ${index}` }));
    expect(whats({ tasks })).toEqual(["Task 0", "Task 1", "Task 2", "Task 3", "2 more to-dos"]);
  });

  it("lists plans to answer and money to pay", () => {
    const items = buildToDos({
      ...nothing,
      unanswered: [{ id: "h", title: "Film night", when: "19:30 on Monday" }],
      owes: [{ to: "Knut", amount: "50 kr" }],
    });
    expect(items.map((item) => [item.what, item.href])).toEqual([
      ["Are you in? Film night", "/happenings"],
      ["Pay Knut 50 kr", "/expenses"],
    ]);
  });

  it("gives every line its own key", () => {
    const items = buildToDos({
      ...nothing,
      turns: [{ id: "a", name: "Kitchen", lastDay: "2026-11-16" }, { id: "b", name: "Bathroom", lastDay: "2026-11-16" }],
      dinners: [{ ...dinner, cookId: "me", cleanerId: "me" }, { ...dinner, id: "d2", day: "2026-11-17", ideas: 1 }],
      buying: ["Bread"],
      tasks: [{ id: "t", body: "Fix the lamp" }],
    });
    expect(new Set(items.map((item) => item.key)).size).toBe(items.length);
  });
});
