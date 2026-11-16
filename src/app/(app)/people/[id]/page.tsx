import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/avatar/avatar";
import { getHousemate, QUESTIONS } from "@/lib/profile";
import { requireHousehold } from "@/lib/session";

// This screen depends on who is signed in, so it is rendered per request.
export const instant = false;

export const metadata: Metadata = { title: "Roommate" };

const link =
  "flex min-h-11 w-fit items-center rounded font-bold underline underline-offset-4 outline-none focus-visible:ring-4 focus-visible:ring-fjord";

export default async function PersonPage({ params }: PageProps<"/people/[id]">) {
  const { user, household } = await requireHousehold();
  // Looked up inside the caller's household: an id from anywhere else finds nobody.
  const person = await getHousemate(household.id, (await params).id);
  if (!person) notFound();

  const self = person.userId === user.id;
  const answered = QUESTIONS.filter((question) => person.answers[question.key]);

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-6 pt-10">
      <Avatar avatar={person.avatar} colour={person.colour} className="size-32" />
      <header className="flex flex-col gap-1">
        <p className="font-semibold text-ink-soft">
          {person.role === "admin" ? "Admin of" : "Lives in"} {household.name}
        </p>
        <h1 className="type-display text-6xl break-words">{person.name}</h1>
      </header>

      {person.bio ? <p className="text-xl">{person.bio}</p> : null}
      {!person.bio && answered.length === 0 ? (
        <p className="text-lg text-ink-soft">
          {self ? "You haven't written anything about yourself yet." : `${person.name} hasn't written anything yet.`}
        </p>
      ) : null}

      {answered.length > 0 ? (
        <dl className="flex flex-col">
          {answered.map((question) => (
            <div key={question.key} className="flex flex-col gap-1 border-b-2 border-ink/15 py-3">
              <dt className="text-sm font-semibold text-ink-soft">{question.ask}</dt>
              <dd className="type-display text-3xl break-words">{person.answers[question.key]}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {person.avoids ? (
        <p>
          <span className="font-semibold">Doesn&apos;t eat:</span> {person.avoids}
        </p>
      ) : null}

      {self ? (
        <Link href="/profile" className={link}>
          Edit your profile
        </Link>
      ) : null}
      <Link href="/flat" className={link}>
        Back to the flat
      </Link>
    </main>
  );
}
