import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/area/area-header";
import { Avatar } from "@/components/avatar/avatar";
import { tally } from "@/lib/cleaning/service";
import { getHousemate, pickKey, PICKS, QUESTIONS } from "@/lib/profile";
import { requireHousehold } from "@/lib/session";
import { describeDay, dayInZone } from "@/lib/time";

// This screen depends on who is signed in, so it is rendered per request.
export const instant = false;

export const metadata: Metadata = { title: "Roommate" };

// Each answer sits on a wash of one of the house colours, going round.
const washes = ["bg-salmon/40", "bg-sage/50", "bg-heather/40", "bg-sky/50", "bg-blush/40", "bg-ochre/40"];

export default async function PersonPage({ params }: PageProps<"/people/[id]">) {
  const { user, household } = await requireHousehold();
  const now = new Date();
  // Looked up inside the caller's household: an id from anywhere else finds nobody.
  const [person, done] = await Promise.all([
    getHousemate(household.id, (await params).id),
    tally(household.id, new Date(now.getTime() - 56 * 86_400_000)),
  ]);
  if (!person) notFound();

  const self = person.userId === user.id;
  const answered = QUESTIONS.filter((question) => person.answers[question.key]);
  const picks = PICKS.filter((pick) => person.answers[pickKey(pick.key)]);
  const turns = done.get(person.userId) ?? 0;
  const since = describeDay(dayInZone(person.joinedAt, household.timeZone));
  const empty = !person.bio && answered.length === 0 && picks.length === 0;

  return (
    <main className="mx-auto flex w-full max-w-md flex-col lg:max-w-3xl lg:pt-6">
      <header className="flex flex-col gap-4 p-6 pt-5 text-paper lg:rounded-3xl" style={{ backgroundColor: person.colour }}>
        <BackLink href="/settings" label="Household" ring="focus-visible:ring-paper" />
        <div className="flex items-center gap-4">
          <Avatar avatar={person.avatar} colour="transparent" className="size-28 border-4 border-paper" />
          <div className="flex min-w-0 flex-col gap-1">
            <p className="font-semibold">
              {person.role === "admin" ? "Admin of" : "Lives in"} {household.name}
            </p>
            <h1 className="type-display text-6xl break-words">{person.name}</h1>
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-8 p-6">
        {person.bio ? <p className="type-display text-4xl break-words">&ldquo;{person.bio}&rdquo;</p> : null}
        {empty ? (
          <p className="text-lg text-ink-soft">
            {self ? "You haven't told your roommates anything about yourself yet." : `${person.name} hasn't written anything yet.`}
          </p>
        ) : null}

        <ul className="flex flex-wrap gap-2" aria-label="Facts">
          <li className="rounded-full border-2 border-ink px-4 py-1.5 font-semibold">
            Here since {since.dayOfMonth} {since.monthShort}
          </li>
          <li className="rounded-full border-2 border-ink px-4 py-1.5 font-semibold">
            {turns === 1 ? "1 cleaning turn done" : `${turns} cleaning turns done`} lately
          </li>
          {person.avoids ? <li className="rounded-full border-2 border-ink px-4 py-1.5 font-semibold break-words">Doesn&apos;t eat: {person.avoids}</li> : null}
        </ul>

        {picks.length > 0 ? (
          <section aria-labelledby="picks-heading" className="flex flex-col gap-3">
            <h2 id="picks-heading" className="type-display text-3xl">
              This or that
            </h2>
            <ul className="flex flex-col gap-2">
              {picks.map((pick) => {
                const chosen = person.answers[pickKey(pick.key)];
                return (
                  <li key={pick.key} className="flex items-stretch gap-2">
                    {(["a", "b"] as const).map((option) => (
                      <span
                        key={option}
                        className={`flex min-h-11 flex-1 items-center justify-center rounded-full border-2 px-3 py-1 text-center font-bold ${chosen === option ? "border-ink bg-ink text-paper" : "border-ink/25 text-ink-soft"}`}
                      >
                        {chosen === option ? <span className="sr-only">Picked: </span> : null}
                        {pick[option]}
                      </span>
                    ))}
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {answered.length > 0 ? (
          <dl className="grid gap-3 sm:grid-cols-2">
            {answered.map((question, index) => (
              <div key={question.key} className={`flex flex-col gap-2 rounded-2xl p-5 ${washes[index % washes.length]}`}>
                <dt className="font-semibold">{question.ask}</dt>
                <dd className="type-display text-3xl break-words">{person.answers[question.key]}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        {self ? (
          <Link
            href="/profile"
            className="flex min-h-12 w-fit items-center rounded-full bg-ink px-6 font-bold text-paper outline-none focus-visible:ring-4 focus-visible:ring-fjord"
          >
            {empty ? "Fill in your profile" : "Change your profile"}
          </Link>
        ) : null}
      </div>
    </main>
  );
}
