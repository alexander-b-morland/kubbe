"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Refusal } from "@/lib/booking/rules";
import { bookSlot, cancelBooking, findResourceById } from "@/lib/booking/service";
import { requireHousehold } from "@/lib/session";

export type BookingActionResult = { error?: string };

const refusalMessage: Record<Refusal | "not-found", string> = {
  taken: "Someone just took that slot. Pick another one.",
  "back-to-back": "That's straight before or after a slot you have. Leave a gap so others get a turn.",
  "daily-limit": "You've used all your slots for that day. Cancel one to take this.",
  over: "That slot is over. Pick a later one.",
  "too-far-ahead": "That day isn't open for booking yet. Pick an earlier day.",
  "not-a-slot": "The slot times just changed. Pick from the updated list.",
  "not-found": "That can't be booked any more. An admin may have switched it off.",
};

const resourceIdSchema = z.uuid();
const startsAtSchema = z.iso.datetime();
const bookingIdSchema = z.uuid();

function refresh() {
  revalidatePath("/shower");
  revalidatePath("/laundry");
  revalidatePath("/home");
}

/** Book one slot of a resource. Bind the resource id on the server: `bookResource.bind(null, id)`. */
export async function bookResource(resourceId: string, startsAt: string): Promise<BookingActionResult> {
  // The household comes from the session. The resource is looked up inside it,
  // so an id from another household finds nothing.
  const { user, household } = await requireHousehold();
  const id = resourceIdSchema.safeParse(resourceId);
  const start = startsAtSchema.safeParse(startsAt);
  const found = id.success ? await findResourceById(household.id, id.data) : null;
  if (!found || !start.success) return { error: refusalMessage["not-found"] };

  const result = await bookSlot({
    userId: user.id,
    householdId: household.id,
    timeZone: household.timeZone,
    resource: found,
    startsAt: new Date(start.data),
  });
  refresh();
  return result.ok ? {} : { error: refusalMessage[result.reason] };
}

export async function cancelResourceBooking(bookingId: string): Promise<BookingActionResult> {
  const { user, household } = await requireHousehold();
  const parsed = bookingIdSchema.safeParse(bookingId);
  const result = parsed.success
    ? await cancelBooking({ userId: user.id, householdId: household.id, bookingId: parsed.data })
    : { ok: false };
  refresh();
  return result.ok ? {} : { error: "That slot has ended, so there's nothing to cancel." };
}
