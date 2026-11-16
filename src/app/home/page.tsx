import type { Metadata } from "next";
import { signOut } from "@/app/(auth)/actions";
import { listMembers } from "@/lib/households";
import { formatJoinCode } from "@/lib/join-code";
import { requireHousehold } from "@/lib/session";
import { ShareCode } from "./share-code";

// This screen depends on who is signed in, so it is rendered per request.
export const instant = false;

export const metadata: Metadata = { title: "Home" };

const rooms = [
  { name: "Shower", className: "bg-fjord text-paper" },
  { name: "Laundry", className: "bg-ochre text-ink" },
  { name: "Cleaning", className: "bg-spruce text-paper" },
];

export default async function HomePage() {
  const { user, household, membership } = await requireHousehold();
  const members = await listMembers(household.id);
  const alone = members.length === 1;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-8 p-6 pt-10">
      <header className="flex flex-col gap-1">
        <p className="font-semibold text-ink-soft">Hi {user.name}</p>
        <h1 className="type-display text-6xl break-words">{household.name}</h1>
      </header>

      <section aria-labelledby="code-heading" className="flex flex-col gap-3 rounded-2xl border-2 border-ink p-5">
        <h2 id="code-heading" className="font-semibold">
          {alone ? "Share this code to get your roommates in" : "Join code"}
        </h2>
        <p className="type-display text-6xl tracking-widest" data-testid="join-code">
          {formatJoinCode(household.joinCode)}
        </p>
        <ShareCode code={household.joinCode} householdName={household.name} />
      </section>

      <section aria-labelledby="members-heading" className="flex flex-col gap-3">
        <h2 id="members-heading" className="type-display text-3xl">
          {alone ? "Just you so far" : `${members.length} people live here`}
        </h2>
        <ul className="flex flex-col">
          {members.map((member) => (
            <li key={member.userId} className="flex items-center gap-3 border-b-2 border-ink/15 py-3">
              <span
                aria-hidden="true"
                className="type-display flex size-10 items-center justify-center rounded-full text-xl text-paper"
                style={{ backgroundColor: member.colour }}
              >
                {member.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="text-lg font-semibold">
                {member.name}
                {member.userId === membership.userId ? " (you)" : ""}
              </span>
              {member.role === "admin" ? (
                <span className="ml-auto rounded-full border-2 border-ink px-3 py-0.5 text-sm font-bold">
                  Admin
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="rooms-heading" className="flex flex-col gap-2">
        <h2 id="rooms-heading" className="font-semibold text-ink-soft">
          Booking opens here next
        </h2>
        <ul className="flex flex-col gap-2">
          {rooms.map((room) => (
            <li key={room.name} className={`type-display rounded-xl px-4 py-3 text-3xl ${room.className}`}>
              {room.name}
            </li>
          ))}
        </ul>
      </section>

      <form action={signOut} className="mt-auto pt-4">
        <button type="submit" className="font-bold underline underline-offset-4">
          Sign out
        </button>
      </form>
    </main>
  );
}
