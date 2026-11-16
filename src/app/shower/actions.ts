"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Refusal } from "@/lib/booking/rules";
import { bookSlot, cancelBooking, findResource } from "@/lib/booking/service";
import { requireHousehold } from "@/lib/session";

const refusalMessage: Record<Refusal | "not-found", string> = {
  taken: "Someone just took that slot. Pick another one.",
  "back-to-back": "That's right next to a slot you already have. Leave a gap so others get a turn.",
  "daily-limit": "You've used all your slots for that day.",
  over: "That slot is over.",
  "too-far-ahead": "That day isn't open for booking yet.",
  "not-a-slot": "That slot no longer exists. Reload and pick again.",
  "not-found": "The shower isn't available. Reload and try again.",
};

const startsAtSchema = z.iso.datetime();
const bookingIdSchema = z.uuid();

export async function bookShower(startsAt: string): Promise<{ error?: string }> {
  // The household comes from the session. Nothing from the client says whose shower this is.
  const { user, household } = await requireHousehold();
  const shower = await findResource(household.id, "shower");
  const parsed = startsAtSchema.safeParse(startsAt);
  if (!shower || !parsed.success) return { error: refusalMessage["not-found"] };

  const result = await bookSlot({
    userId: user.id,
    householdId: household.id,
    timeZone: household.timeZone,
    resource: shower,
    startsAt: new Date(parsed.data),
  });
  revalidatePath("/shower");
  return result.ok ? {} : { error: refusalMessage[result.reason] };
}

export async function cancelShower(bookingId: string): Promise<{ error?: string }> {
  const { user, household } = await requireHousehold();
  const parsed = bookingIdSchema.safeParse(bookingId);
  const result = parsed.success
    ? await cancelBooking({ userId: user.id, householdId: household.id, bookingId: parsed.data })
    : { ok: false };
  revalidatePath("/shower");
  return result.ok ? {} : { error: "That booking can't be cancelled any more." };
}
