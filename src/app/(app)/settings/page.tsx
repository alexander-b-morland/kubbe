import type { Metadata } from "next";
import { signOut } from "@/app/(auth)/actions";
import { ActionButton } from "@/components/ui/action-button";
import { listResources } from "@/lib/booking/service";
import { clockLabel, describeSlotLength } from "@/lib/booking/status";
import { listMembers } from "@/lib/households";
import { formatJoinCode } from "@/lib/join-code";
import { MEMBER_COLOUR_NAMES, MEMBER_COLOURS } from "@/lib/member-colours";
import { requireHousehold } from "@/lib/session";
import { SLOT_LENGTHS } from "@/lib/settings";
import { ShareCode } from "../home/share-code";
import {
  removeMemberAction,
  renameHouseholdAction,
  replaceJoinCodeAction,
  setRoleAction,
  setTimeZoneAction,
  updateProfileAction,
  updateResourceAction,
} from "./actions";
import { ProfileForm, RenameForm, ResourceForm, TimeZoneForm } from "./settings-forms";

// This screen depends on who is signed in, so it is rendered per request.
export const instant = false;

export const metadata: Metadata = { title: "Household" };

export default async function SettingsPage() {
  const { user, household, membership } = await requireHousehold();
  const [members, resources] = await Promise.all([listMembers(household.id), listResources(household.id)]);
  const admin = membership.role === "admin";
  const alone = members.length === 1;
  // The zones this server knows, plus the household's own in case it is not among them.
  const zones = [...new Set([household.timeZone, ...Intl.supportedValuesOf("timeZone")])].sort();

  return (
    <main className="mx-auto flex max-w-md flex-col gap-10 p-6 pt-10">
      <header className="flex flex-col gap-1">
        <p className="font-semibold text-ink-soft break-words">{household.name}</p>
        <h1 className="type-display text-6xl">Household</h1>
      </header>

      <section aria-labelledby="invite-heading" className="flex flex-col gap-3 rounded-2xl border-2 border-ink p-5">
        <h2 id="invite-heading" className="font-semibold">
          Invite code
        </h2>
        <p className="type-display text-6xl tracking-widest" data-testid="join-code">
          {formatJoinCode(household.joinCode)}
        </p>
        <ShareCode code={household.joinCode} />
        {admin ? (
          <div data-testid="replace-code">
            <ActionButton
              look="link"
              align="start"
              confirm="Replace the code? Old links stop working."
              doneLabel="New code ready."
              action={replaceJoinCodeAction}
            >
              Replace with a new code
            </ActionButton>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="people-heading" className="flex flex-col gap-2">
        <h2 id="people-heading" className="type-display text-4xl">
          People
        </h2>
        <ul className="flex flex-col">
          {members.map((member) => {
            const self = member.userId === user.id;
            return (
              <li key={member.userId} className="flex flex-col gap-2 border-b-2 border-ink/15 py-3" data-testid={`member-${member.name}`}>
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="type-display flex size-10 shrink-0 items-center justify-center rounded-full text-xl text-paper"
                    style={{ backgroundColor: member.colour }}
                  >
                    {member.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 text-lg font-semibold break-words">
                    {member.name}
                    {self ? " (you)" : ""}
                  </span>
                  {member.role === "admin" ? (
                    <span className="ml-auto shrink-0 rounded-full border-2 border-ink px-3 py-0.5 text-sm font-bold">Admin</span>
                  ) : null}
                </div>
                {admin && !self ? (
                  <div className="flex flex-wrap justify-end gap-2">
                    <ActionButton
                      label={member.role === "admin" ? `Remove ${member.name} as admin` : `Make ${member.name} admin`}
                      action={setRoleAction.bind(null, member.userId, member.role === "admin" ? "member" : "admin")}
                    >
                      {member.role === "admin" ? "Remove as admin" : "Make admin"}
                    </ActionButton>
                    <ActionButton
                      label={`Remove ${member.name}`}
                      confirm={`Remove ${member.name} and cancel their bookings?`}
                      action={removeMemberAction.bind(null, member.userId)}
                    >
                      Remove
                    </ActionButton>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
        {admin && !alone ? (
          <p className="text-sm text-ink-soft">Removing someone also replaces the invite code, since they know the old one.</p>
        ) : null}
      </section>

      <section aria-labelledby="rules-heading" className="flex flex-col gap-2">
        <h2 id="rules-heading" className="type-display text-4xl">
          Booking rules
        </h2>
        {admin ? (
          <>
            <p className="text-ink-soft">Changes apply to new bookings. Slots already booked stay as they are.</p>
            <div className="flex flex-col">
              {resources.map((resource) => (
                <ResourceForm
                  key={resource.id}
                  resource={resource}
                  slotLengths={SLOT_LENGTHS}
                  action={updateResourceAction.bind(null, resource.id)}
                />
              ))}
            </div>
          </>
        ) : (
          <>
            <ul className="flex flex-col">
              {resources
                .filter((resource) => resource.enabled)
                .map((resource) => (
                  <li key={resource.id} className="flex flex-col border-b-2 border-ink/15 py-3">
                    <span className="text-lg font-semibold">{resource.name}</span>
                    <span className="text-ink-soft">
                      {describeSlotLength(resource.slotMinutes)} slots from {clockLabel(resource.opensAt)} to{" "}
                      {clockLabel(resource.closesAt)}, up to {resource.maxPerDay} a day
                      {resource.allowBackToBack ? "" : ", not two in a row"}.
                    </span>
                  </li>
                ))}
            </ul>
            <p className="text-sm text-ink-soft">Only an admin can change these.</p>
          </>
        )}
      </section>

      <section aria-labelledby="details-heading" className="flex flex-col gap-5">
        <h2 id="details-heading" className="type-display text-4xl">
          Name and time zone
        </h2>
        {admin ? (
          <>
            <RenameForm name={household.name} action={renameHouseholdAction} />
            <TimeZoneForm timeZone={household.timeZone} zones={zones} action={setTimeZoneAction} />
          </>
        ) : (
          <p>
            {household.name}. Times are shown in {household.timeZone.replaceAll("_", " ")} time.
          </p>
        )}
      </section>

      <section aria-labelledby="you-heading" className="flex flex-col gap-4">
        <h2 id="you-heading" className="type-display text-4xl">
          You
        </h2>
        <ProfileForm
          name={user.name}
          colour={membership.colour}
          colours={MEMBER_COLOURS}
          colourNames={MEMBER_COLOUR_NAMES}
          action={updateProfileAction}
        />
        <p className="text-ink-soft break-words">Signed in as {user.email}</p>
        <form action={signOut}>
          <button
            type="submit"
            className="flex min-h-11 items-center rounded font-bold underline underline-offset-4 outline-none focus-visible:ring-4 focus-visible:ring-fjord"
          >
            Sign out
          </button>
        </form>
        <div data-testid="leave">
          <ActionButton
            look="link"
            align="start"
            confirm={alone ? `Leave and delete ${household.name} for good?` : "Leave and cancel your bookings?"}
            action={removeMemberAction.bind(null, user.id)}
          >
            Leave household
          </ActionButton>
        </div>
      </section>
    </main>
  );
}
