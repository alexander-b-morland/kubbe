import type { Metadata } from "next";
import { BookingScreen } from "@/components/booking/booking-screen";
import { NothingToBook } from "@/components/booking/nothing-to-book";
import { findResource } from "@/lib/booking/service";
import { requireHousehold } from "@/lib/session";

// This screen depends on who is signed in, so it is rendered per request.
export const instant = false;

export const metadata: Metadata = { title: "Shower" };

export default async function ShowerPage({ searchParams }: PageProps<"/shower">) {
  const { user, household } = await requireHousehold();
  const shower = await findResource(household.id, "shower");
  if (!shower) return <NothingToBook what="shower" />;

  return (
    <BookingScreen
      basePath="/shower"
      room="shower"
      label={shower.name}
      theme={{ header: "bg-fjord text-paper", mine: "bg-fjord/15", pen: "var(--color-fjord)" }}
      resource={shower}
      household={household}
      userId={user.id}
      requestedDay={(await searchParams).day}
    />
  );
}
