import type { AreaKey } from "@/lib/areas";
import { clockLabel } from "@/lib/booking/status";
import { describeDue } from "@/lib/cleaning/rota";
import { describeDinnerDay, LOOK_AHEAD_DAYS } from "@/lib/dinner/plan";
import { en, type Translate } from "@/lib/i18n";
import { addDays, daysBetween } from "@/lib/time";

// What one person has on their plate, gathered from every part of the app into one
// list for Home. Pure: the screen fetches, this decides what to say.

export type ToDo = {
  key: string;
  area: AreaKey;
  what: string;
  detail: string;
  href: string;
  /** An invitation the person has not answered: Home shows the answer buttons with it. */
  ask?: { kind: "dinner" | "happening"; id: string; title: string };
};

export type ToDoInput = {
  me: string;
  today: string;
  /** Minutes after midnight now, so a dinner that has been eaten is not asked about. */
  nowMinutes?: number;
  /** Cleaning turns that are this person's and not done. */
  turns: readonly { id: string; name: string; lastDay: string }[];
  /** Upcoming dinners, soonest first. */
  dinners: readonly {
    id: string;
    day: string;
    time: number;
    cancelled: boolean;
    cookId: string | null;
    cleanerId: string | null;
    chosenTitle: string | null;
    ideas: number;
    going: readonly string[];
    notGoing: readonly string[];
    voters: readonly string[];
    /** Things the dish needs that nobody has said they will buy. */
    untaken?: number;
  }[];
  /** Names of what this person said they would buy. */
  buying: readonly string[];
  /** Where "buy" leads: the shopping list, or dinner when the household has the list switched off. */
  buyingHref?: string;
  /** Open to-dos on the board given to this person. */
  tasks: readonly { id: string; body: string }[];
  /** Happenings this person has not answered, with when each is, ready to show. */
  unanswered: readonly { id: string; title: string; when: string; day?: string }[];
  /** What this person should pay to settle up, with the amount ready to show. */
  owe?: readonly { to: string; name: string; amount: string }[];
};

/** How many dinner invitations are asked one by one. The rest are counted in one line. */
const MAX_INVITATIONS = 2;
const MAX_TASKS = 4;
/** Things without a day of their own sit after what is due today and tomorrow. */
const UNDATED_AFTER_DAYS = 2;

const shorten = (text: string, length: number) => (text.length > length ? `${text.slice(0, length - 1).trimEnd()}…` : text);
export function buildToDos(input: ToDoInput, t: Translate = en): ToDo[] {
  /** "today", "tomorrow", "Thursday 19 Nov": a day at the end of a sentence. */
  const dayInSentence = (day: string, today: string) => describeDinnerDay(day, today, t, true);
  // Each line with when it falls due, so the list can be put in the order things need doing.
  const list: { item: ToDo; day: string; minutes: number }[] = [];
  const me = input.me;
  const someday = addDays(input.today, UNDATED_AFTER_DAYS);
  const add = (item: ToDo, day: string = someday, minutes = 0) => list.push({ item, day, minutes });

  for (const turn of input.turns) {
    add(
      { key: `turn-${turn.id}`, area: "cleaning", what: turn.name, detail: t`Your turn. ${describeDue(input.today, turn.lastDay, t)}.`, href: "/cleaning" },
      turn.lastDay,
      24 * 60,
    );
  }

  let invitations = 0;
  let moreInvitations = 0;
  let firstMore: { day: string; time: number } | undefined;
  for (const dinner of input.dinners) {
    if (dinner.cancelled || daysBetween(input.today, dinner.day) >= LOOK_AHEAD_DAYS) continue;
    const when = t`${describeDinnerDay(dinner.day, input.today, t)} at ${clockLabel(dinner.time)}`;
    const href = `/dinner/${dinner.id}`;
    const going = dinner.going.includes(me);
    const over = dinner.day === input.today && input.nowMinutes !== undefined && dinner.time <= input.nowMinutes;

    if (!going && !dinner.notGoing.includes(me) && !over) {
      if (invitations < MAX_INVITATIONS) {
        invitations++;
        add(
          {
            key: `in-${dinner.id}`,
            area: "dinner",
            what: t`Are you in? Dinner ${dayInSentence(dinner.day, input.today)}`,
            detail: dinner.chosenTitle ? `${clockLabel(dinner.time)}, ${dinner.chosenTitle}` : t`${clockLabel(dinner.time)}, not decided what yet`,
            href,
            ask: { kind: "dinner", id: dinner.id, title: dinner.chosenTitle ? t`dinner (${dinner.chosenTitle})` : t`dinner ${dayInSentence(dinner.day, input.today)}` },
          },
          dinner.day,
          dinner.time,
        );
      } else {
        moreInvitations++;
        firstMore ??= dinner;
      }
    }
    if (dinner.cookId === me) {
      const untaken = dinner.untaken ?? 0;
      add(
        {
          key: `cook-${dinner.id}`,
          area: "dinner",
          what: dinner.chosenTitle ? t`Cook ${dinner.chosenTitle}` : t("Cook dinner"),
          detail: untaken === 0 ? when : untaken === 1 ? t`${when}. 1 thing nobody is buying yet.` : t`${when}. ${untaken} things nobody is buying yet.`,
          href,
        },
        dinner.day,
        dinner.time,
      );
    }
    if (dinner.cleanerId === me) {
      add({ key: `tidy-${dinner.id}`, area: "dinner", what: t("Clean up after dinner"), detail: when, href }, dinner.day, dinner.time);
    }
    if (going && !over && !dinner.chosenTitle && dinner.ideas > 0 && !dinner.voters.includes(me)) {
      add(
        { key: `vote-${dinner.id}`, area: "dinner", what: t("Vote on dinner"), detail: dinner.ideas === 1 ? t`${when}. 1 idea.` : t`${when}. ${dinner.ideas} ideas.`, href },
        dinner.day,
        dinner.time,
      );
    }
  }
  if (moreInvitations > 0 && firstMore) {
    add(
      {
        key: "in-more",
        area: "dinner",
        what: moreInvitations === 1 ? t("1 more dinner to answer") : t`${moreInvitations} more dinners to answer`,
        detail: t`From ${dayInSentence(firstMore.day, input.today)}.`,
        href: "/dinner",
      },
      firstMore.day,
      firstMore.time,
    );
  }

  if (input.buying.length > 0) {
    add({
      key: "buying",
      area: "shopping",
      what: input.buying.length === 1 ? t`Buy ${input.buying[0]}` : t`Buy ${input.buying.length} things`,
      detail: input.buying.length === 1 ? t("You said you would.") : shorten(input.buying.join(", "), 60),
      href: input.buyingHref ?? "/shopping",
    });
  }

  for (const task of input.tasks.slice(0, MAX_TASKS)) {
    add({ key: `task-${task.id}`, area: "board", what: shorten(task.body, 70), detail: t("On the noticeboard, for you."), href: `/board#${task.id}` });
  }
  if (input.tasks.length > MAX_TASKS) {
    const more = input.tasks.length - MAX_TASKS;
    add({ key: "tasks-more", area: "board", what: more === 1 ? t("1 more to-do") : t`${more} more to-dos`, detail: t("On the noticeboard, for you."), href: "/board" });
  }

  for (const happening of input.unanswered) {
    add(
      {
        key: `answer-${happening.id}`,
        area: "happenings",
        what: t`Are you in? ${shorten(happening.title, 50)}`,
        detail: happening.when,
        href: `/happenings#${happening.id}`,
        ask: { kind: "happening", id: happening.id, title: happening.title },
      },
      happening.day,
    );
  }

  for (const debt of input.owe ?? []) {
    add({ key: `pay-${debt.to}`, area: "expenses", what: t`Pay ${debt.name} ${debt.amount}`, detail: t("To settle up."), href: "/expenses" });
  }

  // Soonest first. Lines for the same moment keep the order they were added in.
  return list
    .map((entry, index) => ({ ...entry, index }))
    .sort((a, b) => a.day.localeCompare(b.day) || a.minutes - b.minutes || a.index - b.index)
    .map((entry) => entry.item);
}
