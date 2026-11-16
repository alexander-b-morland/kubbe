import { describe, expect, it } from "vitest";
import { instantInZone } from "@/lib/time";
import type { ResourceRules } from "./rules";
import { describeNow, describeWhen } from "./status";

const oslo = "Europe/Oslo";
const shower: ResourceRules = { slotMinutes: 20, opensAt: 360, closesAt: 1380, maxPerDay: 3, allowBackToBack: false, bookAheadDays: 7 };
const day = "2026-11-17";
const at = (clock: string, onDay = day) => {
  const [hours, minutes] = clock.split(":").map(Number);
  return instantInZone(onDay, hours * 60 + minutes, oslo);
};
const booked = (userId: string, name: string, from: string, to: string) => ({ userId, name, startsAt: at(from), endsAt: at(to) });
const now = (clock: string, bookings: ReturnType<typeof booked>[] = []) =>
  describeNow({ rules: shower, bookings, now: at(clock), timeZone: oslo, userId: "ida" });

describe("what a resource is doing right now", () => {
  it("says when it opens, before opening time", () => {
    expect(now("05:00")).toBe("Opens 06:00");
  });

  it("says it is free all day when nothing is booked", () => {
    expect(now("08:00")).toBe("Free all day");
  });

  it("says until when it is free", () => {
    expect(now("08:00", [booked("knut", "Knut", "09:00", "09:20")])).toBe("Free until 09:00");
  });

  it("names who has it, and says Yours when it is you", () => {
    expect(now("09:10", [booked("knut", "Knut", "09:00", "09:20")])).toBe("Knut until 09:20");
    expect(now("09:10", [booked("ida", "Ida", "09:00", "09:20")])).toBe("Yours until 09:20");
  });

  it("is free again the moment a slot ends", () => {
    expect(now("09:20", [booked("knut", "Knut", "09:00", "09:20")])).toBe("Free all day");
  });

  it("is closed once the last slot is over", () => {
    expect(now("23:00")).toBe("Closed for today");
    expect(now("22:50")).toBe("Free all day");
  });
});

describe("when a booking is", () => {
  const reference = at("08:00");
  it("uses today and tomorrow", () => {
    expect(describeWhen(at("19:00"), reference, oslo)).toBe("19:00 today");
    expect(describeWhen(at("07:00", "2026-11-18"), reference, oslo)).toBe("07:00 tomorrow");
  });

  it("names the weekday further out", () => {
    expect(describeWhen(at("07:00", "2026-11-19"), reference, oslo)).toBe("07:00 on Thursday");
  });

  it("gets tomorrow right late in the evening and across a clock change", () => {
    expect(describeWhen(at("07:00", "2026-11-18"), at("23:50"), oslo)).toBe("07:00 tomorrow");
    expect(describeWhen(at("07:00", "2026-10-25"), at("23:50", "2026-10-24"), oslo)).toBe("07:00 tomorrow");
    expect(describeWhen(at("07:00", "2026-03-29"), at("00:10", "2026-03-28"), oslo)).toBe("07:00 tomorrow");
  });
});
