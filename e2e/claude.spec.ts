import { neon } from "@neondatabase/serverless";
import { expect, test, type Page } from "@playwright/test";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

// Checks that dinner help really comes from Claude where a key is set. It costs a cent
// or two a run, so it only runs when asked for:
//   E2E_EXPECT_CLAUDE=1 E2E_BASE_URL=https://kubbe-zeta.vercel.app npx playwright test e2e/claude.spec.ts
test.skip(!process.env.E2E_EXPECT_CLAUDE, "Set E2E_EXPECT_CLAUDE=1 to check the live Claude answers.");

const run = Date.now().toString(36);
const email = `e2e-claude-${run}@kubbe.test`;
const seen = (page: Page, id: string) => page.getByTestId(id).filter({ visible: true });

test.afterAll(async () => {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`delete from household where created_by in (select id from "user" where email like 'e2e-claude-%@kubbe.test')`;
  await sql`delete from "user" where email like 'e2e-claude-%@kubbe.test'`;
});

test("Claude suggests dishes and what a dish needs", async ({ page }) => {
  test.slow();
  await page.goto("/sign-up");
  await page.getByLabel("Your name").fill("Ida");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("correct-horse-battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByLabel("Household name").fill("Kollektivet");
  await page.getByRole("button", { name: "Create household" }).click();
  await expect(page).toHaveURL(/\/home$/);

  // Someone at the table does not eat meat or fish: the ideas must respect that.
  await page.goto("/profile");
  await page.locator('input[name="avoids"]').fill("Vegetarian");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved")).toBeVisible();

  await page.goto("/dinner");
  await page.getByRole("button", { name: "Plan dinner" }).click();
  await expect(page).toHaveURL(/\/dinner\/[0-9a-f-]{36}$/);

  // A dish the built-in cookbook does not know, so only Claude can say what it needs.
  await page.getByLabel("Suggest a dish").fill("Bibimbap");
  await page.getByLabel("Suggest a dish").press("Enter");
  await expect(seen(page, "needs-note")).toContainText("Filled in by Claude", { timeout: 40_000 });
  const needs = page.getByLabel("What it needs");
  console.log("What it needs:", await needs.inputValue());
  await expect(needs).toHaveValue(/rice/i);

  await page.getByLabel("Suggest a dish").fill("");
  await seen(page, "get-ideas").click();
  await expect(seen(page, "idea")).toHaveCount(3, { timeout: 60_000 });
  await expect(seen(page, "ideas-source")).toHaveAttribute("data-source", "claude");
  for (const idea of await seen(page, "idea").allInnerTexts()) console.log("Idea:", idea.replace(/\s+/g, " "));

  // --- In Norwegian, Claude answers in Norwegian ---
  const dinner = page.url();
  await page.goto("/profile");
  await page.getByTestId("language").getByRole("button", { name: "Norsk" }).click();
  await expect(page.getByRole("heading", { name: "Kontoen din" })).toBeVisible();
  await page.goto(dinner);
  await page.getByLabel("Foreslå en rett").fill("Lapskaus");
  await page.getByLabel("Foreslå en rett").press("Enter");
  await expect(seen(page, "needs-note")).toContainText("Fylt inn av Claude", { timeout: 40_000 });
  const trengs = page.getByLabel("Hva som trengs");
  console.log("Hva som trengs:", await trengs.inputValue());
  // Norwegian words for what a stew needs, not English ones.
  await expect(trengs).toHaveValue(/potet|gulrot|løk|kålrot/i);
  await expect(trengs).not.toHaveValue(/potato|carrot|onion/i);
});
