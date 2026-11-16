import { neon } from "@neondatabase/serverless";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

// Accounts from this run use the @kubbe.test pattern, so they can be removed afterwards.
const run = Date.now().toString(36);
const email = (who: string) => `e2e-${who}-${run}@kubbe.test`;
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

  // Knut sees it as his, and ticks it off.
  await knut.goto("/board");
  const curtain = notes(knut).filter({ hasText: "shower curtain" });
  await expect(curtain).toContainText("For you");
  // He did not write the other note and is not an admin, so he cannot take it down.
  await expect(notes(knut).filter({ hasText: "Landlord" }).getByRole("button", { name: "Take this note down" })).toHaveCount(0);
  await curtain.getByRole("button", { name: "Mark as done" }).click();
  await expect(curtain).toHaveAttribute("data-state", "done");
  await expect(curtain).toContainText("Done by you");
  await expect(headline(knut)).toHaveText("All sorted");

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
