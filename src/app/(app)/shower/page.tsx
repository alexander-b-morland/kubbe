import type { Metadata } from "next";
import { BookingScreen } from "@/components/booking/booking-screen";
import { NothingToBook } from "@/components/booking/nothing-to-book";
import { Switcher, switcherItems } from "@/components/booking/switcher";
import { listEnabled } from "@/lib/booking/service";
import { requireHousehold } from "@/lib/session";

// This screen depends on who is signed in, so it is rendered per request.
export const instant = false;

export const metadata: Metadata = { title: "Shower" };

export default async function ShowerPage({ searchParams }: PageProps<"/shower">) {
  const { user, household, membership } = await requireHousehold();
  const params = await searchParams;
  const showers = await listEnabled(household.id, ["shower"]);
  if (showers.length === 0) return <NothingToBook what="shower" />;

  // A household can have several. The first is shown unless another is asked for.
  const active = showers.find((shower) => shower.id === params.shower) ?? showers[0];
  const day = typeof params.day === "string" ? params.day : undefined;

  return (
    <BookingScreen
      basePath="/shower"
      query={active === showers[0] ? {} : { shower: active.id }}
      room="shower"
      label={active.name}
      theme={{ mine: "bg-fjord/25", pen: "var(--color-fjord)" }}
      manageHref={membership.role === "admin" ? `/settings/rules?from=shower&open=${active.id}#${active.id}` : undefined}
      resource={active}
      household={household}
      userId={user.id}
      requestedDay={params.day}
      headerExtra={
        <Switcher
          label="Which shower"
          tone="on-dark"
          items={switcherItems({ basePath: "/shower", param: "shower", all: showers, active, day })}
        />
      }
    />
  );
}
