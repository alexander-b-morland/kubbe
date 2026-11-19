import { neon } from "@neondatabase/serverless";
import { expect, test, type Page } from "@playwright/test";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

// Accounts from this run use the @kubbe.test pattern, so they can be removed afterwards.
const run = Date.now().toString(36);
const email = `e2e-nb-${run}@kubbe.test`;
const password = "correct-horse-battery";
const shot = (name: string) => ({ path: `test-shots/nb-${name}.png`, fullPage: true, caret: "initial" as const, animations: "disabled" as const });

// Next.js keeps the previous screen in the page, hidden, so only look at what is visible.
const seen = (page: Page, id: string) => page.getByTestId(id).filter({ visible: true });
const headline = (page: Page) => seen(page, "headline");

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

test("one switch turns the whole app Norwegian, and it follows the account", async ({ browser }) => {
  test.setTimeout(300_000);
  const context = await browser.newContext();
  const page = await context.newPage();

  // --- The switch is there before signing in, with each language named in itself ---
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Create account" })).toBeVisible();
  await page.getByTestId("language").getByRole("button", { name: "Norsk" }).click();
  await expect(page.getByRole("link", { name: "Opprett konto" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "nb");
  await page.screenshot(shot("01-front"));

  // --- Signing up and starting a household, in Norwegian ---
  await page.getByRole("link", { name: "Opprett konto" }).click();
  // An error from the server is said in Norwegian too.
  await page.getByRole("button", { name: "Opprett konto" }).click();
  await expect(page.getByTestId("form-error")).toContainText("Skriv inn navnet ditt.");
  await page.getByLabel("Navnet ditt").fill("Ida");
  await page.getByLabel("E-post").fill(email);
  await page.getByLabel("Passord", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Opprett konto" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Hei Ida. Hvor bor du?");
  await page.getByLabel("Navn på kollektivet").fill("Kollektivet");
  await page.getByRole("button", { name: "Opprett kollektiv" }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hei Ida");
  // The tab bar too.
  await expect(page.getByRole("navigation", { name: "Hovedmeny" }).getByRole("link", { name: "Kalender", exact: true })).toBeVisible();
  await expect(seen(page, "band-shower")).toContainText("Dusj");
  await expect(seen(page, "band-cleaning")).toContainText("Ingen turer ennå");
  await page.screenshot(shot("02-home"));

  // --- The shower was named in the language of whoever started the household ---
  await seen(page, "band-shower").click();
  await expect(page).toHaveURL(/\/shower$/);
  // Tomorrow, so the test does not depend on what time it runs.
  const tomorrow = page.getByRole("navigation", { name: "Dag" }).filter({ visible: true }).getByRole("link").nth(1);
  await tomorrow.click();
  await expect(tomorrow).toHaveAttribute("aria-current", "date");
  await page.getByRole("button", { name: /^Book \d\d:\d\d$/ }).filter({ visible: true }).first().click();
  await expect(page.getByRole("button", { name: /^Avbestill \d\d:\d\d$/ }).filter({ visible: true }).first()).toBeVisible();
  await page.screenshot(shot("03-shower"));

  // --- Cleaning: a suggestion fills in the Norwegian name ---
  await seen(page, "back").click();
  await seen(page, "band-cleaning").click();
  await page.getByRole("button", { name: "Bad", exact: true }).click();
  await page.getByRole("button", { name: "Legg til", exact: true }).click();
  await expect(seen(page, "turn-Bad")).toContainText("Hver uke");
  await expect(headline(page)).toHaveText("Din tur: Bad");
  await page.screenshot(shot("04-cleaning"));

  // --- A dinner, with a weekday and month in Norwegian ---
  await page.goto("/dinner");
  await expect(headline(page)).toHaveText("Ingen middag planlagt");
  await page.getByRole("button", { name: "Planlegg middag" }).click();
  await expect(page).toHaveURL(/\/dinner\/[0-9a-f-]{36}$/);
  await expect(headline(page)).toHaveText("Hva blir det til middag?");
  await expect(seen(page, "whos-in")).toContainText("Du er med.");
  await expect(seen(page, "back")).toHaveText("Alle middager");
  await page.screenshot(shot("05-dinner"));

  await page.goto("/calendar");
  await expect(seen(page, "sheet")).toBeVisible();
  await expect(page.getByText("man", { exact: true }).or(page.getByText("man.", { exact: true })).first()).toBeVisible();
  await page.screenshot(shot("06-calendar"));
  await page.goto("/settings");
  await expect(headline(page)).toHaveText("Kollektivet");
  await page.screenshot(shot("07-household"));
  await page.goto("/settings/rules");
  await expect(headline(page)).toHaveText("Bookingregler");
  await page.screenshot(shot("08-rules"));
  await page.goto("/home");
  await expect(seen(page, "todo")).toContainText("Din tur.");
  // The booking made above carries the shower's Norwegian name.
  await expect(seen(page, "week")).toContainText("Dusj");
  await page.screenshot(shot("09-home-later"));

  // --- The choice is saved on the account: a fresh browser gets it on signing in ---
  const other = await (await browser.newContext()).newPage();
  await other.goto("/sign-in");
  await expect(other.getByRole("heading", { level: 1 })).toHaveText("Sign in");
  await other.getByLabel("Email").fill(email);
  await other.getByLabel("Password", { exact: true }).fill(password);
  await other.getByRole("button", { name: "Sign in" }).click();
  await expect(other).toHaveURL(/\/home$/);
  await expect(other.getByRole("heading", { level: 1 })).toHaveText("Hei Ida");

  // --- And back to English, from You ---
  await other.goto("/profile");
  await other.getByTestId("language").getByRole("button", { name: "English" }).click();
  await expect(other.getByRole("heading", { name: "Your account" })).toBeVisible();
  await other.screenshot(shot("10-you-english"));
});
