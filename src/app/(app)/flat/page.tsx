import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/avatar/avatar";
import { RoomArt } from "@/components/illustrations/room-art";
import { EXTRAS, hasExtra } from "@/lib/extras";
import { listMembers } from "@/lib/households";
import { requireHousehold } from "@/lib/session";

// This screen depends on who is signed in, so it is rendered per request.
export const instant = false;

export const metadata: Metadata = { title: "Flat" };

const row =
  "flex items-center gap-4 border-b-2 border-ink/15 py-4 outline-none focus-visible:ring-4 focus-visible:ring-fjord";

/** Everything beyond booking and cleaning: the extras, the people, and the settings. */
export default async function FlatPage() {
  const { user, household } = await requireHousehold();
  const members = await listMembers(household.id);
  const extras = EXTRAS.filter((extra) => hasExtra(household, extra.key));

  return (
    <main className="mx-auto flex max-w-md flex-col gap-8 p-6 pt-10">
      <header className="flex flex-col gap-1">
        <p className="font-semibold text-ink-soft break-words">{household.name}</p>
        <h1 className="type-display text-6xl">The flat</h1>
      </header>

      {extras.length > 0 ? (
        <nav aria-label="More to do together">
          <ul className="flex flex-col">
            {extras.map((extra, index) => (
              <li key={extra.key}>
                <Link href={extra.href} className={row}>
                  <RoomArt room={extra.art} animate delay={0.1 + index * 0.25} className="size-14 shrink-0" />
                  <span className="flex flex-col">
                    <span className="type-display text-4xl">{extra.name}</span>
                    <span className="text-ink-soft">{extra.blurb}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      <section aria-labelledby="people-heading" className="flex flex-col gap-1">
        <h2 id="people-heading" className="type-display text-4xl">
          Who lives here
        </h2>
        <ul className="flex flex-col">
          {members.map((member) => (
            <li key={member.userId}>
              <Link href={`/people/${member.userId}`} className={row}>
                <Avatar avatar={member.avatar} colour={member.colour} className="size-12" />
                <span className="min-w-0 text-lg font-semibold break-words">
                  {member.name}
                  {member.userId === user.id ? " (you)" : ""}
                </span>
                {member.role === "admin" ? (
                  <span className="ml-auto shrink-0 rounded-full border-2 border-ink px-3 py-0.5 text-sm font-bold">Admin</span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <nav aria-label="Settings" className="flex flex-col">
        <Link href="/profile" className={row}>
          <span className="text-lg font-bold">Your profile</span>
          <span className="ml-auto text-ink-soft">Avatar, bio, colour</span>
        </Link>
        <Link href="/settings" className={row}>
          <span className="text-lg font-bold">Household</span>
          <span className="ml-auto text-ink-soft">Invite code, rules, people</span>
        </Link>
      </nav>
    </main>
  );
}
