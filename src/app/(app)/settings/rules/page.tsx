import type { Metadata } from "next";
import { TabHeader, type Back } from "@/components/area/area-header";
import { RoomArt } from "@/components/illustrations/room-art";
import { ActionButton } from "@/components/ui/action-button";
import { listResources } from "@/lib/booking/service";
import { clockLabel, describeSlotLength } from "@/lib/booking/status";
import { requireHousehold } from "@/lib/session";
import { SLOT_LENGTHS } from "@/lib/settings";
import { addResourceAction, removeResourceAction, updateResourceAction } from "../actions";
import { ResourceForm } from "../settings-forms";

// This screen depends on who is signed in, so it is rendered per request.
export const instant = false;

export const metadata: Metadata = { title: "Booking rules" };

// Where the way back leads. Only these: the value comes from the address bar.
const cameFrom: Record<string, Back> = {
  shower: { href: "/shower", label: "Shower" },
  laundry: { href: "/laundry", label: "Laundry" },
};

const groups = [
  { kind: "shower", title: "Showers", one: "shower", art: "shower", band: "bg-fjord text-paper" },
  { kind: "washer", title: "Washing machines", one: "washing machine", art: "laundry", band: "bg-ochre text-ink" },
  { kind: "dryer", title: "Dryers", one: "dryer", art: "laundry", band: "bg-ochre text-ink" },
] as const;

export default async function RulesPage({ searchParams }: PageProps<"/settings/rules">) {
  const { household, membership } = await requireHousehold();
  const params = await searchParams;
  const resources = await listResources(household.id);
  const admin = membership.role === "admin";
  const back = (typeof params.from === "string" ? cameFrom[params.from] : undefined) ?? { href: "/settings", label: "Household" };
  const open = typeof params.open === "string" ? params.open : undefined;

  return (
    <main className="mx-auto flex w-full max-w-md flex-col lg:max-w-3xl lg:pt-6">
      <TabHeader art="people" name="Booking rules" eyebrow={household.name} back={back}>
        Booking rules
      </TabHeader>

      <div className="flex flex-col gap-8 p-6">
        <p className="text-ink-soft">
          {admin
            ? "Tap a shower or machine to change it. Changes apply to new bookings; slots already booked stay as they are."
            : "Only an admin can change these."}
        </p>

      {groups.map((group) => {
        const mine = resources.filter((resource) => resource.kind === group.kind);
        return (
          <section key={group.kind} aria-labelledby={`${group.kind}-heading`} className="flex flex-col gap-2" data-testid={`group-${group.kind}`}>
            <div className={`flex items-center justify-between gap-3 rounded-2xl px-5 py-3 ${group.band}`}>
              <h2 id={`${group.kind}-heading`} className="type-display text-3xl">
                {group.title}
              </h2>
              <RoomArt room={group.art} className="size-10 shrink-0" />
            </div>
            {admin ? (
              <>
                <div className="flex flex-col">
                  {mine.map((resource) => (
                    <ResourceForm
                      key={resource.id}
                      resource={resource}
                      // The daily limit is one person's across all of a kind, so say so when there are several.
                      shared={mine.filter((other) => other.enabled).length > 1 ? group.title.toLowerCase() : undefined}
                      open={resource.id === open}
                      slotLengths={SLOT_LENGTHS}
                      action={updateResourceAction.bind(null, resource.id)}
                      // The last one of a kind stays: it can be switched off, not removed.
                      remove={mine.length > 1 ? removeResourceAction.bind(null, resource.id) : undefined}
                    />
                  ))}
                </div>
                {/* A second one is only worth adding once the first is in use. */}
                {mine.some((resource) => resource.enabled) ? (
                  <div className="pt-1" data-testid={`add-${group.kind}`}>
                    <ActionButton align="start" doneLabel="Added, with the same rules." action={addResourceAction.bind(null, group.kind)}>
                      + Add another {group.one}
                    </ActionButton>
                  </div>
                ) : null}
              </>
            ) : (
              <ul className="flex flex-col">
                {mine
                  .filter((resource) => resource.enabled)
                  .map((resource) => (
                    <li key={resource.id} className="flex flex-col border-b-2 border-ink/15 py-3">
                      <span className="text-lg font-semibold">{resource.name}</span>
                      <span className="text-ink-soft">
                        {describeSlotLength(resource.slotMinutes)} slots from {clockLabel(resource.opensAt)} to {clockLabel(resource.closesAt)}, up to{" "}
                        {resource.maxPerDay} a day{resource.allowBackToBack ? "" : ", not two in a row"}.
                      </span>
                    </li>
                  ))}
                {mine.every((resource) => !resource.enabled) ? <li className="py-3 text-ink-soft">None in this home.</li> : null}
              </ul>
            )}
          </section>
        );
      })}
      </div>
    </main>
  );
}
