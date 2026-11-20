import { neon } from "@neondatabase/serverless";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

// Accounts from this run use the @kubbe.test pattern, so they can be removed afterwards.
const run = Date.now().toString(36);
// Each test signs up its own pair, so each pair needs addresses of its own.
let pair = 0;
const email = (who: string) => `e2e-${who}-${run}${pair}@kubbe.test`;
const password = "correct-horse-battery";
const shot = (name: string) => ({ path: `test-shots/${name}.png`, fullPage: true, caret: "initial" as const, animations: "disabled" as const });

async function signUp(page: Page, name: string, who: string) {
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email").fill(email(who));
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
}

/** Ida starts a household and Knut joins it. Both end up signed in, on their own pages. */
async function twoRoommates(browser: Browser) {
  pair += 1;
  const ida = await (await browser.newContext()).newPage();
  await ida.goto("/sign-up");
  await signUp(ida, "Ida", "ida");
  await ida.getByLabel("Household name").fill("Kollektivet");
  await ida.getByRole("button", { name: "Create household" }).click();
  await expect(ida).toHaveURL(/\/home$/);
  const code = (await ida.getByTestId("join-code").innerText()).replace(/\s/g, "");

  const knut = await (await browser.newContext()).newPage();
  await knut.goto(`/join/${code}`);
  await knut.getByRole("link", { name: "Create account" }).click();
  await signUp(knut, "Knut", "knut");
  await expect(knut).toHaveURL(/\/home$/);
  return { ida, knut };
}

// Next.js keeps the previous screen in the page, hidden, so only look at what is visible.
const seen = (page: Page, id: string) => page.getByTestId(id).filter({ visible: true });
const headline = (page: Page) => seen(page, "headline");
const notes = (page: Page) => seen(page, "note");
const nav = (page: Page, name: string) => page.getByRole("navigation", { name: "Main" }).getByRole("link", { name, exact: true });
/** Open an area the way a person does: Home, then its tile. */
async function openArea(page: Page, key: string) {
  if (!/\/home$/.test(page.url())) await nav(page, "Home").click();
  await seen(page, `band-${key}`).click();
  await expect(page).toHaveURL(new RegExp(`/${key}$`));
}
/** The way back at the top of every screen below Home. */
async function back(page: Page, to: RegExp) {
  await seen(page, "back").click();
  await expect(page).toHaveURL(to);
}

// A network blip during clean-up must not leave test accounts behind, so it is retried.
test.afterAll(async () => {
  const sql = neon(process.env.DATABASE_URL!);
  for (let attempt = 1; ; attempt++) {
    try {
      await sql`delete from household where created_by in (select id from "user" where email like 'e2e-%@kubbe.test')`;
      await sql`delete from "user" where email like 'e2e-%@kubbe.test'`;
      return;
    } catch (error) {
      if (attempt === 4) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
    }
  }
});

test("the noticeboard holds notes and to-dos", async ({ browser }) => {
  const { ida, knut } = await twoRoommates(browser);

  await openArea(ida, "board");
  await expect(headline(ida)).toHaveText("Nothing up yet");

  // A plain note.
  await ida.getByLabel("Write on the board").fill("Landlord is coming Tuesday at 10.");
  await ida.getByRole("button", { name: "Put it up" }).click();
  await expect(notes(ida)).toHaveCount(1);
  await expect(notes(ida).first()).toHaveAttribute("data-state", "note");

  // Something that needs doing, given to Knut.
  await ida.getByLabel("Write on the board").fill("Buy a new shower curtain");
  await ida.getByLabel("Something that needs doing").check();
  await ida.getByLabel("Who should do it").selectOption({ label: "Knut" });
  await ida.getByRole("button", { name: "Put it up" }).click();
  await expect(headline(ida)).toHaveText("1 thing to do");
  await expect(notes(ida).first()).toContainText("For Knut");
  // The next note starts as a plain one again.
  await expect(ida.getByLabel("Something that needs doing")).not.toBeChecked();
  await ida.screenshot(shot("b1-board"));

  // Knut sees it as his on Home, among the notes on the board there, and ticks it off.
  await knut.reload();
  await expect(seen(knut, "todo")).toContainText("Buy a new shower curtain");
  await expect(seen(knut, "board-preview")).toContainText("Landlord is coming Tuesday at 10.");
  await expect(seen(knut, "band-board")).toContainText("1 for you");
  await seen(knut, "todo").getByRole("link", { name: /shower curtain/ }).click();
  // The link lands on the note itself.
  await expect(knut).toHaveURL(/\/board#[0-9a-f-]{36}$/);
  const curtain = notes(knut).filter({ hasText: "shower curtain" });
  await expect(curtain).toContainText("For you");
  // Each note says who put it up and when.
  await expect(curtain).toContainText(/Ida, (just now|1 min ago)/);
  // A thumbs-up on the landlord note, and it can be taken back.
  const thumbs = notes(knut).filter({ hasText: "Landlord" }).getByTestId("thumbs-up");
  await thumbs.click();
  await expect(thumbs).toHaveAttribute("aria-pressed", "true");
  await expect(thumbs).toHaveText("1");
  // He did not write the other note and is not an admin, so he cannot take it down.
  await expect(notes(knut).filter({ hasText: "Landlord" }).getByRole("button", { name: /^Take down/ })).toHaveCount(0);
  await curtain.getByRole("button", { name: "Done: Buy a new shower curtain" }).click();
  await expect(curtain).toHaveAttribute("data-state", "done");
  await expect(curtain).toContainText("Done by you");
  // Nothing is left to do, so the headline counts what is up.
  await expect(headline(knut)).toHaveText("1 note");
  await back(knut, /\/home$/);
  await expect(seen(knut, "todo")).toContainText("Nothing waiting on you");

  // Ida takes her note down. It asks first.
  await ida.reload();
  const landlord = notes(ida).filter({ hasText: "Landlord" });
  await expect(landlord.getByTestId("thumbs-up")).toHaveText("1");
  // The red cross asks first, on the note itself.
  await landlord.getByRole("button", { name: "Take down: Landlord is coming Tuesday at 10." }).click();
  await expect(landlord).toBeVisible();
  await expect(landlord).toContainText("Take it down?");
  await landlord.getByRole("button", { name: "Take down", exact: true }).click();
  await expect(notes(ida).filter({ hasText: "Landlord" })).toHaveCount(0);
});

test("shopping leads to expenses, and expenses to being square", async ({ browser }) => {
  test.slow();
  const { ida, knut } = await twoRoommates(browser);
  const items = (page: Page) => seen(page, "item");

  // --- Ida writes the list ---
  await openArea(ida, "shopping");
  await expect(headline(ida)).toHaveText("Nothing to buy");
  for (const thing of ["Oat milk", "Bread"]) {
    await ida.getByLabel("Add to the list").fill(thing);
    await ida.getByRole("button", { name: "Add", exact: true }).click();
    await expect(items(ida).filter({ hasText: thing })).toBeVisible();
  }
  await expect(headline(ida)).toHaveText("2 to buy");

  // --- Knut says he will buy the milk, then buys both ---
  await openArea(knut, "shopping");
  await knut.getByRole("button", { name: "I'll buy it: Oat milk" }).click();
  await expect(items(knut).filter({ hasText: "Oat milk" })).toContainText("You'll buy it.");
  await ida.reload();
  await expect(items(ida).filter({ hasText: "Oat milk" })).toContainText("Knut will buy it.");
  // What someone has taken is theirs: nobody else is offered it.
  await expect(ida.getByRole("button", { name: "I'll buy it: Oat milk" })).toHaveCount(0);
  await ida.screenshot(shot("m1-shopping"));

  await knut.getByRole("button", { name: "Bought: Oat milk" }).click();
  await expect(items(knut)).toHaveCount(1);
  await knut.getByRole("button", { name: "Bought: Bread" }).click();
  await expect(headline(knut)).toHaveText("Nothing to buy");
  const bag = seen(knut, "bag");
  await expect(bag.getByRole("heading")).toHaveText("You got 2 things");

  // A nonsense amount is refused with a reason.
  await bag.getByLabel("What did you pay for these?").fill("lots");
  await bag.getByRole("button", { name: "Split the cost" }).click();
  await expect(bag.getByTestId("form-error")).toContainText("Enter what you paid");
  await knut.screenshot(shot("m2-bag"));

  // --- What he paid becomes an expense, split between the two ---
  await bag.getByLabel("What did you pay for these?").fill("100");
  await bag.getByRole("button", { name: "Split the cost" }).click();
  await expect(seen(knut, "bag")).toHaveCount(0);
  await knut.getByRole("link", { name: "See who owes whom" }).click();
  await expect(headline(knut)).toHaveText("You're owed 50 kr");
  await expect(seen(knut, "expense").first()).toContainText("Shopping: Oat milk, Bread");

  // --- Home shows the money both ways: who you owe, and who owes you ---
  await back(ida, /\/home$/);
  await expect(seen(ida, "money")).toContainText("You owe");
  await expect(seen(ida, "money")).toContainText("Knut");
  await expect(seen(ida, "money")).toContainText("50 kr");
  await expect(seen(ida, "band-expenses")).toContainText("You owe 50 kr");
  await knut.goto("/home");
  await expect(seen(knut, "money")).toContainText("Owes you");
  await expect(seen(knut, "money")).toContainText("Ida");
  await knut.goto("/expenses");
  await expect(headline(knut)).toHaveText("You're owed 50 kr");

  // --- Ida pays, and marks it ---
  await seen(ida, "money").getByRole("link").click();
  await expect(headline(ida)).toHaveText("You owe 50 kr");
  const settle = seen(ida, "settle");
  await expect(settle).toContainText("You pay Knut 50 kr");
  await ida.screenshot(shot("m3-expenses"));
  await settle.getByRole("button", { name: "Paid: You pay Knut 50 kr" }).click();
  await settle.getByRole("button", { name: "Mark 50 kr as paid?" }).click();
  await expect(headline(ida)).toHaveText("All square");

  // --- Knut still has the debt on his screen. Marking it paid again records nothing. ---
  await expect(headline(knut)).toHaveText("You're owed 50 kr");
  await seen(knut, "settle").getByRole("button", { name: "Paid: Ida pays you 50 kr" }).click();
  await knut.getByRole("button", { name: "Mark 50 kr as paid?" }).click();
  await expect(headline(knut)).toHaveText("All square");
  await ida.reload();
  await expect(headline(ida)).toHaveText("All square");

  // --- An expense that never was on the list, split evenly ---
  const add = seen(ida, "add-expense");
  if (!(await add.getByLabel("What was it for").isVisible())) await add.getByText("Add an expense").click();
  await add.getByLabel("What was it for").fill("Toilet paper");
  await add.getByLabel("Amount", { exact: true }).fill("99,50");
  await add.getByRole("button", { name: "Add expense" }).click();
  await expect(headline(ida)).toHaveText("You're owed 49,75 kr");
  await knut.reload();
  await expect(headline(knut)).toHaveText("You owe 49,75 kr");

  // --- One split unevenly: the parts must add up. The form is still open for the next one. ---
  await add.getByLabel("What was it for").fill("Pizza on Friday");
  await add.getByLabel("Amount", { exact: true }).fill("300");
  await add.getByText("An amount each").click();
  await add.getByLabel("Ida's part").fill("100");
  await add.getByLabel("Knut's part").fill("150");
  await expect(add.getByTestId("split-left")).toHaveText("50 kr left to share out.");
  await add.getByRole("button", { name: "Add expense" }).click();
  await expect(add.getByTestId("form-error")).toContainText("The parts add up to 250 kr, but the amount is 300 kr.");
  await add.getByLabel("Knut's part").fill("200");
  await expect(add.getByTestId("split-left")).toHaveText("The parts add up.");
  await ida.screenshot(shot("m4-uneven"));
  await add.getByRole("button", { name: "Add expense" }).click();
  await expect(headline(ida)).toHaveText("You're owed 249,75 kr");
  const pizza = seen(ida, "expense").filter({ hasText: "Pizza on Friday" });
  await expect(pizza).toContainText("You 100 kr, Knut 200 kr");

  // --- And corrected afterwards, without removing it ---
  await pizza.locator("summary").click();
  await pizza.getByLabel("Ida's part").fill("200");
  await pizza.getByLabel("Knut's part").fill("100");
  await pizza.getByRole("button", { name: "Save", exact: true }).click();
  await expect(headline(ida)).toHaveText("You're owed 149,75 kr");
  // Knut did not pay for it or enter it, so it is not his to change.
  await knut.reload();
  await expect(headline(knut)).toHaveText("You owe 149,75 kr");
  // What he owes is also a line among his things to do.
  await knut.goto("/home");
  await expect(seen(knut, "todo")).toContainText("Pay Ida 149,75 kr");
  await knut.goto("/expenses");
  await expect(seen(knut, "expense").filter({ hasText: "Pizza on Friday" }).locator("summary")).toHaveCount(0);
});

test("a happening collects who is in, from Home and the calendar too", async ({ browser }) => {
  const { ida, knut } = await twoRoommates(browser);
  const cards = (page: Page) => seen(page, "happening");

  // --- Ida suggests a film night ---
  await openArea(ida, "happenings");
  await expect(headline(ida)).toHaveText("Nothing planned");

  // Without a title it is refused with a reason.
  await ida.getByRole("button", { name: "Suggest it" }).click();
  await expect(seen(ida, "form-error")).toContainText("Say what the plan is");

  const inAWeek = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
  await ida.getByLabel("What's the plan").fill("Film night");
  await ida.getByLabel("Day").fill(inAWeek);
  await ida.getByLabel("Time").fill("19:30");
  await ida.getByLabel("Where").fill("Our living room");
  await ida.getByRole("button", { name: "Suggest it" }).click();
  await expect(headline(ida)).toHaveText("1 thing planned");
  await expect(cards(ida)).toHaveCount(1);
  // Whoever suggests it is in.
  await expect(cards(ida).first()).toHaveAttribute("data-reply", "in");
  await expect(cards(ida).first()).toContainText("19:30, Our living room");

  // --- Knut is asked on Home, and answers right there ---
  await knut.reload();
  await expect(seen(knut, "todo")).toContainText("Are you in? Film night");
  await expect(seen(knut, "band-happenings")).toContainText("Film night");
  await knut.screenshot(shot("h0-home-asked"));
  await seen(knut, "todo").getByRole("button", { name: "I'm in for Film night" }).click();
  await expect(seen(knut, "todo")).not.toContainText("Film night");

  // --- It is on the calendar, with both of their faces ---
  await nav(knut, "Calendar").click();
  await expect(knut).toHaveURL(/\/calendar$/);
  await expect(seen(knut, "sheet")).toBeVisible();
  const day = knut.locator(`[data-day="${inAWeek}"]`).filter({ visible: true });
  // A week from now can fall in next month.
  if ((await day.count()) === 0) await knut.getByRole("link", { name: "Next month" }).click();
  await day.click();
  await expect(day).toHaveAttribute("aria-current", "date");
  const film = seen(knut, "agenda-item").filter({ hasText: "Film night" });
  await expect(film).toContainText("19:30");
  await expect(film).toContainText("Our living room");
  await expect(film.getByTestId("answer")).toHaveCount(0);
  // He has answered, and the day says what.
  await expect(film.getByTestId("my-answer")).toHaveText("You're in");
  await knut.screenshot(shot("h2-calendar"));
  // One person's month: Ida is in it too, and nobody else's things are.
  await seen(knut, "who").getByRole("link", { name: "Ida" }).click();
  await expect(seen(knut, "agenda-item").filter({ hasText: "Film night" })).toBeVisible();
  // The same week, as a week.
  await seen(knut, "views").getByRole("link", { name: "Week" }).click();
  await expect(seen(knut, "week-view")).toContainText("Film night");
  await knut.screenshot(shot("h3-week"));
  await seen(knut, "views").getByRole("link", { name: "Month" }).click();
  await expect(seen(knut, "sheet")).toBeVisible();
  await film.getByRole("link").click();
  await expect(knut).toHaveURL(/\/happenings#[0-9a-f-]{36}$/);

  await expect(cards(knut).first()).toHaveAttribute("data-reply", "in");
  await expect(cards(knut).first()).toContainText("You and Ida are in");
  // He did not suggest it and is not an admin, so he cannot call it off.
  await expect(knut.getByRole("button", { name: "Call off Film night" })).toHaveCount(0);
  await knut.screenshot(shot("h1-happenings"));

  // --- He changes his mind ---
  await knut.getByRole("button", { name: "I can't make Film night" }).click();
  await expect(cards(knut).first()).toHaveAttribute("data-reply", "out");
  await expect(cards(knut).first()).toContainText("You can't make it.");

  // --- Ida calls it off. It asks first. ---
  await ida.reload();
  await expect(cards(ida).first()).toContainText("You are in");
  await ida.getByRole("button", { name: "Call off Film night" }).click();
  await expect(cards(ida)).toHaveCount(1);
  await ida.getByRole("button", { name: "Call off Film night?" }).click();
  await expect(headline(ida)).toHaveText("Nothing planned");
});

test("a dinner goes from ideas to a shopping list", async ({ browser }) => {
  test.slow();
  const { ida, knut } = await twoRoommates(browser);
  const dishes = (page: Page) => seen(page, "dish");
  const ingredient = (page: Page, name: string) => seen(page, "ingredient").filter({ hasText: name });

  // --- Ida plans a dinner, and is in herself ---
  await openArea(ida, "dinner");
  await expect(headline(ida)).toHaveText("No dinner planned");
  const inThreeDays = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
  const plan = seen(ida, "plan");
  await plan.getByLabel("Day", { exact: true }).fill(inThreeDays);
  await plan.getByLabel("Time", { exact: true }).fill("18:30");
  await expect(plan.getByLabel("I'm in myself")).toBeChecked();
  await ida.getByRole("button", { name: "Plan dinner" }).click();
  await expect(ida).toHaveURL(/\/dinner\/[0-9a-f-]{36}$/);
  await expect(headline(ida)).toHaveText("What's for dinner?");
  // Only whoever planned it is in. The others answer for themselves.
  await expect(seen(ida, "whos-in")).toHaveAttribute("data-me", "in");
  await expect(seen(ida, "whos-in")).toContainText("You are in.");
  await expect(seen(ida, "whos-in")).toContainText("No answer yet from Knut.");

  // --- She suggests a dish. A dish needs a name. ---
  const form = seen(ida, "dish-form");
  await form.getByRole("button", { name: "Put it to the vote", exact: true }).click();
  await expect(seen(ida, "form-error")).toContainText("Name the dish");
  // Typing the name brings up what such a dish needs, to take with one press.
  // Naming the dish and pressing Enter fills in what it needs.
  await form.getByLabel("Suggest a dish").fill("Tacos");
  await form.getByLabel("Suggest a dish").press("Enter");
  await expect(form.getByLabel("What it needs")).toHaveValue(/Tortillas/);
  await expect(seen(ida, "needs-note")).toContainText("Filled in from Kubbe's cookbook");
  // She keeps it short instead.
  await form.getByLabel("What it needs").fill("Tortillas, Minced beef\nSalsa");
  await form.getByRole("button", { name: "Put it to the vote", exact: true }).click();
  await expect(dishes(ida)).toHaveCount(1);
  await expect(dishes(ida).first()).toContainText("suggested this");
  await expect(dishes(ida).first()).toContainText("Minced beef, Salsa, Tortillas");
  await expect(dishes(ida).first()).toHaveAttribute("data-voted", "yes");

  // --- Out of ideas: a few are offered. Using one fills the form; it goes to the vote only on the button ---
  await seen(ida, "get-ideas").click();
  await expect(seen(ida, "idea")).toHaveCount(3);
  await ida.screenshot(shot("d1-dinner-ideas"));
  const picked = (await seen(ida, "idea").first().getByRole("heading").innerText()).trim();
  await seen(ida, "idea").first().getByRole("button", { name: /^Use this idea/ }).click();
  await expect(form.getByLabel("Suggest a dish")).toHaveValue(picked);
  await expect(form.getByLabel("What it needs")).not.toHaveValue("");
  await expect(dishes(ida)).toHaveCount(1);
  await form.getByRole("button", { name: "Put it to the vote", exact: true }).click();
  await expect(dishes(ida)).toHaveCount(2);
  await expect(seen(ida, "idea")).toHaveCount(2);
  await expect(dishes(ida).filter({ hasText: "picked this from the ideas" })).toHaveCount(1);

  // --- Knut is asked on Home whether he is in, and finds the dinner ---
  await knut.reload();
  await expect(seen(knut, "todo")).toContainText("Are you in? Dinner");
  await openArea(knut, "dinner");
  await expect(headline(knut)).toHaveText("What's for dinner?");
  const card = seen(knut, "dinner").first();
  await expect(card).toContainText("2 ideas, not decided");
  await expect(card).toContainText("1 in");
  await expect(card).toContainText("Are you in?");
  await expect(card).toContainText("Nobody cooks yet");
  await card.getByRole("link").click();
  await expect(knut).toHaveURL(/\/dinner\/[0-9a-f-]{36}$/);
  await expect(seen(knut, "whos-in")).toHaveAttribute("data-me", "unanswered");
  await knut.getByRole("button", { name: "I'm in for this dinner" }).click();
  await expect(seen(knut, "whos-in")).toHaveAttribute("data-me", "in");
  await knut.getByRole("button", { name: "Vote for Tacos" }).click();
  await expect(dishes(knut).filter({ hasText: "Tacos" })).toContainText("2 votes");
  await expect(dishes(knut).filter({ hasText: "Tacos" })).toContainText("In the lead");
  await knut.getByRole("button", { name: "I'll cook: this dinner" }).click();
  await expect(seen(knut, "duty-cook")).toContainText("You");

  // --- Ida cleans up, and they decide on tacos ---
  await ida.reload();
  await expect(seen(ida, "duty-cook")).toContainText("Knut");
  await expect(seen(ida, "duty-cook").getByRole("button")).toHaveCount(0);
  await ida.getByRole("button", { name: "I'll clean up: this dinner" }).click();
  await expect(seen(ida, "duty-cleaner")).toContainText("You");
  await ida.getByRole("button", { name: "Decide on Tacos" }).click();
  await expect(headline(ida)).toHaveText("Tacos");
  // The top of the screen says where the dinner stands.
  await expect(seen(ida, "stands")).toContainText("Who's eatingYou and Knut");
  await expect(seen(ida, "stands")).toContainText("WhatTacos");
  await expect(seen(ida, "stands")).toContainText("CookingKnut");
  await expect(seen(ida, "stands")).toContainText("3 things left to buy, 3 not taken");
  await expect(seen(ida, "ingredient")).toHaveCount(3);
  await expect(seen(ida, "needs")).toContainText("3 things to buy, 3 that nobody has taken.");

  // --- Salsa is in the cupboard. Ida takes the tortillas. ---
  await ida.getByRole("button", { name: "We have it: Salsa" }).click();
  await expect(ingredient(ida, "Salsa")).toHaveAttribute("data-state", "home");
  await ida.getByRole("button", { name: "I'll buy it: Tortillas" }).click();
  await expect(ingredient(ida, "Tortillas")).toContainText("You'll buy it.");
  await expect(seen(ida, "needs")).toContainText("2 things to buy, 1 that nobody has taken.");
  await ida.screenshot(shot("d2-dinner-settled"));

  // --- Home tells each of them what is theirs to do ---
  await back(ida, /\/dinner$/);
  await back(ida, /\/home$/);
  await expect(seen(ida, "todo")).toContainText("Yours to do");
  await expect(seen(ida, "todo")).toContainText("Clean up after dinner");
  await expect(seen(ida, "todo")).toContainText("Buy Tortillas");
  await expect(seen(ida, "todo")).not.toContainText("Cook");
  await expect(seen(ida, "band-dinner")).toContainText("Tacos");
  await ida.screenshot(shot("d4-home-yours"));
  await knut.goto("/home");
  await expect(seen(knut, "todo")).toContainText("Cook Tacos");
  // The cook is told what nobody has said they will buy.
  await expect(seen(knut, "todo")).toContainText("1 thing nobody is buying yet");

  // --- The calendar has the dinner on its day, with who cooks ---
  await nav(ida, "Calendar").click();
  await expect(seen(ida, "sheet")).toBeVisible();
  const day = ida.locator(`[data-day="${inThreeDays}"]`).filter({ visible: true });
  if ((await day.count()) === 0) await ida.getByRole("link", { name: "Next month" }).click();
  await day.click();
  await expect(day).toHaveAttribute("aria-current", "date");
  const onDay = seen(ida, "agenda-item").filter({ hasText: "Dinner: Tacos" });
  await expect(onDay).toContainText("18:30");
  await expect(onDay).toContainText("Knut cooks");
  await ida.screenshot(shot("d5-calendar"));
  await onDay.getByRole("link").click();
  await expect(headline(ida)).toHaveText("Tacos");

  // --- What needs buying is on the shopping list, and only that ---
  await knut.goto("/shopping");
  const items = seen(knut, "item");
  await expect(items).toHaveCount(2);
  await expect(items.filter({ hasText: "Tortillas" })).toContainText("(Tacos). Ida will buy it.");
  await expect(items.filter({ hasText: "Salsa" })).toHaveCount(0);
  await knut.getByRole("button", { name: "Bought: Minced beef" }).click();
  await expect(items).toHaveCount(1);
  await ida.reload();
  await expect(ingredient(ida, "Minced beef")).toHaveAttribute("data-state", "bought");
  await expect(ingredient(ida, "Minced beef")).toContainText("Knut bought it.");

  // --- Ida cannot come after all, so she no longer cleans up. Then she can. ---
  await ida.getByRole("button", { name: "I'm not coming to this dinner" }).click();
  await expect(seen(ida, "whos-in")).toHaveAttribute("data-me", "out");
  await expect(seen(ida, "whos-in")).toContainText("Knut is in.");
  await expect(seen(ida, "duty-cleaner")).toContainText("Nobody yet");
  await ida.getByRole("button", { name: "I'm in for this dinner" }).click();
  await expect(seen(ida, "whos-in")).toHaveAttribute("data-me", "in");

  // --- Fixed dinner days fill the list. Nobody is in for those until they say so. ---
  await back(ida, /\/dinner$/);
  await expect(headline(ida)).toHaveText("Tacos");
  await expect(seen(ida, "dinner")).toHaveCount(1);
  const days = seen(ida, "dinner-days");
  await days.getByLabel("Monday").check();
  await days.getByLabel("Thursday").check();
  await days.getByLabel("At", { exact: true }).fill("19:00");
  await days.getByRole("button", { name: "Save" }).click();
  // Two fixed days over two weeks: four dinners, or three when one of them was earlier today
  // and its time has passed. Either way more than the one planned dinner.
  await expect.poll(async () => seen(ida, "dinner").count()).toBeGreaterThanOrEqual(3);
  await expect(seen(ida, "dinner").filter({ hasText: "Nobody is in yet" }).first()).toContainText("Are you in?");
  await ida.screenshot(shot("d3-dinners"));
  const withBoth = await seen(ida, "dinner").count();
  await days.getByLabel("Monday").uncheck();
  await days.getByRole("button", { name: "Save" }).click();
  await expect.poll(async () => seen(ida, "dinner").count()).toBeLessThan(withBoth);
  await expect(seen(ida, "dinner").filter({ hasText: "Tacos" })).toHaveCount(1);
  await knut.goto("/dinner");
  await expect(seen(knut, "dinner-days")).toContainText("Dinner is on Thursdays at 19:00.");

  // --- Calling the dinner off takes what is not bought off the shopping list ---
  await seen(ida, "dinner").filter({ hasText: "Tacos" }).getByRole("link").click();
  await expect(headline(ida)).toHaveText("Tacos");
  // Two more things nobody is buying: one press takes them both.
  await seen(ida, "needs").getByLabel("Something else it needs").fill("Limes, Coriander");
  await seen(ida, "needs").getByRole("button", { name: "Add", exact: true }).click();
  await expect(ingredient(ida, "Coriander")).toBeVisible();
  await ida.getByRole("button", { name: /^I'll buy everything left \(2\)/ }).click();
  await expect(ingredient(ida, "Limes")).toContainText("You'll buy it.");
  await expect(ingredient(ida, "Coriander")).toContainText("You'll buy it.");
  await ida.getByRole("button", { name: "Call off this dinner" }).click();
  await ida.getByRole("button", { name: "Call off this dinner?" }).click();
  await expect(headline(ida)).toHaveText("Called off");
  await knut.goto("/shopping");
  await expect(seen(knut, "item")).toHaveCount(0);
  await expect(seen(knut, "bag")).toContainText("Minced beef");
});
