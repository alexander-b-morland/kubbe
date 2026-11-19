import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AreaPage } from "@/components/area/area-header";
import { Avatar } from "@/components/avatar/avatar";
import { Faces, Person, type PersonLike } from "@/components/avatar/person";
import { ActionButton } from "@/components/ui/action-button";
import { isFresh, Struck } from "@/components/ui/strike";
import { clockLabel } from "@/lib/booking/status";
import { ruledOut } from "@/lib/dinner/cookbook";
import { describeDinnerDay, rankDishes } from "@/lib/dinner/plan";
import { avoidsOfThoseComing, getDinner, type DinnerDetail } from "@/lib/dinner/service";
import { requireExtra } from "@/lib/extras-guard";
import { listMembers } from "@/lib/households";
import { listNames } from "@/lib/names";
import { dayInZone } from "@/lib/time";
import {
  atHomeAction,
  cancelDinnerAction,
  chooseAction,
  claimIngredientAction,
  dutyAction,
  goingAction,
  gotIngredientAction,
  removeDishAction,
  removeIngredientAction,
  voteAction,
} from "../actions";
import { DishForm, IdeasPanel, IngredientForm } from "../dinner-forms";

// This screen depends on who is signed in, so it is rendered per request.
export const instant = false;

// Asking for dinner ideas waits on an AI answer, which can take longer than a page load.
export const maxDuration = 60;

export const metadata: Metadata = { title: "Dinner" };

const BACK = { href: "/dinner", label: "All dinners" };

type Ingredient = DinnerDetail["dishes"][number]["ingredients"][number];

function Tick() {
  return (
    <svg viewBox="0 0 24 24" className="tick-draw size-5 shrink-0" aria-hidden="true">
      <path d="M4 13C7 15 9 17 10 19C13 13 17 8 21 5" pathLength={1} />
    </svg>
  );
}

/** One line of "where this dinner stands": a drawn tick when it is sorted, an empty ring when not. */
function Step({ done, children }: { done: boolean; children: React.ReactNode }) {
  return (
    <li data-done={done ? "yes" : "no"} className="flex items-start gap-3 py-1.5">
      <span className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-ink ${done ? "bg-ink text-paper" : ""}`}>
        {done ? (
          <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
            <path d="M4 13C7 15 9 17 10 19C13 13 17 8 21 5" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
      </span>
      <span className={done ? "font-semibold" : ""}>
        <span className="sr-only">{done ? "Done: " : "Not yet: "}</span>
        {children}
      </span>
    </li>
  );
}

export default async function DinnerPage({ params }: PageProps<"/dinner/[id]">) {
  const { user, household, membership } = await requireExtra("dinner");
  const { id } = await params;
  // Looked up inside the caller's household: an id from anywhere else finds nothing.
  const [dinner, members] = z.uuid().safeParse(id).success
    ? await Promise.all([getDinner(household.id, id), listMembers(household.id)])
    : [null, []];
  if (!dinner) notFound();

  const now = new Date();
  const today = dayInZone(now, household.timeZone);
  const when = `${describeDinnerDay(dinner.day, today)}, ${clockLabel(dinner.time)}`;
  const person = new Map<string, PersonLike>(members.map((member) => [member.userId, member]));
  const nameOf = (userId: string | null) => (userId ? person.get(userId)?.name : undefined) ?? "Someone";
  const who = (userId: string | null) => (userId === user.id ? "You" : nameOf(userId));

  if (dinner.cancelled) {
    return (
      <AreaPage area="dinner" eyebrow={when} back={BACK} title="Called off">
        <p className="text-lg">Nobody is cooking this one. What was on it is kept, in case it is back on.</p>
        <ActionButton look="filled" align="start" action={cancelDinnerAction.bind(null, dinner.id, false)}>
          Bring it back
        </ActionButton>
      </AreaPage>
    );
  }

  const going = members.filter((member) => dinner.going.includes(member.userId));
  const out = members.filter((member) => dinner.notGoing.includes(member.userId));
  const waiting = members.filter((member) => !dinner.going.includes(member.userId) && !dinner.notGoing.includes(member.userId));
  const mine = dinner.going.includes(user.id) ? "in" : dinner.notGoing.includes(user.id) ? "out" : "unanswered";
  const chosen = dinner.dishes.find((dish) => dish.id === dinner.chosenDishId);
  const ideas = rankDishes(dinner.dishes);
  const admin = membership.role === "admin";
  const toBuy = chosen ? chosen.ingredients.filter((ingredient) => !ingredient.atHome && !ingredient.boughtAt) : [];
  const untaken = toBuy.filter((ingredient) => !ingredient.claimedBy).length;
  // What those eating, and whoever is looking, do not eat: shown to the cook, and used for the offers.
  const table = await avoidsOfThoseComing(household.id, [...dinner.going, user.id]);
  const cannotHave = [...ruledOut(table.avoids)];

  const duties = [
    { duty: "cook" as const, title: "Cooking", holder: dinner.cookId, take: "I'll cook", doing: "cooking" },
    { duty: "cleaner" as const, title: "Cleaning up after", holder: dinner.cleanerId, take: "I'll clean up", doing: "cleaning up" },
  ];

  const dishSide = chosen ? (
    <section aria-labelledby="needs-heading" className="flex flex-col gap-4" data-testid="needs">
      <div className="flex flex-col gap-1">
        <h2 id="needs-heading" className="type-display text-3xl">
          What it needs
        </h2>
        <p className="text-ink-soft">{describeNeeds(chosen.ingredients)}</p>
      </div>
      {chosen.ingredients.length > 0 ? (
        <ul className="flex flex-col">
          {chosen.ingredients.map((ingredient) => (
            <IngredientRow key={ingredient.id} ingredient={ingredient} me={user.id} person={person} now={now} />
          ))}
        </ul>
      ) : null}
      <IngredientForm dishId={chosen.id} />
      <div className="flex flex-col gap-1 border-t-2 border-ink/15 pt-3">
        <p className="text-ink-soft">
          {dinner.decidedBy ? `${who(dinner.decidedBy)} decided on ${chosen.title}.` : `Decided on ${chosen.title}.`}
        </p>
        {mine === "in" ? (
          <ActionButton
            look="link"
            align="start"
            confirm="Open the vote again? What needs buying leaves the shopping list until a dish is decided. Who promised to buy what is remembered."
            action={chooseAction.bind(null, dinner.id, null)}
          >
            Open the vote again
          </ActionButton>
        ) : null}
      </div>
    </section>
  ) : (
    <section aria-labelledby="ideas-heading" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="ideas-heading" className="type-display text-3xl">
          {ideas.length === 0 ? "What should we eat?" : ideas.length === 1 ? "1 idea" : `${ideas.length} ideas`}
        </h2>
        <p className="text-ink-soft">
          {ideas.length === 0
            ? "Suggest a dish below, or get a few ideas. Everyone can vote."
            : "Vote for everything you would eat. When you agree, someone who is in presses Decide: that sets the dish and puts what it needs on the shopping list."}
        </p>
      </div>
      {ideas.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {ideas.map((dish, index) => {
            const voted = dish.votes.includes(user.id);
            const voters = dish.votes.map((userId) => person.get(userId)).filter((member) => member !== undefined);
            const mayRemove = admin || dish.suggestedBy === null || dish.suggestedBy === user.id;
            const leads = index === 0 && voters.length > 0 && (ideas.length === 1 || voters.length > ideas[1].votes.length);
            return (
              <li key={dish.id} data-testid="dish" data-voted={voted ? "yes" : "no"} className="flex flex-col gap-3 rounded-2xl border-2 border-ink p-5">
                <div className="flex flex-col gap-1">
                  <h3 className="text-2xl font-bold break-words">{dish.title}</h3>
                  <p className="flex flex-wrap items-center gap-x-2 text-ink-soft">
                    {dish.suggestedBy ? <Person person={person.get(dish.suggestedBy)} me={user.id} size="size-6" className="font-semibold text-ink" /> : "Someone who moved out"}
                    {dish.fromHelper ? "picked this from the ideas" : "suggested this"}
                  </p>
                </div>
                {dish.ingredients.length > 0 ? <p className="break-words">{dish.ingredients.map((ingredient) => ingredient.name).join(", ")}</p> : null}
                <div className="flex flex-wrap items-center gap-2">
                  <Faces people={voters} size="size-7" />
                  <span className="flex items-center gap-1 font-semibold">
                    {voters.length === 0 ? "No votes" : voters.length === 1 ? "1 vote" : `${voters.length} votes`}
                    {voted ? <Tick /> : null}
                  </span>
                  {leads ? <span className="rounded-full bg-salmon px-3 py-0.5 text-sm font-bold">In the lead</span> : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {voted ? (
                    <ActionButton align="start" label={`Take back my vote for ${dish.title}`} action={voteAction.bind(null, dish.id, false)}>
                      Take vote back
                    </ActionButton>
                  ) : (
                    <ActionButton look="filled" align="start" label={`Vote for ${dish.title}`} action={voteAction.bind(null, dish.id, true)}>
                      Vote
                    </ActionButton>
                  )}
                  {mine === "in" ? (
                    <ActionButton align="start" label={`Decide on ${dish.title}`} action={chooseAction.bind(null, dinner.id, dish.id)}>
                      Decide on this
                    </ActionButton>
                  ) : null}
                  {mayRemove ? (
                    <span className="ml-auto">
                      <ActionButton look="link" label={`Take ${dish.title} down`} confirm={`Take ${dish.title} down?`} action={removeDishAction.bind(null, dish.id)}>
                        Take down
                      </ActionButton>
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
      {mine !== "in" && ideas.length > 0 ? <p className="text-sm text-ink-soft">Say you&apos;re in to decide what is cooked.</p> : null}
      <div className="flex flex-col gap-4 rounded-3xl bg-salmon/25 p-5">
        <DishForm dinnerId={dinner.id} ruledOut={cannotHave} />
        <IdeasPanel dinnerId={dinner.id} />
      </div>
    </section>
  );

  return (
    <AreaPage area="dinner" eyebrow={when} back={BACK} title={chosen ? chosen.title : "What's for dinner?"} aside={dishSide}>
      <section aria-labelledby="stands-heading" className="flex flex-col gap-1 rounded-3xl bg-salmon/25 p-5" data-testid="stands">
        <h2 id="stands-heading" className="type-display text-2xl">
          Where this dinner stands
        </h2>
        <ul className="flex flex-col">
          <Step done={going.length > 1}>{going.length === 0 ? "Nobody is in yet" : going.length === 1 ? "1 is in" : `${going.length} are in`}</Step>
          <Step done={Boolean(chosen)}>
            {chosen ? `Decided: ${chosen.title}` : ideas.length === 0 ? "Nothing suggested yet" : `${ideas.length === 1 ? "1 idea" : `${ideas.length} ideas`}, not decided`}
          </Step>
          <Step done={Boolean(dinner.cookId)}>{dinner.cookId ? `${who(dinner.cookId)} ${dinner.cookId === user.id ? "cook" : "cooks"}` : "Nobody cooks yet"}</Step>
          <Step done={Boolean(dinner.cleanerId)}>
            {dinner.cleanerId ? `${who(dinner.cleanerId)} ${dinner.cleanerId === user.id ? "clean" : "cleans"} up` : "Nobody cleans up yet"}
          </Step>
          {chosen ? (
            <Step done={chosen.ingredients.length > 0 && toBuy.length === 0}>
              {chosen.ingredients.length === 0
                ? "Nothing listed to buy yet"
                : toBuy.length === 0
                  ? "Everything is in the house"
                  : `${toBuy.length === 1 ? "1 thing" : `${toBuy.length} things`} left to buy${untaken > 0 ? `, ${untaken} not taken` : ""}`}
            </Step>
          ) : null}
        </ul>
      </section>

      <section aria-labelledby="in-heading" className="flex flex-col gap-3" data-testid="whos-in" data-me={mine}>
        <h2 id="in-heading" className="type-display text-3xl">
          Who&apos;s in
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <Faces people={going} size="size-10" />
          <span className="text-lg font-semibold">
            {going.length === 0
              ? "Nobody yet."
              : `${listNames(going.map((member) => member.userId), user.id, nameOf)} ${going.length === 1 && going[0].userId !== user.id ? "is" : "are"} in.`}
          </span>
        </div>
        {out.length > 0 ? <p className="text-ink-soft">{listNames(out.map((member) => member.userId), user.id, nameOf)} can&apos;t make it.</p> : null}
        {waiting.length > 0 ? (
          <p className="text-ink-soft">No answer yet from {listNames(waiting.map((member) => member.userId), user.id, nameOf).replace(/^You\b/, "you")}.</p>
        ) : null}
        {table.avoids.length > 0 ? (
          <p data-testid="avoids">
            <span className="font-semibold">For the cook:</span> someone at the table doesn&apos;t eat {table.avoids.join("; ")}.
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {mine !== "in" ? (
            <ActionButton look="filled" align="start" label="I'm in for this dinner" action={goingAction.bind(null, dinner.id, true)}>
              {mine === "out" ? "I'm in after all" : "I'm in"}
            </ActionButton>
          ) : null}
          {mine !== "out" ? (
            <ActionButton align="start" label="I'm not coming to this dinner" action={goingAction.bind(null, dinner.id, false)}>
              {mine === "in" ? "Can't after all" : "Not this time"}
            </ActionButton>
          ) : null}
        </div>
      </section>

      <section aria-labelledby="duties-heading" className="flex flex-col gap-1" data-testid="duties">
        <h2 id="duties-heading" className="type-display text-3xl">
          Who does what
        </h2>
        <ul className="flex flex-col">
          {duties.map(({ duty, title, holder, take, doing }) => (
            <li key={duty} data-testid={`duty-${duty}`} className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink/15 py-3">
              <span className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-ink-soft">{title}</span>
                {holder ? <Person person={person.get(holder)} me={user.id} size="size-8" className="text-xl font-semibold" /> : <span className="text-xl font-semibold">Nobody yet</span>}
              </span>
              {!holder ? (
                <ActionButton look="filled" about="this dinner" action={dutyAction.bind(null, dinner.id, duty, true)}>
                  {take}
                </ActionButton>
              ) : holder === user.id ? (
                <ActionButton look="link" about={doing} action={dutyAction.bind(null, dinner.id, duty, false)}>
                  Not me after all
                </ActionButton>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <ActionButton
        look="link"
        align="start"
        confirm={chosen ? "Call off this dinner? What is not bought yet leaves the shopping list." : "Call off this dinner?"}
        action={cancelDinnerAction.bind(null, dinner.id, true)}
      >
        Call off this dinner
      </ActionButton>
    </AreaPage>
  );
}

function describeNeeds(ingredients: readonly Ingredient[]): string {
  if (ingredients.length === 0) return "Nothing listed yet. Add what needs buying below.";
  const toBuy = ingredients.filter((ingredient) => !ingredient.atHome && !ingredient.boughtAt);
  const unclaimed = toBuy.filter((ingredient) => !ingredient.claimedBy).length;
  if (toBuy.length === 0) return "Everything is in the house.";
  const buying = toBuy.length === 1 ? "1 thing to buy" : `${toBuy.length} things to buy`;
  return unclaimed === 0 ? `${buying}, all taken.` : `${buying}, ${unclaimed} that nobody has taken.`;
}

function IngredientRow({ ingredient, me, person, now }: { ingredient: Ingredient; me: string; person: Map<string, PersonLike>; now: Date }) {
  const { id, name, itemId } = ingredient;
  const state = ingredient.atHome ? "home" : ingredient.boughtAt ? "bought" : ingredient.claimedBy ? "claimed" : "open";
  const settled = state === "home" || state === "bought";
  const mine = ingredient.claimedBy === me;
  const holder = state === "bought" ? ingredient.boughtBy : state === "claimed" ? ingredient.claimedBy : null;
  const face = holder ? person.get(holder) : undefined;

  return (
    <li data-testid="ingredient" data-state={state} className={`flex flex-col gap-1 border-b-2 border-ink/15 px-3 py-3 ${mine && state === "claimed" ? "bg-salmon/25" : ""}`}>
      <div className="flex items-center justify-between gap-3">
        <span className={`min-w-0 text-xl font-semibold break-words ${settled ? "text-ink-soft" : ""}`}>
          {state === "bought" ? <Struck draw={isFresh(ingredient.boughtAt, now)}>{name}</Struck> : name}
        </span>
        {state === "open" && itemId ? (
          <ActionButton look="filled" about={name} action={claimIngredientAction.bind(null, itemId, true)}>
            I&apos;ll buy it
          </ActionButton>
        ) : state === "claimed" && itemId ? (
          <ActionButton look={mine ? "filled" : "outline"} about={name} action={gotIngredientAction.bind(null, itemId, true)}>
            Bought
          </ActionButton>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="flex items-center gap-2 text-ink-soft">
          {face ? <Avatar avatar={face.avatar} colour={face.colour} className="size-6" /> : null}
          {state === "home" ? (
            <>
              We have it <Tick />
            </>
          ) : state === "bought" ? (
            `${holder === me ? "You" : (face?.name ?? "Someone")} bought it.`
          ) : state === "claimed" ? (
            mine ? "You'll buy it." : `${face?.name ?? "Someone"} will buy it.`
          ) : (
            "Nobody is buying it yet."
          )}
        </span>
        <span className="ml-auto flex flex-wrap justify-end gap-x-4">
          {state === "claimed" && mine && itemId ? (
            <ActionButton look="link" about={name} action={claimIngredientAction.bind(null, itemId, false)}>
              Not me after all
            </ActionButton>
          ) : null}
          {state === "open" ? (
            <ActionButton look="link" about={name} action={atHomeAction.bind(null, id, true)}>
              We have it
            </ActionButton>
          ) : null}
          {state === "home" ? (
            <ActionButton look="link" about={name} action={atHomeAction.bind(null, id, false)}>
              Needs buying
            </ActionButton>
          ) : null}
          {state !== "bought" ? (
            <ActionButton look="link" about={name} confirm={`Take ${name} off this dish?`} action={removeIngredientAction.bind(null, id)}>
              Remove
            </ActionButton>
          ) : null}
        </span>
      </div>
    </li>
  );
}
