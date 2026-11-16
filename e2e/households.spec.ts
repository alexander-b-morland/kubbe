import { neon } from "@neondatabase/serverless";
import { expect, test, type Page } from "@playwright/test";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

// Every account this run creates uses this address pattern, so it can be removed afterwards.
const run = Date.now().toString(36);
const email = (who: string) => `e2e-${who}-${run}@kubbe.test`;
const password = "correct-horse-battery";

async function signUp(page: Page, name: string, who: string) {
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email").fill(email(who));
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
}

test.afterAll(async () => {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`delete from household where created_by in (select id from "user" where email like 'e2e-%@kubbe.test')`;
  await sql`delete from "user" where email like 'e2e-%@kubbe.test'`;
});

test("create a household, invite a roommate by link, sign back in", async ({ browser }) => {
  // --- Ida creates an account and a household ---
  const idaContext = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"] });
  const ida = await idaContext.newPage();
  await ida.goto("/");
  await ida.getByRole("link", { name: "Create account" }).click();
  await signUp(ida, "Ida", "ida");
  await expect(ida).toHaveURL(/\/onboarding$/);
  await expect(ida.getByRole("heading", { level: 1 })).toContainText("Hi Ida");
  await ida.screenshot({ path: "test-results/shots/1-onboarding.png", fullPage: true, caret: "initial" });

  // A wrong code is explained, not just rejected.
  await ida.getByLabel("Join code").fill("zzz zzz");
  await ida.getByRole("button", { name: "Join household" }).click();
  await expect(ida.getByTestId("form-error")).toContainText("No household has that code");

  await ida.getByLabel("Household name").fill("Kollektivet");
  await ida.getByRole("button", { name: "Create household" }).click();
  await expect(ida).toHaveURL(/\/home$/);
  await expect(ida.getByRole("heading", { level: 1 })).toHaveText("Kollektivet");
  await expect(ida.getByText("Just you so far")).toBeVisible();
  const code = (await ida.getByTestId("join-code").innerText()).replace(/\s/g, "");
  expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);

  // Sharing copies the invite link and says so.
  await ida.getByRole("button", { name: "Share invite link" }).click();
  await expect(ida.getByRole("button", { name: "Link copied" })).toBeVisible();
  expect(await ida.evaluate(() => navigator.clipboard.readText())).toBe(`http://localhost:3000/join/${code}`);
  await ida.screenshot({ path: "test-results/shots/2-home-alone.png", fullPage: true, caret: "initial" });

  // --- Knut opens the invite link without an account ---
  const knutContext = await browser.newContext();
  const knut = await knutContext.newPage();
  await knut.goto(`/join/${code.toLowerCase()}`);
  await expect(knut).toHaveURL(/\/sign-up\?next=/);
  await expect(knut.getByRole("heading", { level: 1 })).toHaveText("Create your account");
  await knut.screenshot({ path: "test-results/shots/3-sign-up.png", fullPage: true, caret: "initial" });
  await signUp(knut, "Knut", "knut");
  await expect(knut.getByRole("heading", { level: 1 })).toHaveText("Join Kollektivet?");
  await knut.screenshot({ path: "test-results/shots/4-join.png", fullPage: true, caret: "initial" });
  await knut.getByRole("button", { name: "Join household" }).click();
  await expect(knut).toHaveURL(/\/home$/);
  await expect(knut.getByText("2 people live here")).toBeVisible();
  await expect(knut.getByText("Knut (you)")).toBeVisible();
  await knut.screenshot({ path: "test-results/shots/5-home-two.png", fullPage: true, caret: "initial", animations: "disabled" });

  // Ida sees Knut after a reload, and only Ida is admin.
  await ida.reload();
  await expect(ida.getByText("2 people live here")).toBeVisible();
  await expect(ida.getByText("Admin")).toHaveCount(1);

  // --- Knut signs out and back in ---
  await knut.getByRole("button", { name: "Sign out" }).click();
  await expect(knut).toHaveURL(/\/$/);
  await knut.goto("/home");
  await expect(knut).toHaveURL(/\/sign-in$/);
  await knut.getByLabel("Email").fill(email("knut"));
  await knut.getByLabel("Password").fill("wrong-password");
  await knut.getByRole("button", { name: "Sign in" }).click();
  await expect(knut.getByTestId("form-error")).toHaveText("Wrong email or password.");
  await knut.getByLabel("Password").fill(password);
  await knut.getByRole("button", { name: "Sign in" }).click();
  await expect(knut).toHaveURL(/\/home$/);

  // An email can only have one account.
  const third = await (await browser.newContext()).newPage();
  await third.goto("/sign-up");
  await signUp(third, "Imposter", "ida");
  await expect(third.getByTestId("form-error")).toContainText("already has an account");
});
