import type { Metadata } from "next";
import { Avatar } from "@/components/avatar/avatar";
import { AutoRefresh } from "@/components/booking/auto-refresh";
import { ExtraHeader } from "@/components/extras/extra-header";
import { ActionButton } from "@/components/ui/action-button";
import { listNotes } from "@/lib/board";
import { requireExtra } from "@/lib/extras-guard";
import { listMembers } from "@/lib/households";
import { timeAgo } from "@/lib/time";
import { removeNoteAction, setNoteDoneAction } from "./actions";
import { NoteForm } from "./note-form";

// This screen depends on who is signed in, so it is rendered per request.
export const instant = false;

export const metadata: Metadata = { title: "Noticeboard" };

// Notes hang a little crooked, like paper put up by hand.
const tilt = ["-rotate-[0.6deg]", "rotate-[0.5deg]", "-rotate-[0.3deg]", "rotate-[0.8deg]"];

export default async function BoardPage() {
  const { user, household, membership } = await requireExtra("board");
  const now = new Date();
  const [notes, members] = await Promise.all([listNotes(household.id, now), listMembers(household.id)]);
  const person = new Map(members.map((member) => [member.userId, member]));
  const open = notes.filter((note) => note.isTask && !note.doneAt).length;

  return (
    <main className="mx-auto flex max-w-md flex-col gap-8 p-6 pt-10">
      <AutoRefresh everySeconds={60} />
      <ExtraHeader art="board" eyebrow="Noticeboard">
        {notes.length === 0 ? "Nothing up yet" : open === 0 ? "All sorted" : open === 1 ? "1 thing to do" : `${open} things to do`}
      </ExtraHeader>

      <NoteForm people={members.map((member) => ({ userId: member.userId, name: member.name }))} count={notes.length} />

      {notes.length > 0 ? (
        <ul className="flex flex-col gap-4">
          {notes.map((note, index) => {
            const author = person.get(note.authorId);
            const assignee = note.assigneeId ? person.get(note.assigneeId) : null;
            const done = Boolean(note.doneAt);
            const fresh = note.doneAt ? now.getTime() - note.doneAt.getTime() < 20_000 : false;
            const mayRemove = note.authorId === user.id || membership.role === "admin";
            return (
              <li
                key={note.id}
                data-testid="note"
                data-state={!note.isTask ? "note" : done ? "done" : "open"}
                className={`flex flex-col gap-3 rounded-2xl border-2 border-ink bg-white/60 p-4 ${tilt[index % tilt.length]}`}
              >
                <p className={`relative w-fit text-xl break-words whitespace-pre-line ${done ? "text-ink-soft" : ""}`}>
                  {note.body}
                  {done ? (
                    <svg className={`strike ${fresh ? "strike--draw" : ""}`} viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden="true">
                      <path pathLength={1} d="M1 12C20 7 42 15 60 10C76 6 90 13 99 9" />
                    </svg>
                  ) : null}
                </p>
                {note.isTask ? (
                  <p className="font-semibold">
                    {done
                      ? `Done by ${note.doneBy === user.id ? "you" : (person.get(note.doneBy ?? "")?.name ?? "someone")}`
                      : assignee
                        ? `For ${assignee.userId === user.id ? "you" : assignee.name}`
                        : "For anyone"}
                  </p>
                ) : null}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  {author ? <Avatar avatar={author.avatar} colour={author.colour} className="size-7" /> : null}
                  <span className="text-sm text-ink-soft">
                    {author ? (author.userId === user.id ? "You" : author.name) : "Someone who moved out"},{" "}
                    {timeAgo(note.createdAt, now, household.timeZone)}
                  </span>
                  <span className="ml-auto flex flex-wrap justify-end gap-2">
                    {mayRemove ? (
                      <ActionButton label="Take this note down" confirm="Take it down?" action={removeNoteAction.bind(null, note.id)}>
                        Take down
                      </ActionButton>
                    ) : null}
                    {note.isTask ? (
                      <ActionButton
                        look={done ? "outline" : "filled"}
                        label={done ? "Mark as not done" : "Mark as done"}
                        action={setNoteDoneAction.bind(null, note.id, !done)}
                      >
                        {done ? "Undo" : "Done"}
                      </ActionButton>
                    ) : null}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-lg text-ink-soft">
          Notes for everyone go here: who has guests, what is broken, what needs doing. Things that need doing can be given to
          someone.
        </p>
      )}
    </main>
  );
}
