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
  await knut.getByRole("button", { name: "Join Kollektivet" }).click();
  await expect(knut).toHaveURL(/\/home$/);
  return { ida, knut };
}

const headline = (page: Page) => page.getByTestId("headline").filter({ visible: true });
const notes = (page: Page) => page.getByTestId("note").filter({ visible: true });

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

  await ida.goto("/flat");
  await ida.getByRole("link", { name: /Noticeboard/ }).click();
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
  await ida.screenshot(shot("b1-board"));

  // Knut sees it as his, on Home too, and ticks it off.
  await knut.goto("/home");
  await expect(knut.getByTestId("todo").filter({ visible: true })).toContainText("Buy a new shower curtain");
  await knut.getByTestId("todo").filter({ visible: true }).getByRole("link", { name: /shower curtain/ }).click();
  await expect(knut).toHaveURL(/\/board$/);
  const curtain = notes(knut).filter({ hasText: "shower curtain" });
  await expect(curtain).toContainText("For you");
  // He did not write the other note and is not an admin, so he cannot take it down.
  await expect(notes(knut).filter({ hasText: "Landlord" }).getByRole("button", { name: "Take this note down" })).toHaveCount(0);
  await curtain.getByRole("button", { name: "Mark as done" }).click();
  await expect(curtain).toHaveAttribute("data-state", "done");
  await expect(curtain).toContainText("Done by you");
  await expect(headline(knut)).toHaveText("All sorted");
  await knut.goto("/home");
  await expect(knut.getByTestId("todo").filter({ visible: true })).toContainText("Nothing waiting on you");

  // Ida takes her note down. It asks first.
  await ida.reload();
  const landlord = notes(ida).filter({ hasText: "Landlord" });
  await landlord.getByRole("button", { name: "Take this note down" }).click();
  await expect(landlord).toBeVisible();
  await landlord.getByRole("button", { name: "Take it down?" }).click();
  await expect(notes(ida).filter({ hasText: "Landlord" })).toHaveCount(0);
});

test("shopping leads to expenses, and expenses to being square", async ({ browser }) => {
  const { ida, knut } = await twoRoommates(browser);
  const items = (page: Page) => page.getByTestId("item").filter({ visible: true });

  // --- Ida writes the list ---
  await ida.goto("/flat");
  await ida.getByRole("link", { name: /Shopping/ }).click();
  await expect(headline(ida)).toHaveText("Nothing to buy");
  for (const thing of ["Oat milk", "Bread"]) {
    await ida.getByLabel("Add to the list").fill(thing);
    await ida.getByRole("button", { name: "Add", exact: true }).click();
    await expect(items(ida).filter({ hasText: thing })).toBeVisible();
  }
  await expect(headline(ida)).toHaveText("2 to buy");

  // --- Knut says he will buy the milk, then buys both ---
  await knut.goto("/shopping");
  await knut.getByRole("button", { name: "I'll buy Oat milk" }).click();
  await expect(items(knut).filter({ hasText: "Oat milk" })).toContainText("You'll buy it.");
  await ida.reload();
  await expect(items(ida).filter({ hasText: "Oat milk" })).toContainText("Knut will buy it.");
  await ida.screenshot(shot("m1-shopping"));

  await knut.getByRole("button", { name: "Got Oat milk" }).click();
  await expect(items(knut)).toHaveCount(1);
  await knut.getByRole("button", { name: "Got Bread" }).click();
  await expect(headline(knut)).toHaveText("Nothing to buy");
  const bag = knut.getByTestId("bag");
  await expect(bag.getByRole("heading")).toHaveText("You got 2 things");

  // A nonsense amount is refused with a reason.
  await bag.getByLabel("What did you pay for these?").fill("lots");
  await bag.getByRole("button", { name: "Split the cost" }).click();
  await expect(bag.getByTestId("form-error")).toContainText("Enter what you paid");
  await knut.screenshot(shot("m2-bag"));

  // --- What he paid becomes an expense, split between the two ---
  await bag.getByLabel("What did you pay for these?").fill("100");
  await bag.getByRole("button", { name: "Split the cost" }).click();
  await expect(knut.getByTestId("bag")).toHaveCount(0);
  await knut.getByRole("link", { name: "See who owes whom" }).click();
  await expect(headline(knut)).toHaveText("You're owed 50 kr");
  await expect(knut.getByTestId("expense").filter({ visible: true }).first()).toContainText("Shopping: Oat milk, Bread");

  // --- Ida owes him, pays, and marks it ---
  await ida.goto("/home");
  await expect(ida.getByTestId("todo").filter({ visible: true })).toContainText("Pay Knut 50 kr");
  await ida.goto("/expenses");
  await expect(headline(ida)).toHaveText("You owe 50 kr");
  const settle = ida.getByTestId("settle");
  await expect(settle).toContainText("You pay Knut 50 kr");
  await ida.screenshot(shot("m3-expenses"));
  await settle.getByRole("button", { name: "Paid", exact: true }).click();
  await settle.getByRole("button", { name: "Mark 50 kr as paid?" }).click();
  await expect(headline(ida)).toHaveText("All square");

  // --- An expense that never was on the list ---
  await ida.getByText("Add an expense").click();
  await ida.getByLabel("What was it for").fill("Toilet paper");
  await ida.getByLabel("Amount").fill("99,50");
  await ida.getByRole("button", { name: "Add expense" }).click();
  await expect(headline(ida)).toHaveText("You're owed 49.75 kr");
  await knut.reload();
  await expect(headline(knut)).toHaveText("You owe 49.75 kr");
});

test("a happening collects who is in", async ({ browser }) => {
  const { ida, knut } = await twoRoommates(browser);
  const cards = (page: Page) => page.getByTestId("happening").filter({ visible: true });

  // --- Ida suggests a film night ---
  await ida.goto("/flat");
  await ida.getByRole("link", { name: /Happenings/ }).click();
  await expect(headline(ida)).toHaveText("Nothing planned");

  // Without a title it is refused with a reason.
  await ida.getByRole("button", { name: "Suggest it" }).click();
  await expect(ida.getByTestId("form-error").filter({ visible: true })).toContainText("Say what the plan is");

  const inAWeek = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
  await ida.getByLabel("What's the plan").fill("Film night");
  await ida.getByLabel("Day").fill(inAWeek);
  await ida.getByLabel("Time").fill("19:30");
  await ida.getByLabel("Where").fill("Our living room");
  await ida.getByRole("button", { name: "Suggest it" }).click();
  await expect(headline(ida)).toHaveText("Film night");
  await expect(cards(ida)).toHaveCount(1);
  // Whoever suggests it is in.
  await expect(cards(ida).first()).toHaveAttribute("data-reply", "in");
  await expect(cards(ida).first()).toContainText("19:30, Our living room");

  // --- Knut has not answered, which Home reminds him of. Then he says he is in. ---
  await knut.goto("/home");
  await expect(knut.getByTestId("todo").filter({ visible: true })).toContainText("Are you in? Film night");
  await knut.goto("/happenings");
  await expect(cards(knut).first()).toHaveAttribute("data-reply", "unanswered");
  await expect(cards(knut).first()).toContainText("Ida is in");
  // He did not suggest it and is not an admin, so he cannot call it off.
  await expect(knut.getByRole("button", { name: "Call off Film night" })).toHaveCount(0);
  await knut.getByRole("button", { name: "I'm in for Film night" }).click();
  await expect(cards(knut).first()).toHaveAttribute("data-reply", "in");
  await expect(cards(knut).first()).toContainText("You and Ida are in");
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
  const { ida, knut } = await twoRoommates(browser);
  const seen = (page: Page, id: string) => page.getByTestId(id).filter({ visible: true });
  const dishes = (page: Page) => seen(page, "dish");
  const ingredient = (page: Page, name: string) => seen(page, "ingredient").filter({ hasText: name });

  // --- Ida plans a dinner ---
  await ida.goto("/flat");
  await ida.getByRole("link", { name: /Dinner/ }).click();
  await expect(headline(ida)).toHaveText("No dinner planned");
  const inThreeDays = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
  await ida.getByLabel("Day", { exact: true }).fill(inThreeDays);
  await ida.getByLabel("Time", { exact: true }).fill("18:30");
  await ida.getByRole("button", { name: "Plan dinner" }).click();
  await expect(ida).toHaveURL(/\/dinner\/[0-9a-f-]{36}$/);
  await expect(headline(ida)).toHaveText("What's for dinner?");
  await expect(seen(ida, "whos-in")).toContainText("You and Knut are in.");

  // --- She suggests a dish. A dish needs a name. ---
  await ida.getByRole("button", { name: "Put it to the vote", exact: true }).click();
  await expect(ida.getByTestId("form-error").filter({ visible: true })).toContainText("Name the dish");
  await ida.getByLabel("Suggest a dish").fill("Tacos");
  await ida.getByLabel("What it needs").fill("Tortillas, Minced beef\nSalsa");
  await ida.getByRole("button", { name: "Put it to the vote", exact: true }).click();
  await expect(dishes(ida)).toHaveCount(1);
  await expect(dishes(ida).first()).toContainText("Your idea");
  await expect(dishes(ida).first()).toContainText("Minced beef, Salsa, Tortillas");
  await expect(dishes(ida).first()).toHaveAttribute("data-voted", "yes");

  // --- Out of ideas: a few are offered, and one goes to the vote ---
  await ida.getByRole("button", { name: "Out of ideas? Get a few" }).click();
  await expect(seen(ida, "idea")).toHaveCount(3);
  await ida.screenshot(shot("d1-dinner-ideas"));
  await seen(ida, "idea").first().getByRole("button").click();
  await expect(dishes(ida)).toHaveCount(2);
  await expect(seen(ida, "idea")).toHaveCount(2);
  await expect(dishes(ida).filter({ hasText: "From the ideas" })).toHaveCount(1);

  // --- Knut finds the dinner, votes for tacos and says he will cook ---
  await knut.goto("/dinner");
  await expect(headline(knut)).toHaveText("What's for dinner?");
  await expect(seen(knut, "dinner").first()).toContainText("2 ideas, not settled");
  await expect(seen(knut, "dinner").first()).toContainText("Nobody cooks yet. 2 in.");
  await seen(knut, "dinner").first().getByRole("link").click();
  await expect(knut).toHaveURL(/\/dinner\/[0-9a-f-]{36}$/);
  await knut.getByRole("button", { name: "Vote for Tacos" }).click();
  await expect(dishes(knut).filter({ hasText: "Tacos" })).toContainText("2 votes");
  await knut.getByRole("button", { name: "I'll cook this dinner" }).click();
  await expect(seen(knut, "duty-cook")).toContainText("You");

  // --- Ida cleans up, and they go with tacos ---
  await ida.reload();
  await expect(seen(ida, "duty-cook")).toContainText("Knut");
  await expect(seen(ida, "duty-cook").getByRole("button")).toHaveCount(0);
  await ida.getByRole("button", { name: "I'll clean up after this dinner" }).click();
  await expect(seen(ida, "duty-cleaner")).toContainText("You");
  await ida.getByRole("button", { name: "Go with Tacos" }).click();
  await expect(headline(ida)).toHaveText("Tacos");
  await expect(seen(ida, "ingredient")).toHaveCount(3);
  await expect(seen(ida, "needs")).toContainText("3 things to buy, 3 that nobody has taken.");

  // --- Salsa is in the cupboard. Ida takes the tortillas. ---
  await ida.getByRole("button", { name: "We have Salsa" }).click();
  await expect(ingredient(ida, "Salsa")).toHaveAttribute("data-state", "home");
  await ida.getByRole("button", { name: "I'll buy Tortillas" }).click();
  await expect(ingredient(ida, "Tortillas")).toContainText("You'll buy it.");
  await expect(seen(ida, "needs")).toContainText("2 things to buy, 1 that nobody has taken.");
  await ida.screenshot(shot("d2-dinner-settled"));

  // --- Home tells each of them what is theirs to do ---
  await ida.goto("/home");
  await expect(seen(ida, "todo")).toContainText("Yours to do");
  await expect(seen(ida, "todo")).toContainText("Clean up after dinner");
  await expect(seen(ida, "todo")).toContainText("Buy Tortillas");
  await expect(seen(ida, "todo")).not.toContainText("Cook");
  await ida.screenshot(shot("d4-home-yours"));
  await knut.goto("/home");
  await expect(seen(knut, "todo")).toContainText("Cook Tacos");
  await seen(ida, "todo").getByRole("link", { name: /Clean up after dinner/ }).click();
  await expect(headline(ida)).toHaveText("Tacos");

  // --- What needs buying is on the shopping list, and only that ---
  await knut.goto("/shopping");
  const items = seen(knut, "item");
  await expect(items).toHaveCount(2);
  await expect(items.filter({ hasText: "Tortillas" })).toContainText("For a dinner. Ida will buy it.");
  await expect(items.filter({ hasText: "Salsa" })).toHaveCount(0);
  await knut.getByRole("button", { name: "Got Minced beef" }).click();
  await expect(items).toHaveCount(1);
  await ida.reload();
  await expect(ingredient(ida, "Minced beef")).toHaveAttribute("data-state", "bought");
  await expect(ingredient(ida, "Minced beef")).toContainText("Knut got it.");

  // --- Ida cannot come after all, so she no longer cleans up. Then she can. ---
  await ida.getByRole("button", { name: "I'm out of this dinner" }).click();
  await expect(seen(ida, "whos-in")).toHaveAttribute("data-me", "out");
  await expect(seen(ida, "whos-in")).toContainText("Knut is in.");
  await expect(seen(ida, "duty-cleaner")).toContainText("Nobody yet");
  await ida.getByRole("button", { name: "I'm in for this dinner after all" }).click();
  await expect(seen(ida, "whos-in")).toHaveAttribute("data-me", "in");

  // --- Fixed dinner days fill the list ---
  await ida.getByRole("link", { name: "All dinners" }).click();
  await expect(headline(ida)).toHaveText("Tacos");
  await expect(seen(ida, "dinner")).toHaveCount(1);
  const days = seen(ida, "dinner-days");
  await days.getByLabel("Monday").check();
  await days.getByLabel("Thursday").check();
  await days.getByLabel("At", { exact: true }).fill("19:00");
  await days.getByRole("button", { name: "Save" }).click();
  // Two fixed days over two weeks: four dinners, less one if it lands on the planned day.
  await expect.poll(async () => seen(ida, "dinner").count()).toBeGreaterThanOrEqual(4);
  await ida.screenshot(shot("d3-dinners"));
  const withBoth = await seen(ida, "dinner").count();
  await days.getByLabel("Monday").uncheck();
  await days.getByRole("button", { name: "Save" }).click();
  await expect.poll(async () => seen(ida, "dinner").count()).toBeLessThan(withBoth);
  await expect(seen(ida, "dinner").filter({ hasText: "Tacos" })).toHaveCount(1);
  await knut.goto("/dinner");
  await expect(seen(knut, "dinner-days")).toContainText("Dinner is on Thursdays at 19:00.");

  // --- Calling the dinner off takes what is not bought off the shopping list ---
  await ida.getByRole("link", { name: /Tacos/ }).click();
  await expect(headline(ida)).toHaveText("Tacos");
  await ida.getByRole("button", { name: "Call off this dinner" }).click();
  await ida.getByRole("button", { name: "Call off this dinner?" }).click();
  await expect(headline(ida)).toHaveText("Called off");
  await knut.goto("/shopping");
  await expect(seen(knut, "item")).toHaveCount(0);
  await expect(knut.getByTestId("bag")).toContainText("Minced beef");
});
