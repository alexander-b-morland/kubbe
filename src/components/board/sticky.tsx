import type { ReactNode } from "react";
import { Avatar } from "@/components/avatar/avatar";
import type { PersonLike } from "@/components/avatar/person";
import { Struck } from "@/components/ui/strike";

// Notes hang a little crooked, like paper put up by hand.
const tilt = ["-rotate-1", "rotate-[0.7deg]", "-rotate-[0.4deg]", "rotate-1"];

export type StickyNote = { id: string; body: string; isTask: boolean; done: boolean; fresh?: boolean };

/**
 * One note on the whiteboard: a yellow sticky for something to know, a pale blue one for
 * something to do. The author's face and when it went up sit at the bottom, a red cross
 * in the corner for whoever may take it down.
 */
export function Sticky({
  note,
  index,
  author,
  line,
  when,
  corner,
  reaction,
  children,
  small = false,
  anchor = false,
}: {
  note: StickyNote;
  index: number;
  author: PersonLike | undefined;
  /** The line under the text: who it is for, or who did it. */
  line?: string;
  /** When it went up, and on the board by whom: "Ida, 5 min ago". */
  when?: string;
  /** The red cross that takes it down, for its author or an admin. */
  corner?: ReactNode;
  /** The thumbs-up. */
  reaction?: ReactNode;
  /** Buttons, on the full board. */
  children?: ReactNode;
  small?: boolean;
  /** Give the note an address a link can point at. Only on the board itself. */
  anchor?: boolean;
}) {
  return (
    <li
      id={anchor ? note.id : undefined}
      data-testid="note"
      data-state={!note.isTask ? "note" : note.done ? "done" : "open"}
      className={`relative flex flex-col gap-3 rounded-sm p-4 shadow-[2px_3px_0_0_rgba(30,42,68,0.25)] ${note.isTask ? "bg-todo" : "bg-note"} ${tilt[index % tilt.length]}`}
    >
      {corner}
      <p className={`${small ? "line-clamp-4 text-base" : "text-lg"} pr-4 font-semibold break-words whitespace-pre-line ${note.done ? "text-ink-soft" : ""}`}>
        {note.done ? <Struck draw={note.fresh}>{note.body}</Struck> : note.body}
      </p>
      {line ? <p className="text-sm font-bold">{line}</p> : null}
      <div className="mt-auto flex flex-wrap items-center gap-2">
        {author ? <Avatar avatar={author.avatar} colour={author.colour} className={small ? "size-6" : "size-8"} /> : null}
        {when ? <span className="min-w-0 text-sm">{when}</span> : null}
        {reaction ? <span className="ml-auto">{reaction}</span> : null}
      </div>
      {children ? <div className="flex w-full flex-wrap gap-2">{children}</div> : null}
    </li>
  );
}
