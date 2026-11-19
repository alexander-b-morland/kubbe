import Link from "next/link";
import { goingAction } from "@/app/(app)/dinner/actions";
import { replyAction } from "@/app/(app)/happenings/actions";
import { Faces, type PersonLike } from "@/components/avatar/person";
import { RoomArt } from "@/components/illustrations/room-art";
import { ActionButton } from "@/components/ui/action-button";
import { areaOf } from "@/lib/areas";
import { clockLabel } from "@/lib/booking/status";
import type { CalendarItem } from "@/lib/calendar";

/** "I'm in" and "Can't" for a dinner or a happening, wherever it is shown. */
export function AnswerButtons({ ask, title }: { ask: NonNullable<CalendarItem["ask"]>; title: string }) {
  const answer = (going: boolean) => (ask.kind === "dinner" ? goingAction.bind(null, ask.id, going) : replyAction.bind(null, ask.id, going));
  return (
    <span className="flex flex-wrap gap-2" data-testid="answer">
      <ActionButton look="filled" align="start" label={`I'm in for ${title}`} action={answer(true)}>
        I&apos;m in
      </ActionButton>
      <ActionButton align="start" label={`I can't make ${title}`} action={answer(false)}>
        Can&apos;t
      </ActionButton>
    </span>
  );
}

/**
 * One thing on a day: its area's colour and drawing, when it is, what it is, whose it
 * is. If the reader has not answered an invitation, the answer buttons are right there.
 */
export function AgendaItem({
  item,
  people,
  day,
  answers = true,
}: {
  item: CalendarItem;
  people: Map<string, PersonLike>;
  /** A label for the day, when the list spans several. */
  day?: string;
  /** Leave the answer buttons out where the same invitation is already asked on the screen. */
  answers?: boolean;
}) {
  const area = areaOf(item.area);
  const faces = item.people.map((id) => people.get(id)).filter((person) => person !== undefined);
  return (
    <li data-testid="agenda-item" data-area={item.area} className="flex gap-3 border-b-2 border-ink/15 py-3">
      <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${area.band}`}>
        <RoomArt room={area.art} className="size-7" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Link href={item.href} className="flex flex-col rounded outline-none focus-visible:ring-4 focus-visible:ring-fjord">
          <span className="text-sm font-semibold text-ink-soft">
            {day ? `${day}, ` : ""}
            {item.time === null ? (day ? "by the end of the day" : "By the end of the day") : clockLabel(item.time)}
          </span>
          <span className={`text-lg font-semibold break-words ${item.done ? "text-ink-soft line-through" : ""}`}>{item.title}</span>
          {item.detail ? <span className="break-words text-ink-soft">{item.detail}</span> : null}
        </Link>
        {faces.length > 0 || item.answer || (item.ask && answers) ? (
          <div className="flex flex-wrap items-center gap-3">
            <Faces people={faces} size="size-7" />
            {item.ask && answers ? <AnswerButtons ask={item.ask} title={item.title} /> : null}
            {item.answer ? (
              <span data-testid="my-answer" className={`rounded-full border-2 border-ink px-3 py-0.5 text-sm font-bold ${item.answer.going ? "bg-ink text-paper" : ""}`}>
                {item.answer.going ? "You're in" : "You can't"}
              </span>
            ) : null}
            {item.answer && !item.answer.going ? (
              // Saying yes after a no takes nothing from anyone, so it is one press. Leaving is done on its own screen.
              <ActionButton
                look="link"
                align="start"
                about={item.title}
                action={(item.answer.kind === "dinner" ? goingAction : replyAction).bind(null, item.answer.id, true)}
              >
                I&apos;m in after all
              </ActionButton>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}
