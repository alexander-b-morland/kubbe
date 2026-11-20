import { neon } from "@neondatabase/serverless";
import { expect, test, type Page } from "@playwright/test";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

// A walk through a lived-in flat, to look at: two roommates with a bit of everything
// going on, and a screenshot of every screen on a phone and on a wide screen. It checks
// little by itself. Its screenshots land in test-shots/ as tour-*.png.

const run = Date.now().toString(36);
const email = (who: string) => `e2e-tour-${who}-${run}@kubbe.test`;
const password = "correct-horse-battery";
const shot = (name: string) => ({ path: `test-shots/tour-${name}.png`, fullPage: true, caret: "initial" as const, animations: "disabled" as const });
const seen = (page: Page, id: string) => page.getByTestId(id).filter({ visible: true });
const headline = (page: Page) => seen(page, "headline");

async function signUp(page: Page, name: string, who: string) {
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email").fill(email(who));
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
}

test.afterAll(async () => {
  const sql = neon(process.env.DATABASE_URL!);
  for (let attempt = 1; ; attempt++) {
    try {
      await sql`delete from household where created_by in (select id from "user" where email like 'e2e-tour-%@kubbe.test')`;
      await sql`delete from "user" where email like 'e2e-tour-%@kubbe.test'`;
      return;
    } catch (error) {
      if (attempt === 4) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
    }
  }
});

test("a tour of a lived-in flat", async ({ browser }) => {
  test.setTimeout(420_000);

  // --- Ida starts the household, Knut joins ---
  const ida = await (await browser.newContext()).newPage();
  await ida.goto("/sign-up");
  await signUp(ida, "Ida", "ida");
  await ida.getByLabel("Household name").fill("Kollektivet");
  await ida.getByRole("button", { name: "Create household" }).click();
  await expect(ida).toHaveURL(/\/home$/);
  await ida.screenshot(shot("01-home-alone"));
  const code = (await ida.getByTestId("join-code").innerText()).replace(/\s/g, "");

  const knut = await (await browser.newContext()).newPage();
  await knut.goto(`/join/${code}`);
  await knut.getByRole("link", { name: "Create account" }).click();
  await knut.screenshot(shot("01b-sign-up-invited"));
  await signUp(knut, "Knut", "knut");
  await expect(knut).toHaveURL(/\/home$/);

  // --- A profile with something on it ---
  await knut.goto("/profile");
  await knut.getByRole("radio", { name: "Cat" }).check({ force: true });
  await knut.getByLabel("About you").fill("Third year, plays the trombone, will trade dishes for coffee.");
  await knut.getByRole("radio", { name: "Evening shower" }).check({ force: true });
  await knut.getByRole("radio", { name: "Night owl" }).check({ force: true });
  await knut.getByRole("radio", { name: "Does the dishes" }).check({ force: true });
  await knut.getByLabel("My signature dish").fill("Pasta with whatever is left");
  await knut.getByLabel("The song I play too loud").fill("Take On Me");
  await knut.locator('input[name="avoids"]').fill("Fish");
  await knut.getByRole("button", { name: "Save" }).click();
  await expect(knut.getByText("Saved")).toBeVisible();
  await knut.screenshot(shot("02-you"));

  // --- Cleaning: a room and a chore ---
  await ida.goto("/cleaning");
  await ida.getByRole("button", { name: "Bathroom", exact: true }).click();
  await ida.getByRole("button", { name: "Add", exact: true }).click();
  await expect(seen(ida, "turn-Bathroom")).toBeVisible();
  await ida.getByRole("button", { name: "Empty the dishwasher", exact: true }).click();
  await ida.getByRole("button", { name: "Add", exact: true }).click();
  await expect(seen(ida, "turn-Empty the dishwasher")).toBeVisible();
  await ida.screenshot(shot("03-cleaning"));

  // --- A shower slot tomorrow ---
  await ida.goto("/shower");
  await ida.getByRole("navigation", { name: "Day" }).getByRole("link").nth(1).click();
  await expect(ida.getByRole("navigation", { name: "Day" }).getByRole("link").nth(1)).toHaveAttribute("aria-current", "date");
  await ida.getByRole("button", { name: /^Book/ }).filter({ visible: true }).first().click();
  await expect(ida.getByRole("button", { name: /Cancel/ }).filter({ visible: true }).first()).toBeVisible();
  await ida.screenshot(shot("04-shower"));

  // --- A dinner: planned, suggested with help, voted, decided ---
  await ida.goto("/dinner");
  await ida.screenshot(shot("05-dinner-empty"));
  const inThreeDays = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
  await seen(ida, "plan").getByLabel("Day", { exact: true }).fill(inThreeDays);
  await seen(ida, "plan").getByLabel("Time", { exact: true }).fill("18:30");
  await ida.getByRole("button", { name: "Plan dinner" }).click();
  await expect(ida).toHaveURL(/\/dinner\/[0-9a-f-]{36}$/);
  const dinnerUrl = ida.url();
  await ida.getByLabel("Suggest a dish").fill("Tacos");
  await ida.getByLabel("Suggest a dish").press("Enter");
  await expect(ida.getByLabel("What it needs")).toHaveValue(/Tortillas/);
  await ida.screenshot(shot("06-dinner-suggesting"));
  await ida.getByRole("button", { name: "Put it to the vote", exact: true }).click();
  await expect(seen(ida, "dish")).toHaveCount(1);
  await seen(ida, "get-ideas").click();
  await expect(seen(ida, "idea")).toHaveCount(3);
  await ida.screenshot(shot("06b-dinner-ideas"));
  await seen(ida, "idea").first().getByRole("button", { name: /^Use this idea/ }).click();
  await ida.getByRole("button", { name: "Put it to the vote", exact: true }).click();
  await expect(seen(ida, "dish")).toHaveCount(2);

  await knut.goto("/home");
  await expect(seen(knut, "todo")).toContainText("Are you in?");
  await knut.screenshot(shot("07-home-asked"));
  await knut.goto(dinnerUrl);
  await knut.screenshot(shot("08-dinner-voting"));
  await knut.getByRole("button", { name: "I'm in for this dinner" }).click();
  await expect(seen(knut, "whos-in")).toHaveAttribute("data-me", "in");
  await knut.getByRole("button", { name: "Vote for Tacos" }).click();
  await knut.getByRole("button", { name: "I'll cook: this dinner" }).click();
  await expect(seen(knut, "duty-cook")).toContainText("You");

  await ida.reload();
  await ida.getByRole("button", { name: "Decide on Tacos" }).click();
  await expect(headline(ida)).toHaveText("Tacos");
  await seen(ida, "ingredient").first().getByRole("button", { name: /^I'll buy/ }).click();
  await expect(seen(ida, "ingredient").first()).toHaveAttribute("data-state", "claimed");
  await seen(ida, "ingredient").nth(1).getByRole("button", { name: /^We have/ }).click();
  await expect(seen(ida, "ingredient").nth(1)).toHaveAttribute("data-state", "home");
  await ida.screenshot(shot("09-dinner-decided"));

  // --- Something to do together ---
  await ida.goto("/happenings");
  await ida.getByLabel("What's the plan").fill("Film night");
  await ida.getByLabel("Day").fill(new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10));
  await ida.getByLabel("Where").fill("Our living room");
  await ida.getByRole("button", { name: "Suggest it" }).click();
  await expect(seen(ida, "happening")).toHaveCount(1);
  await ida.screenshot(shot("10-happenings"));

  // --- The whiteboard ---
  await ida.goto("/board");
  await ida.getByLabel("Write on the board").fill("Landlord is coming Tuesday at 10.");
  await ida.getByRole("button", { name: "Put it up" }).click();
  await expect(seen(ida, "note")).toHaveCount(1);
  await ida.getByLabel("Write on the board").fill("Buy a new shower curtain");
  await ida.getByLabel("Something that needs doing").check();
  await ida.getByLabel("Who should do it").selectOption({ label: "Knut" });
  await ida.getByRole("button", { name: "Put it up" }).click();
  await expect(seen(ida, "note")).toHaveCount(2);
  await ida.getByLabel("Write on the board").fill("Whoever took my oat milk owes me a coffee");
  await ida.getByRole("button", { name: "Put it up" }).click();
  await expect(seen(ida, "note")).toHaveCount(3);
  await ida.screenshot(shot("11-board"));

  // --- Shopping, then what it cost, split unevenly ---
  await ida.goto("/shopping");
  for (const thing of ["Oat milk", "Bread"]) {
    await ida.getByLabel("Add to the list").fill(thing);
    await ida.getByRole("button", { name: "Add", exact: true }).click();
    await expect(seen(ida, "item").filter({ hasText: thing })).toBeVisible();
  }
  await knut.goto("/shopping");
  await knut.getByRole("button", { name: "Bought: Oat milk" }).click();
  await expect(seen(knut, "bag")).toContainText("You got 1 thing");
  await knut.screenshot(shot("12-shopping"));
  const bag = seen(knut, "bag");
  await bag.getByLabel("What did you pay for these?").fill("100");
  await bag.getByRole("button", { name: "Split the cost" }).click();
  await expect(seen(knut, "bag")).toHaveCount(0);

  await ida.goto("/expenses");
  await expect(headline(ida)).toHaveText("You owe 50 kr");
  const add = seen(ida, "add-expense");
  await add.getByText("Add an expense").click();
  await add.getByLabel("What was it for").fill("Pizza on Friday");
  await add.getByLabel("Amount", { exact: true }).fill("300");
  await add.getByText("An amount each").click();
  await add.getByLabel("Ida's part").fill("100");
  await add.getByLabel("Knut's part").fill("200");
  await expect(add.getByTestId("split-left")).toHaveText("The parts add up.");
  await ida.screenshot(shot("13-expenses-adding"));
  await add.getByRole("button", { name: "Add expense" }).click();
  await expect(headline(ida)).toHaveText("You're owed 150 kr");
  await ida.screenshot(shot("14-expenses"));

  // --- Everything gathered: Home, the calendar, the household ---
  for (const [who, page] of [["ida", ida], ["knut", knut]] as const) {
    await page.goto("/home");
    await expect(seen(page, "todo")).toBeVisible();
    await page.screenshot(shot(`20-home-${who}`));
  }
  await ida.goto("/calendar");
  await ida.locator(`[data-day="${inThreeDays}"]`).filter({ visible: true }).click();
  await expect(ida.locator(`[data-day="${inThreeDays}"]`).filter({ visible: true })).toHaveAttribute("aria-current", "date");
  await expect(seen(ida, "agenda-item").first()).toBeVisible();
  await ida.screenshot(shot("21-calendar"));
  await ida.goto("/settings");
  await expect(seen(ida, "join-code")).toBeVisible();
  await ida.screenshot(shot("22-household"));
  await ida.goto("/settings/rules");
  await expect(seen(ida, "group-shower")).toBeVisible();
  await ida.screenshot(shot("23-rules"));
  await ida.goto("/laundry");
  await expect(headline(ida)).toBeVisible();
  await ida.screenshot(shot("24-laundry"));
  await ida.goto("/settings");
  await ida.getByRole("link", { name: "Knut" }).click();
  await expect(ida).toHaveURL(/\/people\//);
  await expect(ida.getByRole("heading", { level: 1, name: "Knut" })).toBeVisible();
  await ida.screenshot(shot("25-roommate"));

  // --- The smallest phones: nothing may stick out sideways ---
  await knut.setViewportSize({ width: 320, height: 640 });
  for (const [name, path] of [["home", "/home"], ["calendar", "/calendar"], ["week", "/calendar?view=week"], ["cleaning", "/cleaning"], ["dinner", dinnerUrl]] as const) {
    await knut.goto(path);
    await expect(knut.getByRole("heading", { level: 1 }).filter({ visible: true })).toBeVisible();
    await knut.waitForTimeout(400);
    await knut.screenshot(shot(`26-narrow-${name}`));
    expect(await knut.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${name} is wider than a 320 px screen`).toBeLessThanOrEqual(0);
  }

  // --- The same on a wide screen ---
  await ida.setViewportSize({ width: 1360, height: 900 });
  const wide = [
    ["home", "/home"],
    ["calendar", `/calendar?day=${inThreeDays}`],
    ["week", `/calendar?view=week&day=${inThreeDays}`],
    ["laundry", "/laundry"],
    ["dinner", dinnerUrl],
    ["board", "/board"],
    ["shower", "/shower"],
    ["expenses", "/expenses"],
    ["cleaning", "/cleaning"],
    ["shopping", "/shopping"],
    ["household", "/settings"],
    ["you", "/profile"],
  ] as const;
  for (const [name, path] of wide) {
    await ida.goto(path);
    await expect(ida.getByRole("heading", { level: 1 }).filter({ visible: true })).toBeVisible();
    await ida.waitForTimeout(400);
    await ida.screenshot(shot(`30-wide-${name}`));
  }
});
