import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Avatar } from "@/components/avatar/avatar";
import { ExtraHeader } from "@/components/extras/extra-header";
import { ActionButton } from "@/components/ui/action-button";
import { clockLabel } from "@/lib/booking/status";
import { describeDinnerDay, rankDishes } from "@/lib/dinner/plan";
import { getDinner, type DinnerDetail } from "@/lib/dinner/service";
import { requireExtra } from "@/lib/extras-guard";
import { listMembers } from "@/lib/households";
import { listNames } from "@/lib/names";
import { dayInZone } from "@/lib/time";
import {
  absentAction,
  atHomeAction,
  cancelDinnerAction,
  chooseAction,
  claimIngredientAction,
  dutyAction,
  gotIngredientAction,
  removeDishAction,
  voteAction,
} from "../actions";
import { DishForm, IdeasPanel, IngredientForm } from "../dinner-forms";

// This screen depends on who is signed in, so it is rendered per request.
export const instant = false;

// Asking for dinner ideas waits on an AI answer, which can take longer than a page load.
export const maxDuration = 60;

export const metadata: Metadata = { title: "Dinner" };

const link =
  "flex min-h-11 w-fit items-center rounded font-bold underline underline-offset-4 outline-none focus-visible:ring-4 focus-visible:ring-fjord";

type Ingredient = DinnerDetail["dishes"][number]["ingredients"][number];

function Tick() {
  return (
    <svg viewBox="0 0 24 24" className="tick-draw size-5 shrink-0" aria-hidden="true">
      <path d="M4 13C7 15 9 17 10 19C13 13 17 8 21 5" pathLength={1} />
    </svg>
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

  const today = dayInZone(new Date(), household.timeZone);
  const when = `${describeDinnerDay(dinner.day, today)}, ${clockLabel(dinner.time)}`;
  const person = new Map(members.map((member) => [member.userId, member]));
  const nameOf = (userId: string | null) => (userId ? person.get(userId)?.name : undefined) ?? "Someone";
  const who = (userId: string | null) => (userId === user.id ? "You" : nameOf(userId));

  const coming = members.filter((member) => !dinner.absent.includes(member.userId));
  const out = members.filter((member) => dinner.absent.includes(member.userId));
  const meOut = dinner.absent.includes(user.id);
  const chosen = dinner.dishes.find((dish) => dish.id === dinner.chosenDishId);
  const ideas = rankDishes(dinner.dishes);
  const admin = membership.role === "admin";

  if (dinner.cancelled) {
    return (
      <main className="mx-auto flex max-w-md flex-col gap-6 p-6 pt-10">
        <Link href="/dinner" className={link}>
          All dinners
        </Link>
        <ExtraHeader art="dinner" eyebrow={when}>
          Called off
        </ExtraHeader>
        <p className="text-lg text-ink-soft">Nobody is cooking this one. What was on it is kept, in case it is back on.</p>
        <ActionButton look="filled" align="start" action={cancelDinnerAction.bind(null, dinner.id, false)}>
          Bring it back
        </ActionButton>
      </main>
    );
  }

  const duties = [
    { duty: "cook" as const, title: "Cooking", holder: dinner.cookId, take: "I'll cook", takeLabel: "I'll cook this dinner" },
    { duty: "cleaner" as const, title: "Cleaning up after", holder: dinner.cleanerId, take: "I'll clean up", takeLabel: "I'll clean up after this dinner" },
  ];

  return (
    <main className="mx-auto flex max-w-md flex-col gap-8 p-6 pt-10">
      <Link href="/dinner" className={link}>
        All dinners
      </Link>
      <ExtraHeader art="dinner" eyebrow={when}>
        {chosen ? chosen.title : "What's for dinner?"}
      </ExtraHeader>

      <section aria-labelledby="in-heading" className="flex flex-col gap-3" data-testid="whos-in" data-me={meOut ? "out" : "in"}>
        <h2 id="in-heading" className="type-display text-3xl">
          Who&apos;s in
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex -space-x-2">
            {coming.map((member) => (
              <Avatar key={member.userId} avatar={member.avatar} colour={member.colour} className="size-9 border-2 border-paper" />
            ))}
          </span>
          <span className="font-semibold">
            {coming.length === 0
              ? "Nobody is in."
              : `${listNames(coming.map((member) => member.userId), user.id, nameOf)} ${coming.length === 1 && coming[0].userId !== user.id ? "is" : "are"} in.`}
          </span>
        </div>
        {out.length > 0 ? (
          <p className="text-ink-soft">
            {listNames(out.map((member) => member.userId), user.id, nameOf)} {out.length === 1 && out[0].userId !== user.id ? "is" : "are"} out.
          </p>
        ) : null}
        {meOut ? (
          <ActionButton look="filled" align="start" label="I'm in for this dinner after all" action={absentAction.bind(null, dinner.id, false)}>
            I&apos;m in after all
          </ActionButton>
        ) : (
          <ActionButton align="start" label="I'm out of this dinner" action={absentAction.bind(null, dinner.id, true)}>
            I&apos;m out
          </ActionButton>
        )}
      </section>

      <section aria-labelledby="duties-heading" className="flex flex-col gap-1" data-testid="duties">
        <h2 id="duties-heading" className="type-display text-3xl">
          Who does what
        </h2>
        <ul className="flex flex-col">
          {duties.map(({ duty, title, holder, take, takeLabel }) => (
            <li key={duty} data-testid={`duty-${duty}`} className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink/15 py-3">
              <span className="flex flex-col">
                <span className="text-sm font-semibold text-ink-soft">{title}</span>
                <span className="flex items-center gap-2 text-xl font-semibold">
                  {holder ? (
                    <>
                      <Avatar avatar={person.get(holder)?.avatar} colour={person.get(holder)?.colour ?? "var(--color-ink-soft)"} className="size-7" />
                      {who(holder)}
                    </>
                  ) : (
                    "Nobody yet"
                  )}
                </span>
              </span>
              {!holder ? (
                <ActionButton look="filled" label={takeLabel} action={dutyAction.bind(null, dinner.id, duty, true)}>
                  {take}
                </ActionButton>
              ) : holder === user.id ? (
                <ActionButton look="link" label={`Not ${duty === "cook" ? "cooking" : "cleaning up"} after all`} action={dutyAction.bind(null, dinner.id, duty, false)}>
                  Not me after all
                </ActionButton>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {chosen ? (
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
                <IngredientRow key={ingredient.id} ingredient={ingredient} me={user.id} who={who} />
              ))}
            </ul>
          ) : null}
          <IngredientForm dishId={chosen.id} count={chosen.ingredients.length} />
          <ActionButton look="link" align="start" label="Open the vote again" action={chooseAction.bind(null, dinner.id, null)}>
            Changed your minds? Open the vote again
          </ActionButton>
        </section>
      ) : (
        <section aria-labelledby="ideas-heading" className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 id="ideas-heading" className="type-display text-3xl">
              {ideas.length === 0 ? "No ideas yet" : ideas.length === 1 ? "1 idea" : `${ideas.length} ideas`}
            </h2>
            <p className="text-ink-soft">Vote for everything you would eat. When you agree, go with one.</p>
          </div>
          {ideas.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {ideas.map((dish) => {
                const voted = dish.votes.includes(user.id);
                const voters = dish.votes.map((userId) => person.get(userId)).filter((member) => member !== undefined);
                const mayRemove = admin || dish.suggestedBy === null || dish.suggestedBy === user.id;
                return (
                  <li key={dish.id} data-testid="dish" data-voted={voted ? "yes" : "no"} className="flex flex-col gap-3 rounded-2xl border-2 border-ink p-5">
                    <div className="flex flex-col gap-1">
                      <h3 className="type-display text-3xl break-words">{dish.title}</h3>
                      <p className="text-ink-soft">
                        {dish.suggestedBy === null ? "From the ideas" : dish.suggestedBy === user.id ? "Your idea" : `${nameOf(dish.suggestedBy)}'s idea`}
                      </p>
                    </div>
                    {dish.ingredients.length > 0 ? (
                      <p className="break-words">{dish.ingredients.map((ingredient) => ingredient.name).join(", ")}</p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex -space-x-2">
                        {voters.map((member) => (
                          <Avatar key={member.userId} avatar={member.avatar} colour={member.colour} className="size-7 border-2 border-paper" />
                        ))}
                      </span>
                      <span className="flex items-center gap-1 font-semibold">
                        {voters.length === 0 ? "No votes" : voters.length === 1 ? "1 vote" : `${voters.length} votes`}
                        {voted ? <Tick /> : null}
                      </span>
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
                      <ActionButton align="start" label={`Go with ${dish.title}`} action={chooseAction.bind(null, dinner.id, dish.id)}>
                        Go with this
                      </ActionButton>
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
          <DishForm dinnerId={dinner.id} count={dinner.dishes.length} />
          <IdeasPanel dinnerId={dinner.id} />
        </section>
      )}

      <ActionButton look="link" align="start" confirm="Call off this dinner?" action={cancelDinnerAction.bind(null, dinner.id, true)}>
        Call off this dinner
      </ActionButton>
    </main>
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

function IngredientRow({ ingredient, me, who }: { ingredient: Ingredient; me: string; who: (userId: string | null) => string }) {
  const { id, name, itemId } = ingredient;
  const state = ingredient.atHome ? "home" : ingredient.boughtAt ? "bought" : ingredient.claimedBy ? "claimed" : "open";
  const settled = state === "home" || state === "bought";
  const mine = ingredient.claimedBy === me;

  return (
    <li data-testid="ingredient" data-state={state} className="flex flex-col gap-1 border-b-2 border-ink/15 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className={`relative min-w-0 text-xl font-semibold break-words ${settled ? "text-ink-soft" : ""}`}>
          {name}
          {state === "bought" ? (
            <svg className="strike" viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden="true">
              <path pathLength={1} d="M1 12C20 7 42 15 60 10C76 6 90 13 99 9" />
            </svg>
          ) : null}
        </span>
        {state === "open" && itemId ? (
          <ActionButton look="filled" label={`I'll buy ${name}`} action={claimIngredientAction.bind(null, itemId, true)}>
            I&apos;ll buy it
          </ActionButton>
        ) : state === "claimed" && itemId ? (
          <ActionButton look={mine ? "filled" : "outline"} label={`Got ${name}`} action={gotIngredientAction.bind(null, itemId, true)}>
            Got it
          </ActionButton>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="flex items-center gap-1 text-ink-soft">
          {state === "home" ? (
            <>
              We have it <Tick />
            </>
          ) : state === "bought" ? (
            `${who(ingredient.boughtBy)} got it.`
          ) : state === "claimed" ? (
            mine ? "You'll buy it." : `${who(ingredient.claimedBy)} will buy it.`
          ) : (
            "Nobody is buying it yet."
          )}
        </span>
        <span className="ml-auto flex gap-4">
          {state === "claimed" && mine && itemId ? (
            <ActionButton look="link" label={`Not buying ${name} after all`} action={claimIngredientAction.bind(null, itemId, false)}>
              Not me after all
            </ActionButton>
          ) : null}
          {state === "open" ? (
            <ActionButton look="link" label={`We have ${name}`} action={atHomeAction.bind(null, id, true)}>
              We have it
            </ActionButton>
          ) : null}
          {state === "home" ? (
            <ActionButton look="link" label={`${name} needs buying`} action={atHomeAction.bind(null, id, false)}>
              Needs buying
            </ActionButton>
          ) : null}
        </span>
      </div>
    </li>
  );
}
