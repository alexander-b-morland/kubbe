import { neon } from "@neondatabase/serverless";
import { expect, test, type Page } from "@playwright/test";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

// Accounts from this run use the @kubbe.test pattern, so they can be removed afterwards.
const run = Date.now().toString(36);
const email = (who: string) => `e2e-${who}-${run}@kubbe.test`;
const password = "correct-horse-battery";
const shot = (name: string) => ({ path: `test-results/shots/${name}.png`, fullPage: true, caret: "initial" as const, animations: "disabled" as const });

async function signUp(page: Page, name: string, who: string) {
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email").fill(email(who));
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
}

// Next.js keeps the previous screen in the page, hidden, so only look at what is visible.
const slot = (page: Page, time: string) => page.getByTestId(`slot-${time}`).filter({ visible: true });
const tab = (page: Page, name: string) => page.getByRole("navigation", { name: "Main" }).getByRole("link", { name });
/**
 * Press Leave, then the question it turns into. Right after a reload the page may not be
 * interactive yet, so the first press is retried until the question shows.
 */
async function leave(page: Page) {
  const row = page.getByTestId("member-Ida");
  const question = row.getByRole("button", { name: "Leave this household?" });
  await expect(async () => {
    // A reload restores the scroll position, which can leave the row under the fixed tab bar.
    await row.evaluate((element) => element.scrollIntoView({ block: "center" }));
    // A press made before the page is interactive is replayed later, so check before pressing again.
    if (!(await question.isVisible())) {
      await row.getByRole("button", { name: "Leave", exact: true }).click({ timeout: 1000 }).catch(() => {});
    }
    await expect(question).toBeVisible({ timeout: 3000 });
  }).toPass();
  // The first press only asks. Nothing has happened yet.
  await expect(page).toHaveURL(/\/settings$/);
  await question.click();
}

/** Switch to tomorrow, and wait until the screen really shows it before going on. */
async function tomorrow(page: Page) {
  const link = page.getByRole("navigation", { name: "Day" }).filter({ visible: true }).getByRole("link").nth(1);
  await link.click();
  await expect(link).toHaveAttribute("aria-current", "date");
}

test.afterAll(async () => {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`delete from household where created_by in (select id from "user" where email like 'e2e-%@kubbe.test')`;
  await sql`delete from "user" where email like 'e2e-%@kubbe.test'`;
});

test("an admin sets the rules, then washes and dries", async ({ browser }) => {
  const ida = await (await browser.newContext()).newPage();
  await ida.goto("/sign-up");
  await signUp(ida, "Ida", "ida");
  await ida.getByLabel("Household name").fill("Kollektivet");
  await ida.getByRole("button", { name: "Create household" }).click();
  await expect(ida).toHaveURL(/\/home$/);

  // --- Rules: switch the dryer on, make shower slots 30 minutes ---
  await tab(ida, "Household").click();
  await expect(ida).toHaveURL(/\/settings$/);
  const dryer = ida.getByTestId("resource-dryer");
  await dryer.locator("summary").click();
  await dryer.getByLabel("This household has one").check();
  await dryer.getByRole("button", { name: "Save dryer" }).click();
  await expect(dryer.getByRole("status")).toHaveText("Saved");

  const shower = ida.getByTestId("resource-shower");
  await shower.locator("summary").click();
  await shower.getByLabel("Slot length").selectOption("30");
  await shower.getByLabel("Until").selectOption("22:00");
  await shower.getByRole("button", { name: "Save shower" }).click();
  await expect(shower.getByRole("status")).toHaveText("Saved");
  // The form shows what was saved, not what it showed before.
  await expect(shower.getByLabel("Slot length")).toHaveValue("30");
  await expect(shower.getByLabel("Until")).toHaveValue("22:00");
  await ida.screenshot(shot("l1-settings"));

  // A nonsense rule is refused with a reason.
  await shower.getByLabel("Until").selectOption("05:00");
  await shower.getByRole("button", { name: "Save shower" }).click();
  await expect(shower.getByTestId("form-error")).toHaveText("Closing time must be after opening time.");

  await tab(ida, "Shower").click();
  await tomorrow(ida);
  await expect(slot(ida, "06:30")).toBeVisible();
  await expect(slot(ida, "06:20")).toHaveCount(0);
  await expect(slot(ida, "21:30")).toBeVisible();
  await expect(slot(ida, "22:00")).toHaveCount(0);

  // --- Laundry: book a wash, take the dryer suggestion ---
  await tab(ida, "Laundry").click();
  await expect(ida).toHaveURL(/\/laundry$/);
  await tomorrow(ida);
  await expect(ida.getByRole("navigation", { name: "Machine" }).getByRole("link")).toHaveText(["Washing machine", "Dryer"]);
  await ida.getByRole("button", { name: "Book 09:00" }).click();
  await expect(ida.getByRole("button", { name: "Cancel 09:00" })).toBeVisible();
  const suggestion = ida.getByTestId("dryer-suggestion");
  await expect(suggestion).toContainText("Your wash ends at 11:00. The dryer is free from 11:00.");
  await ida.screenshot(shot("l2-laundry"));
  await suggestion.getByRole("button", { name: "Book dryer 11:00" }).click();
  await expect(suggestion).toHaveCount(0);

  await ida.getByRole("navigation", { name: "Machine" }).getByRole("link", { name: "Dryer" }).click();
  await expect(slot(ida, "11:00")).toHaveAttribute("data-state", "mine");
  await ida.screenshot(shot("l3-dryer"));

  // --- People: a member cannot change rules; the last admin cannot leave ---
  await tab(ida, "Household").click();
  const code = (await ida.getByTestId("join-code").innerText()).replace(/\s/g, "");
  const knut = await (await browser.newContext()).newPage();
  await knut.goto(`/join/${code}`);
  await signUp(knut, "Knut", "knut");
  await knut.getByRole("button", { name: "Join household" }).click();
  await expect(knut).toHaveURL(/\/home$/);
  await tab(knut, "Household").click();
  await expect(knut.getByText("Only an admin can change this.").first()).toBeVisible();
  await expect(knut.getByTestId("resource-shower")).toHaveCount(0);
  await expect(knut.getByRole("button", { name: "Make admin" })).toHaveCount(0);

  await ida.reload();
  const idaRow = ida.getByTestId("member-Ida");
  await leave(ida);
  await expect(idaRow.getByRole("alert")).toContainText("You're the only admin");

  await ida.getByTestId("member-Knut").getByRole("button", { name: "Make admin" }).click();
  await expect(ida.getByTestId("member-Knut").getByText("Admin", { exact: true })).toBeVisible();
  await knut.reload();
  await expect(knut.getByTestId("resource-shower")).toBeVisible();

  // --- You: change your name; replace the join code ---
  await knut.getByLabel("Your name").fill("Knut B");
  await knut.getByRole("button", { name: "Save", exact: true }).click();
  await expect(knut.getByTestId("member-Knut B")).toContainText("(you)");

  await knut.getByRole("button", { name: "Replace with a new code" }).click();
  await expect(knut.getByTestId("join-code")).not.toHaveText(`${code.slice(0, 3)} ${code.slice(3)}`);
  const stranger = await (await browser.newContext()).newPage();
  await stranger.goto(`/join/${code}`);
  await signUp(stranger, "Per", "per");
  await expect(stranger.getByRole("heading", { level: 1 })).toHaveText("That link doesn't work");

  // --- Leaving works once there is another admin ---
  await ida.reload();
  await leave(ida);
  await expect(ida).toHaveURL(/\/onboarding$/);
});
