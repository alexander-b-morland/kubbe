import type { Metadata } from "next";
import { AreaPage } from "@/components/area/area-header";
import type { PersonLike } from "@/components/avatar/person";
import { Sticky } from "@/components/board/sticky";
import { AutoRefresh } from "@/components/booking/auto-refresh";
import { ActionButton } from "@/components/ui/action-button";
import { isFresh } from "@/components/ui/strike";
import { listNotes } from "@/lib/board";
import { requireExtra } from "@/lib/extras-guard";
import { listMembers } from "@/lib/households";
import { timeAgo } from "@/lib/time";
import { removeNoteAction, setNoteDoneAction } from "./actions";
import { NoteForm } from "./note-form";
import { getT } from "@/lib/i18n/server";

// This screen depends on who is signed in, so it is rendered per request.
export const instant = false;

export const metadata: Metadata = { title: "Noticeboard" };

export default async function BoardPage() {
  const t = await getT();
  const { user, household, membership } = await requireExtra("board");
  const now = new Date();
  const [notes, members] = await Promise.all([listNotes(household.id, now), listMembers(household.id)]);
  const person = new Map<string, PersonLike>(members.map((member) => [member.userId, member]));
  const open = notes.filter((note) => note.isTask && !note.doneAt).length;
  const plain = notes.filter((note) => !note.isTask).length;
  const notesCount = plain === 1 ? t("1 note") : t`${plain} notes`;
  const title = notes.length === 0 ? t("Nothing up yet") : open > 0 ? (open === 1 ? t("1 thing to do") : t`${open} things to do`) : plain > 0 ? notesCount : t("All sorted");
  const short = (text: string) => (text.length > 40 ? `${text.slice(0, 39).trimEnd()}…` : text);

  return (
    <AreaPage area="board" eyebrow={open > 0 && plain > 0 ? t`Noticeboard, with ${notesCount}` : t("Noticeboard")} title={title}>
      <AutoRefresh everySeconds={60} />

      {/* The whiteboard: a white surface in a frame, with the notes stuck on it. */}
      <section aria-label={t("The board")} className="rounded-2xl border-4 border-ink bg-white p-4 shadow-[0_6px_0_0_var(--color-ink)]">
        {notes.length > 0 ? (
          <ul className="grid grid-cols-1 items-start gap-4 min-[480px]:grid-cols-2 lg:grid-cols-3">
            {notes.map((note, index) => {
              const author = person.get(note.authorId);
              const assignee = note.assigneeId ? person.get(note.assigneeId) : null;
              const done = Boolean(note.doneAt);
              const mayRemove = note.authorId === user.id || membership.role === "admin";
              const line = !note.isTask
                ? undefined
                : done
                  ? note.doneBy === user.id ? t("Done by you") : t`Done by ${person.get(note.doneBy ?? "")?.name ?? t("someone")}`
                  : assignee
                    ? assignee.userId === user.id ? t("For you") : t`For ${assignee.name}`
                    : t("For anyone");
              return (
                <Sticky key={note.id} anchor index={index} author={author} line={line} note={{ id: note.id, body: note.body, isTask: note.isTask, done, fresh: isFresh(note.doneAt, now) }}>
                  <span className="text-sm">
                    {author ? (author.userId === user.id ? t("You") : author.name) : t("Someone who moved out")}, {timeAgo(note.createdAt, now, household.timeZone, t)}
                  </span>
                  <span className="flex w-full flex-wrap gap-2 pt-1">
                    {note.isTask ? (
                      <ActionButton look={done ? "outline" : "filled"} align="start" about={short(note.body)} action={setNoteDoneAction.bind(null, note.id, !done)}>
                        {done ? t("Undo") : t("Done")}
                      </ActionButton>
                    ) : null}
                    {mayRemove ? (
                      <ActionButton look="link" align="start" about={short(note.body)} confirm={t("Take it down?")} action={removeNoteAction.bind(null, note.id)}>
                        {t("Take down")}
                      </ActionButton>
                    ) : null}
                  </span>
                </Sticky>
              );
            })}
          </ul>
        ) : (
          <p className="p-4 text-lg text-ink-soft">
            {t("An empty board. Stick up a note for everyone: who has guests, what is broken, what needs doing.")}
          </p>
        )}
      </section>

      <section aria-labelledby="write-heading" className="flex flex-col gap-3">
        <h2 id="write-heading" className="type-display text-3xl">
          {t("Stick up a note")}
        </h2>
        <NoteForm people={members.map((member) => ({ userId: member.userId, name: member.name }))} me={user.id} />
      </section>
    </AreaPage>
  );
}
