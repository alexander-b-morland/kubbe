import { Avatar } from "./avatar";

export type PersonLike = { userId: string; name: string; colour: string; avatar: string | null | undefined };

/** Someone's avatar and name on one line. The reader is called "You". */
export function Person({ person, me, size = "size-7", className = "" }: { person: PersonLike | undefined; me?: string; size?: string; className?: string }) {
  if (!person) return <span className={`text-ink-soft ${className}`}>Someone who moved out</span>;
  return (
    <span className={`inline-flex min-w-0 items-center gap-2 ${className}`}>
      <Avatar avatar={person.avatar} colour={person.colour} className={size} />
      <span className="min-w-0 break-words">{person.userId === me ? "You" : person.name}</span>
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
