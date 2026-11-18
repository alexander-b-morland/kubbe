import type { AreaKey } from "@/lib/areas";
import { clockLabel } from "@/lib/booking/status";
import { describeDue } from "@/lib/cleaning/rota";
import { describeDinnerDay } from "@/lib/dinner/plan";
import { daysBetween } from "@/lib/time";

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
  }[];
  /** Names of what this person said they would buy. */
  buying: readonly string[];
  /** Where "buy" leads: the shopping list, or dinner when the household has the list switched off. */
  buyingHref?: string;
  /** Open to-dos on the board given to this person. */
  tasks: readonly { id: string; body: string }[];
  /** Happenings this person has not answered, with when each is, ready to show. */
  unanswered: readonly { id: string; title: string; when: string }[];
};

/** How far ahead a dinner counts as something to act on. */
const DINNER_DAYS = 7;
const MAX_TASKS = 4;

const shorten = (text: string, length: number) => (text.length > length ? `${text.slice(0, length - 1).trimEnd()}…` : text);

export function buildToDos(input: ToDoInput): ToDo[] {
  const list: ToDo[] = [];
  const me = input.me;

  for (const turn of input.turns) {
    list.push({ key: `turn-${turn.id}`, area: "cleaning", what: turn.name, detail: `Your turn. ${describeDue(input.today, turn.lastDay)}.`, href: "/cleaning" });
  }

  for (const dinner of input.dinners) {
    if (dinner.cancelled || daysBetween(input.today, dinner.day) >= DINNER_DAYS) continue;
    const when = `${describeDinnerDay(dinner.day, input.today)} at ${clockLabel(dinner.time)}`;
    const href = `/dinner/${dinner.id}`;
    const going = dinner.going.includes(me);
    if (!going && !dinner.notGoing.includes(me)) {
      list.push({
        key: `in-${dinner.id}`,
        area: "dinner",
        what: dinner.chosenTitle ? `Dinner: ${dinner.chosenTitle}. Are you in?` : "Dinner. Are you in?",
        detail: when,
        href,
        ask: { kind: "dinner", id: dinner.id, title: dinner.chosenTitle ? `dinner (${dinner.chosenTitle})` : "dinner" },
      });
    }
    if (dinner.cookId === me) {
      list.push({ key: `cook-${dinner.id}`, area: "dinner", what: dinner.chosenTitle ? `Cook ${dinner.chosenTitle}` : "Cook dinner", detail: when, href });
    }
    if (dinner.cleanerId === me) {
      list.push({ key: `tidy-${dinner.id}`, area: "dinner", what: "Clean up after dinner", detail: when, href });
    }
    if (going && !dinner.chosenTitle && dinner.ideas > 0 && !dinner.voters.includes(me)) {
      list.push({ key: `vote-${dinner.id}`, area: "dinner", what: "Vote on dinner", detail: `${when}. ${dinner.ideas === 1 ? "1 idea" : `${dinner.ideas} ideas`}.`, href });
    }
  }

  if (input.buying.length > 0) {
    list.push({
      key: "buying",
      area: "shopping",
      what: input.buying.length === 1 ? `Buy ${input.buying[0]}` : `Buy ${input.buying.length} things`,
      detail: input.buying.length === 1 ? "You said you would." : shorten(input.buying.join(", "), 60),
      href: input.buyingHref ?? "/shopping",
    });
  }

  for (const task of input.tasks.slice(0, MAX_TASKS)) {
    list.push({ key: `task-${task.id}`, area: "board", what: shorten(task.body, 70), detail: "On the noticeboard, for you.", href: "/board" });
  }
  if (input.tasks.length > MAX_TASKS) {
    const more = input.tasks.length - MAX_TASKS;
    list.push({ key: "tasks-more", area: "board", what: more === 1 ? "1 more to-do" : `${more} more to-dos`, detail: "On the noticeboard, for you.", href: "/board" });
  }

  for (const happening of input.unanswered) {
    list.push({
      key: `answer-${happening.id}`,
      area: "happenings",
      what: `${shorten(happening.title, 50)}. Are you in?`,
      detail: happening.when,
      href: "/happenings",
      ask: { kind: "happening", id: happening.id, title: happening.title },
    });
  }

  return list;
}
