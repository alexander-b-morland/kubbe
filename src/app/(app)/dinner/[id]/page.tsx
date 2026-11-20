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
  claimAllAction,
  claimIngredientAction,
  dutyAction,
  goingAction,
  gotIngredientAction,
  removeDishAction,
  removeIngredientAction,
  voteAction,
} from "../actions";
import { DishForm, IngredientForm } from "../dinner-forms";
import { m, type Translate } from "@/lib/i18n";
import { getT } from "@/lib/i18n/server";

// This screen depends on who is signed in, so it is rendered per request.
export const instant = false;

// Asking for dinner ideas waits on an AI answer, which can take longer than a page load.
export const maxDuration = 60;

export const metadata: Metadata = { title: "Dinner" };

const BACK = { href: "/dinner", label: m("All dinners") };

type Ingredient = DinnerDetail["dishes"][number]["ingredients"][number];

function Tick() {
  return (
    <svg viewBox="0 0 24 24" className="tick-draw size-5 shrink-0" aria-hidden="true">
      <path d="M4 13C7 15 9 17 10 19C13 13 17 8 21 5" pathLength={1} />
    </svg>
  );
}

/** One line of "where this dinner stands": what it is about, how it stands, and a drawn tick once it is sorted. */
async function Fact({ label, done, children }: { label: string; done: boolean; children: React.ReactNode }) {
  const t = await getT();
  return (
    <div data-done={done ? "yes" : "no"} className="grid grid-cols-[1.5rem_6.5rem_1fr] items-start gap-x-3 py-1.5 sm:grid-cols-[1.5rem_8rem_1fr]">
      <span className={`mt-0.5 flex size-6 items-center justify-center rounded-full border-2 border-ink ${done ? "bg-ink text-paper" : ""}`} aria-hidden="true">
        {done ? (
          <svg viewBox="0 0 24 24" className="size-4">
            <path d="M4 13C7 15 9 17 10 19C13 13 17 8 21 5" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
      </span>
      <dt className="pt-0.5 text-sm font-semibold text-ink-soft">
        <span className="sr-only">{done ? t("Done: ") : t("Not yet: ")}</span>
        {label}
      </dt>
      <dd className={`min-w-0 break-words ${done ? "font-semibold" : ""}`}>{children}</dd>
    </div>
  );
}

export default async function DinnerPage({ params }: PageProps<"/dinner/[id]">) {
  const t = await getT();
  const { user, household, membership } = await requireExtra("dinner");
  const { id } = await params;
  // Looked up inside the caller's household: an id from anywhere else finds nothing.
  const [dinner, members] = z.uuid().safeParse(id).success
    ? await Promise.all([getDinner(household.id, id), listMembers(household.id)])
    : [null, []];
  if (!dinner) notFound();

  const now = new Date();
  const today = dayInZone(now, household.timeZone);
  const when = `${describeDinnerDay(dinner.day, today, t)}, ${clockLabel(dinner.time)}`;
  const person = new Map<string, PersonLike>(members.map((member) => [member.userId, member]));
  const nameOf = (userId: string | null) => (userId ? person.get(userId)?.name : undefined) ?? t("Someone");
  const who = (userId: string | null) => (userId === user.id ? t("You") : nameOf(userId));

  if (dinner.cancelled) {
    return (
      <AreaPage area="dinner" eyebrow={when} back={BACK} title={t("Called off")}>
        <p className="text-lg">{t("Nobody is cooking this one. What was on it is kept, in case it is back on.")}</p>
        <ActionButton look="filled" align="start" action={cancelDinnerAction.bind(null, dinner.id, false)}>
          {t("Bring it back")}
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
    { duty: "cook" as const, title: t("Cooking"), holder: dinner.cookId, take: t("I'll cook"), doing: t("cooking") },
    { duty: "cleaner" as const, title: t("Cleaning up after"), holder: dinner.cleanerId, take: t("I'll clean up"), doing: t("cleaning up") },
  ];

  const dishSide = chosen ? (
    <section aria-labelledby="needs-heading" className="flex flex-col gap-4" data-testid="needs">
      <div className="flex flex-col gap-1">
        <h2 id="needs-heading" className="type-display text-3xl">
          {t("What it needs")}
        </h2>
        <p className="text-ink-soft">{describeNeeds(chosen.ingredients, t)}</p>
      </div>
      {chosen.ingredients.length > 0 ? (
        <ul className="flex flex-col">
          {chosen.ingredients.map((ingredient) => (
            <IngredientRow key={ingredient.id} ingredient={ingredient} me={user.id} person={person} now={now} />
          ))}
        </ul>
      ) : null}
      {untaken > 1 ? (
        <ActionButton look="filled" align="start" about={chosen.title} action={claimAllAction.bind(null, chosen.id)}>
          {t`I'll buy everything left (${untaken})`}
        </ActionButton>
      ) : null}
      <IngredientForm dishId={chosen.id} />
      <div className="flex flex-col gap-1 border-t-2 border-ink/15 pt-3">
        <p className="text-ink-soft">
          {dinner.decidedBy ? t`${who(dinner.decidedBy)} decided on ${chosen.title}.` : t`Decided on ${chosen.title}.`}
        </p>
        {mine === "in" ? (
          <ActionButton
            look="link"
            align="start"
            confirm={t("Open the vote again? What needs buying leaves the shopping list until a dish is decided. Who promised to buy what is remembered.")}
            action={chooseAction.bind(null, dinner.id, null)}
          >
            {t("Open the vote again")}
          </ActionButton>
        ) : null}
      </div>
    </section>
  ) : (
    <section aria-labelledby="ideas-heading" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="ideas-heading" className="type-display text-3xl">
          {ideas.length === 0 ? t("What should we eat?") : ideas.length === 1 ? t("1 idea") : t`${ideas.length} ideas`}
        </h2>
        <p className="text-ink-soft">
          {ideas.length === 0
            ? t("Suggest a dish below, or get a few ideas. Everyone can vote.")
            : t("Vote for everything you would eat. When you agree, someone who is in presses Decide: that sets the dish and puts what it needs on the shopping list.")}
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
                    {dish.suggestedBy ? <Person person={person.get(dish.suggestedBy)} me={user.id} size="size-6" className="font-semibold text-ink" /> : t("Someone who moved out")}
                    {dish.fromHelper ? t("picked this from the ideas") : t("suggested this")}
                  </p>
                </div>
                {dish.ingredients.length > 0 ? <p className="break-words">{dish.ingredients.map((ingredient) => ingredient.name).join(", ")}</p> : null}
                <div className="flex flex-wrap items-center gap-2">
                  <Faces people={voters} size="size-7" />
                  <span className="flex items-center gap-1 font-semibold">
                    {voters.length === 0 ? t("No votes") : voters.length === 1 ? t("1 vote") : t`${voters.length} votes`}
                    {voted ? <Tick /> : null}
                  </span>
                  {leads ? <span className="rounded-full bg-salmon px-3 py-0.5 text-sm font-bold">{t("In the lead")}</span> : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {voted ? (
                    <ActionButton align="start" label={t`Take back my vote for ${dish.title}`} action={voteAction.bind(null, dish.id, false)}>
                      {t("Take vote back")}
                    </ActionButton>
                  ) : (
                    <ActionButton look="filled" align="start" label={t`Vote for ${dish.title}`} action={voteAction.bind(null, dish.id, true)}>
                      {t("Vote")}
                    </ActionButton>
                  )}
                  {mine === "in" ? (
                    <ActionButton align="start" label={t`Decide on ${dish.title}`} action={chooseAction.bind(null, dinner.id, dish.id)}>
                      {t("Decide on this")}
                    </ActionButton>
                  ) : null}
                  {mayRemove ? (
                    <span className="ml-auto">
                      <ActionButton look="link" label={t`Take ${dish.title} down`} confirm={t`Take ${dish.title} down?`} action={removeDishAction.bind(null, dish.id)}>
                        {t("Take down")}
                      </ActionButton>
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
      {mine !== "in" && ideas.length > 0 ? <p className="text-sm text-ink-soft">{t("Say you're in to decide what is cooked.")}</p> : null}
      <div className="flex flex-col gap-4 rounded-3xl bg-salmon/25 p-5">
        <DishForm dinnerId={dinner.id} ruledOut={cannotHave} />
      </div>
    </section>
  );

  return (
    <AreaPage area="dinner" eyebrow={when} back={BACK} title={chosen ? chosen.title : t("What's for dinner?")} aside={dishSide}>
      <section aria-labelledby="stands-heading" className="flex flex-col gap-1 rounded-3xl bg-salmon/25 p-5" data-testid="stands">
        <h2 id="stands-heading" className="type-display text-2xl">
          {t("Where this dinner stands")}
        </h2>
        <dl className="flex flex-col">
          <Fact label={t("Who's eating")} done={going.length > 1}>
            {going.length === 0 ? t("Nobody has said yes yet") : listNames(going.map((member) => member.userId), user.id, nameOf, t)}
            {waiting.length > 0 ? <span className="block text-sm font-normal text-ink-soft">{waiting.length === 1 ? t("1 hasn't answered") : t`${waiting.length} haven't answered`}</span> : null}
          </Fact>
          <Fact label={t("What")} done={Boolean(chosen)}>
            {chosen ? chosen.title : ideas.length === 0 ? t("Nothing suggested yet") : ideas.length === 1 ? t("1 idea, not decided") : t`${ideas.length} ideas, not decided`}
          </Fact>
          <Fact label={t("Cooking")} done={Boolean(dinner.cookId)}>
            {dinner.cookId ? who(dinner.cookId) : t("Nobody yet")}
          </Fact>
          <Fact label={t("Cleaning up")} done={Boolean(dinner.cleanerId)}>
            {dinner.cleanerId ? who(dinner.cleanerId) : t("Nobody yet")}
          </Fact>
          {chosen ? (
            <Fact label={t("Shopping")} done={chosen.ingredients.length > 0 && toBuy.length === 0}>
              {chosen.ingredients.length === 0
                ? t("Nothing listed to buy yet")
                : toBuy.length === 0
                  ? t("Everything is in the house")
                  : untaken > 0
                    ? t`${toBuy.length === 1 ? t("1 thing left to buy") : t`${toBuy.length} things left to buy`}, ${untaken} not taken`
                    : toBuy.length === 1
                      ? t("1 thing left to buy")
                      : t`${toBuy.length} things left to buy`}
            </Fact>
          ) : null}
        </dl>
      </section>

      <section aria-labelledby="in-heading" className="flex flex-col gap-3" data-testid="whos-in" data-me={mine}>
        <h2 id="in-heading" className="type-display text-3xl">
          {t("Who's in")}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <Faces people={going} size="size-10" />
          <span className="text-lg font-semibold">
            {going.length === 0
              ? t("Nobody yet.")
              : t`${listNames(going.map((member) => member.userId), user.id, nameOf, t)} ${going.length === 1 && going[0].userId !== user.id ? "is" : "are"} in.`}
          </span>
        </div>
        {out.length > 0 ? <p className="text-ink-soft">{listNames(out.map((member) => member.userId), user.id, nameOf, t)}{t(" can't make it.")}</p> : null}
        {waiting.length > 0 ? (
          <p className="text-ink-soft">{t("No answer yet from ")}{listNames(waiting.map((member) => member.userId), user.id, nameOf, t, true)}.</p>
        ) : null}
        {table.avoids.length > 0 ? (
          <p data-testid="avoids">
            <span className="font-semibold">{t("For the cook:")}</span>{t` someone at the table doesn't eat ${table.avoids.join("; ")}`}.
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {mine !== "in" ? (
            <ActionButton look="filled" align="start" label={t("I'm in for this dinner")} action={goingAction.bind(null, dinner.id, true)}>
              {mine === "out" ? t("I'm in after all") : t("I'm in")}
            </ActionButton>
          ) : null}
          {mine !== "out" ? (
            <ActionButton align="start" label={t("I'm not coming to this dinner")} action={goingAction.bind(null, dinner.id, false)}>
              {mine === "in" ? t("Can't after all") : t("Not this time")}
            </ActionButton>
          ) : null}
        </div>
      </section>

      <section aria-labelledby="duties-heading" className="flex flex-col gap-1" data-testid="duties">
        <h2 id="duties-heading" className="type-display text-3xl">
          {t("Who does what")}
        </h2>
        <ul className="flex flex-col">
          {duties.map(({ duty, title, holder, take, doing }) => (
            <li key={duty} data-testid={`duty-${duty}`} className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink/15 py-3">
              <span className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-ink-soft">{title}</span>
                {holder ? <Person person={person.get(holder)} me={user.id} size="size-8" className="text-xl font-semibold" /> : <span className="text-xl font-semibold">{t("Nobody yet")}</span>}
              </span>
              {!holder ? (
                <ActionButton look="filled" about="this dinner" action={dutyAction.bind(null, dinner.id, duty, true)}>
                  {take}
                </ActionButton>
              ) : holder === user.id ? (
                <ActionButton look="link" about={doing} action={dutyAction.bind(null, dinner.id, duty, false)}>
                  {t("Not me after all")}
                </ActionButton>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <ActionButton
        look="link"
        align="start"
        confirm={chosen ? t("Call off this dinner? What is not bought yet leaves the shopping list.") : t("Call off this dinner?")}
        action={cancelDinnerAction.bind(null, dinner.id, true)}
      >
        {t("Call off this dinner")}
      </ActionButton>
    </AreaPage>
  );
}

function describeNeeds(ingredients: readonly Ingredient[], t: Translate): string {
  if (ingredients.length === 0) return t("Nothing listed yet. Add what needs buying below.");
  const toBuy = ingredients.filter((ingredient) => !ingredient.atHome && !ingredient.boughtAt);
  const unclaimed = toBuy.filter((ingredient) => !ingredient.claimedBy).length;
  if (toBuy.length === 0) return t("Everything is in the house.");
  const buying = toBuy.length === 1 ? t("1 thing to buy") : t`${toBuy.length} things to buy`;
  return unclaimed === 0 ? t`${buying}, all taken.` : t`${buying}, ${unclaimed} that nobody has taken.`;
}

async function IngredientRow({ ingredient, me, person, now }: { ingredient: Ingredient; me: string; person: Map<string, PersonLike>; now: Date }) {
  const t = await getT();
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
            {t("I'll buy it")}
          </ActionButton>
        ) : state === "claimed" && itemId ? (
          <ActionButton look={mine ? "filled" : "outline"} about={name} action={gotIngredientAction.bind(null, itemId, true)}>
            {t("Bought")}
          </ActionButton>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="flex items-center gap-2 text-ink-soft">
          {face ? <Avatar avatar={face.avatar} colour={face.colour} className="size-6" /> : null}
          {state === "home" ? (
            <>
              {t("We have it ")}<Tick />
            </>
          ) : state === "bought" ? (
            t`${holder === me ? "You" : (face?.name ?? "Someone")} bought it.`
          ) : state === "claimed" ? (
            mine ? t("You'll buy it.") : t`${face?.name ?? "Someone"} will buy it.`
          ) : (
            t("Nobody is buying it yet.")
          )}
        </span>
        <span className="ml-auto flex flex-wrap justify-end gap-x-4">
          {state === "claimed" && mine && itemId ? (
            <ActionButton look="link" about={name} action={claimIngredientAction.bind(null, itemId, false)}>
              {t("Not me after all")}
            </ActionButton>
          ) : null}
          {state === "open" ? (
            <ActionButton look="link" about={name} action={atHomeAction.bind(null, id, true)}>
              {t("We have it")}
            </ActionButton>
          ) : null}
          {state === "home" ? (
            <ActionButton look="link" about={name} action={atHomeAction.bind(null, id, false)}>
              {t("Needs buying")}
            </ActionButton>
          ) : null}
          {state !== "bought" ? (
            <ActionButton look="link" about={name} confirm={t`Take ${name} off this dish?`} action={removeIngredientAction.bind(null, id)}>
              {t("Remove")}
            </ActionButton>
          ) : null}
        </span>
      </div>
    </li>
  );
}
