import { describe, expect, it } from "vitest";
import { clockTime, dayInZone, instantInZone } from "@/lib/time";
import { canCancel, refusalFor, slotsForDay, type ResourceRules, type Slot } from "./rules";

const oslo = "Europe/Oslo";
const shower: ResourceRules = {
  slotMinutes: 20,
  opensAt: 6 * 60,
  closesAt: 23 * 60,
  maxPerDay: 3,
  allowBackToBack: false,
  bookAheadDays: 7,
};

const day = "2026-11-17";
const at = (clock: string, onDay = day) => {
  const [hours, minutes] = clock.split(":").map(Number);
  return instantInZone(onDay, hours * 60 + minutes, oslo);
};
const slot = (clock: string, onDay = day): Slot => ({
  startsAt: at(clock, onDay),
  endsAt: new Date(at(clock, onDay).getTime() + shower.slotMinutes * 60_000),
});
const booked = (userId: string, clock: string) => ({ userId, ...slot(clock) });
const check = (overrides: Partial<Parameters<typeof refusalFor>[0]> = {}) =>
  refusalFor({
    slot: slot("07:00"),
    rules: shower,
    timeZone: oslo,
    now: at("05:00"),
    dayBookings: [],
    userId: "ida",
    ...overrides,
  });

describe("time zones", () => {
  it("places local times correctly in winter and summer", () => {
    expect(instantInZone("2026-11-17", 7 * 60, oslo).toISOString()).toBe("2026-11-17T06:00:00.000Z");
    expect(instantInZone("2026-07-01", 7 * 60, oslo).toISOString()).toBe("2026-07-01T05:00:00.000Z");
  });

  it("knows which day it is in the household's zone", () => {
    // 23:30 UTC is already the next day in Oslo.
    expect(dayInZone(new Date("2026-11-17T23:30:00Z"), oslo)).toBe("2026-11-18");
  });
});

describe("slots for a day", () => {
  it("fills the opening hours with slots of the chosen length", () => {
    const slots = slotsForDay(day, shower, oslo);
    expect(slots).toHaveLength(51);
    expect(clockTime(slots[0].startsAt, oslo)).toBe("06:00");
    expect(clockTime(slots[50].startsAt, oslo)).toBe("22:40");
    expect(clockTime(slots[50].endsAt, oslo)).toBe("23:00");
  });

  it("leaves out a last slot that would run past closing", () => {
    const slots = slotsForDay(day, { ...shower, slotMinutes: 45, opensAt: 360, closesAt: 480 }, oslo);
    expect(slots.map((s) => clockTime(s.startsAt, oslo))).toEqual(["06:00", "06:45"]);
  });

  it("never overlaps slots on the days the clocks change", () => {
    for (const changeDay of ["2026-03-29", "2026-10-25"]) {
      const slots = slotsForDay(changeDay, { ...shower, opensAt: 0, closesAt: 24 * 60 }, oslo);
      for (let i = 1; i < slots.length; i++) {
        expect(slots[i].startsAt.getTime()).toBe(slots[i - 1].endsAt.getTime());
      }
      expect(dayInZone(slots[0].startsAt, oslo)).toBe(changeDay);
    }
  });
});

describe("who may book a slot", () => {
  it("allows a free slot", () => {
    expect(check()).toBeNull();
  });

  it("refuses a time that is not a slot", () => {
    expect(check({ slot: { startsAt: at("07:05"), endsAt: at("07:25") } })).toBe("not-a-slot");
    expect(check({ slot: { startsAt: at("07:00"), endsAt: at("07:40") } })).toBe("not-a-slot");
    expect(check({ slot: slot("05:40") })).toBe("not-a-slot");
  });

  it("refuses a slot that is over, but allows one in progress", () => {
    expect(check({ now: at("07:20") })).toBe("over");
    expect(check({ now: at("07:10") })).toBeNull();
  });

  it("refuses a slot beyond the booking horizon", () => {
    expect(check({ slot: slot("07:00", "2026-11-24"), now: at("05:00") })).toBeNull();
    expect(check({ slot: slot("07:00", "2026-11-25"), now: at("05:00") })).toBe("too-far-ahead");
  });

  it("refuses a slot somebody has", () => {
    expect(check({ dayBookings: [booked("knut", "07:00")] })).toBe("taken");
    expect(check({ dayBookings: [booked("ida", "07:00")] })).toBe("taken");
  });

  it("refuses the slot right before or right after your own", () => {
    expect(check({ dayBookings: [booked("ida", "06:40")] })).toBe("back-to-back");
    expect(check({ dayBookings: [booked("ida", "07:20")] })).toBe("back-to-back");
  });

  it("allows a slot next to someone else's, or with a gap from your own", () => {
    expect(check({ dayBookings: [booked("knut", "06:40"), booked("knut", "07:20")] })).toBeNull();
    expect(check({ dayBookings: [booked("ida", "06:20"), booked("ida", "07:40")] })).toBeNull();
  });

  it("allows back to back when the admin turns that on", () => {
    expect(check({ rules: { ...shower, allowBackToBack: true }, dayBookings: [booked("ida", "06:40")] })).toBeNull();
  });

  it("stops at the daily limit, counting only your own bookings", () => {
    const three = [booked("ida", "09:00"), booked("ida", "12:00"), booked("ida", "18:00")];
    expect(check({ dayBookings: three })).toBe("daily-limit");
    expect(check({ dayBookings: three.map((b) => ({ ...b, userId: "knut" })) })).toBeNull();
    expect(check({ rules: { ...shower, maxPerDay: 4 }, dayBookings: three })).toBeNull();
  });
});

describe("cancelling", () => {
  it("is for the owner, until the slot has ended", () => {
    const mine = booked("ida", "07:00");
    expect(canCancel(mine, "ida", at("07:10"))).toBe(true);
    expect(canCancel(mine, "ida", at("07:20"))).toBe(false);
    expect(canCancel(mine, "knut", at("06:00"))).toBe(false);
  });
});

describe("around midnight", () => {
  const allDay: ResourceRules = { ...shower, opensAt: 0, closesAt: 24 * 60 };
  const nextDay = "2026-11-18";

  it("still refuses two slots in a row", () => {
    const lastOfTheDay = { userId: "ida", startsAt: at("23:40"), endsAt: at("00:00", nextDay) };
    expect(check({ rules: allDay, slot: slot("00:00", nextDay), dayBookings: [lastOfTheDay] })).toBe("back-to-back");
    expect(check({ rules: allDay, slot: slot("00:20", nextDay), dayBookings: [lastOfTheDay] })).toBeNull();
  });

  it("counts the daily limit for the slot's own day only", () => {
    const yesterday = [booked("ida", "09:00"), booked("ida", "12:00"), booked("ida", "18:00")];
    expect(check({ rules: allDay, slot: slot("12:00", nextDay), dayBookings: yesterday })).toBeNull();
    expect(check({ rules: allDay, slot: slot("21:00"), dayBookings: yesterday })).toBe("daily-limit");
  });
});
