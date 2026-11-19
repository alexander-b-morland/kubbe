import { Avatar } from "./avatar";
import { getT } from "@/lib/i18n/server";

export type PersonLike = { userId: string; name: string; colour: string; avatar: string | null | undefined };

/** Someone's avatar and name on one line. The reader is called "You", or "you" in the middle of a sentence. */
export async function Person({
  person,
  me,
  size = "size-7",
  className = "",
  inSentence = false,
}: {
  person: PersonLike | undefined;
  me?: string;
  size?: string;
  className?: string;
  inSentence?: boolean;
}) {
  const t = await getT();
  if (!person) return <span className={`text-ink-soft ${className}`}>{inSentence ? t("someone who moved out") : t("Someone who moved out")}</span>;
  return (
    <span className={`inline-flex min-w-0 items-center gap-2 ${className}`}>
      <Avatar avatar={person.avatar} colour={person.colour} className={size} />
      <span className="min-w-0 break-words">{person.userId === me ? (inSentence ? t("you") : t("You")) : person.name}</span>
    </span>
  );
}

/** A row of overlapping avatars, for "who is in". */
export function Faces({ people, size = "size-8" }: { people: readonly PersonLike[]; size?: string }) {
  if (people.length === 0) return null;
  return (
    <span className="flex -space-x-2">
      {people.map((person) => (
        <Avatar key={person.userId} avatar={person.avatar} colour={person.colour} className={`${size} border-2 border-paper`} />
      ))}
    </span>
  );
}
