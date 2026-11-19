import type { AreaKey } from "@/lib/areas";
import { clockLabel } from "@/lib/booking/status";
import { describeDue } from "@/lib/cleaning/rota";
import { describeDinnerDay, LOOK_AHEAD_DAYS } from "@/lib/dinner/plan";
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
/** "today", "tomorrow", "Thursday 19 Nov": a day at the end of a sentence. */
const dayInSentence = (day: string, today: string) => {
  const label = describeDinnerDay(day, today);
  return label === "Today" || label === "Tomorrow" ? label.toLowerCase() : label;
};

export function buildToDos(input: ToDoInput): ToDo[] {
  // Each line with when it falls due, so the list can be put in the order things need doing.
  const list: { item: ToDo; day: string; minutes: number }[] = [];
  const me = input.me;
  const someday = addDays(input.today, UNDATED_AFTER_DAYS);
  const add = (item: ToDo, day: string = someday, minutes = 0) => list.push({ item, day, minutes });

  for (const turn of input.turns) {
    add(
      { key: `turn-${turn.id}`, area: "cleaning", what: turn.name, detail: `Your turn. ${describeDue(input.today, turn.lastDay)}.`, href: "/cleaning" },
      turn.lastDay,
      24 * 60,
    );
  }

  let invitations = 0;
  let moreInvitations = 0;
  let firstMore: { day: string; time: number } | undefined;
  for (const dinner of input.dinners) {
    if (dinner.cancelled || daysBetween(input.today, dinner.day) >= LOOK_AHEAD_DAYS) continue;
    const when = `${describeDinnerDay(dinner.day, input.today)} at ${clockLabel(dinner.time)}`;
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
            what: `Are you in? Dinner ${dayInSentence(dinner.day, input.today)}`,
            detail: dinner.chosenTitle ? `${clockLabel(dinner.time)}, ${dinner.chosenTitle}` : `${clockLabel(dinner.time)}, not decided what yet`,
            href,
            ask: { kind: "dinner", id: dinner.id, title: dinner.chosenTitle ? `dinner (${dinner.chosenTitle})` : `dinner ${dayInSentence(dinner.day, input.today)}` },
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
          what: dinner.chosenTitle ? `Cook ${dinner.chosenTitle}` : "Cook dinner",
          detail: untaken > 0 ? `${when}. ${untaken === 1 ? "1 thing" : `${untaken} things`} nobody is buying yet.` : when,
          href,
        },
        dinner.day,
        dinner.time,
      );
    }
    if (dinner.cleanerId === me) {
      add({ key: `tidy-${dinner.id}`, area: "dinner", what: "Clean up after dinner", detail: when, href }, dinner.day, dinner.time);
    }
    if (going && !over && !dinner.chosenTitle && dinner.ideas > 0 && !dinner.voters.includes(me)) {
      add(
        { key: `vote-${dinner.id}`, area: "dinner", what: "Vote on dinner", detail: `${when}. ${dinner.ideas === 1 ? "1 idea" : `${dinner.ideas} ideas`}.`, href },
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
        what: moreInvitations === 1 ? "1 more dinner to answer" : `${moreInvitations} more dinners to answer`,
        detail: `From ${dayInSentence(firstMore.day, input.today)}.`,
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
      what: input.buying.length === 1 ? `Buy ${input.buying[0]}` : `Buy ${input.buying.length} things`,
      detail: input.buying.length === 1 ? "You said you would." : shorten(input.buying.join(", "), 60),
      href: input.buyingHref ?? "/shopping",
    });
  }

  for (const task of input.tasks.slice(0, MAX_TASKS)) {
    add({ key: `task-${task.id}`, area: "board", what: shorten(task.body, 70), detail: "On the noticeboard, for you.", href: `/board#${task.id}` });
  }
  if (input.tasks.length > MAX_TASKS) {
    const more = input.tasks.length - MAX_TASKS;
    add({ key: "tasks-more", area: "board", what: more === 1 ? "1 more to-do" : `${more} more to-dos`, detail: "On the noticeboard, for you.", href: "/board" });
  }

  for (const happening of input.unanswered) {
    add(
      {
        key: `answer-${happening.id}`,
        area: "happenings",
        what: `Are you in? ${shorten(happening.title, 50)}`,
        detail: happening.when,
        href: `/happenings#${happening.id}`,
        ask: { kind: "happening", id: happening.id, title: happening.title },
      },
      happening.day,
    );
  }

  for (const debt of input.owe ?? []) {
    add({ key: `pay-${debt.to}`, area: "expenses", what: `Pay ${debt.name} ${debt.amount}`, detail: "To settle up.", href: "/expenses" });
  }

  // Soonest first. Lines for the same moment keep the order they were added in.
  return list
    .map((entry, index) => ({ ...entry, index }))
    .sort((a, b) => a.day.localeCompare(b.day) || a.minutes - b.minutes || a.index - b.index)
    .map((entry) => entry.item);
}
