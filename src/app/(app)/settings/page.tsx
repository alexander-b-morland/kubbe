import type { Metadata } from "next";
import { signOut } from "@/app/(auth)/actions";
import { listResources } from "@/lib/booking/service";
import { listMembers } from "@/lib/households";
import { formatJoinCode } from "@/lib/join-code";
import { MEMBER_COLOURS } from "@/lib/member-colours";
import { requireHousehold } from "@/lib/session";
import { SLOT_LENGTHS } from "@/lib/settings";
import { ShareCode } from "../home/share-code";
import {
  removeMemberAction,
  renameHouseholdAction,
  replaceJoinCodeAction,
  setRoleAction,
  updateProfileAction,
  updateResourceAction,
} from "./actions";
import { MemberAction, ProfileForm, RenameForm, ResourceForm } from "./settings-forms";

// This screen depends on who is signed in, so it is rendered per request.
export const instant = false;

export const metadata: Metadata = { title: "Household" };

const clockLabel = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

export default async function SettingsPage() {
  const { user, household, membership } = await requireHousehold();
  const [members, resources] = await Promise.all([listMembers(household.id), listResources(household.id)]);
  const admin = membership.role === "admin";

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-10 p-6 pt-10">
      <header className="flex flex-col gap-1">
        <p className="font-semibold text-ink-soft">Household</p>
        <h1 className="type-display text-6xl break-words">{household.name}</h1>
      </header>

      <section aria-labelledby="invite-heading" className="flex flex-col gap-3 rounded-2xl border-2 border-ink p-5">
        <h2 id="invite-heading" className="font-semibold">
          Join code
        </h2>
        <p className="type-display text-6xl tracking-widest" data-testid="join-code">
          {formatJoinCode(household.joinCode)}
        </p>
        <ShareCode code={household.joinCode} />
        {admin ? (
          <form action={replaceJoinCodeAction}>
            <button type="submit" className="font-bold underline underline-offset-4">
              Replace with a new code
            </button>
            <p className="pt-1 text-sm text-ink-soft">The old code and old invite links stop working.</p>
          </form>
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
              <li key={member.userId} className="flex flex-wrap items-center gap-3 border-b-2 border-ink/15 py-3" data-testid={`member-${member.name}`}>
                <span
                  aria-hidden="true"
                  className="type-display flex size-10 items-center justify-center rounded-full text-xl text-paper"
                  style={{ backgroundColor: member.colour }}
                >
                  {member.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="text-lg font-semibold">
                  {member.name}
                  {self ? " (you)" : ""}
                </span>
                {member.role === "admin" ? (
                  <span className="rounded-full border-2 border-ink px-3 py-0.5 text-sm font-bold">Admin</span>
                ) : null}
                <span className="ml-auto flex flex-wrap justify-end gap-2">
                  {admin && !self ? (
                    <MemberAction action={setRoleAction.bind(null, member.userId, member.role === "admin" ? "member" : "admin")}>
                      {member.role === "admin" ? "Remove as admin" : "Make admin"}
                    </MemberAction>
                  ) : null}
                  {admin && !self ? (
                    <MemberAction confirm={`Remove ${member.name}?`} action={removeMemberAction.bind(null, member.userId)}>
                      Remove
                    </MemberAction>
                  ) : null}
                  {self ? (
                    <MemberAction confirm="Leave this household?" action={removeMemberAction.bind(null, member.userId)}>
                      Leave
                    </MemberAction>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
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
          <ul className="flex flex-col">
            {resources
              .filter((resource) => resource.enabled)
              .map((resource) => (
                <li key={resource.id} className="flex flex-col border-b-2 border-ink/15 py-3">
                  <span className="text-lg font-semibold">{resource.name}</span>
                  <span className="text-ink-soft">
                    {resource.slotMinutes} minute slots from {clockLabel(resource.opensAt)} to {clockLabel(resource.closesAt)}, up to{" "}
                    {resource.maxPerDay} a day{resource.allowBackToBack ? "" : ", not back to back"}. Only an admin can change this.
                  </span>
                </li>
              ))}
          </ul>
        )}
      </section>

      {admin ? (
        <section aria-labelledby="name-heading" className="flex flex-col gap-3">
          <h2 id="name-heading" className="type-display text-4xl">
            Name
          </h2>
          <RenameForm name={household.name} action={renameHouseholdAction} />
        </section>
      ) : null}

      <section aria-labelledby="you-heading" className="flex flex-col gap-3">
        <h2 id="you-heading" className="type-display text-4xl">
          You
        </h2>
        <ProfileForm name={user.name} colour={membership.colour} colours={MEMBER_COLOURS} action={updateProfileAction} />
        <p className="text-ink-soft">Signed in as {user.email}</p>
        <form action={signOut}>
          <button type="submit" className="font-bold underline underline-offset-4">
            Sign out
          </button>
        </form>
      </section>
    </main>
  );
}
