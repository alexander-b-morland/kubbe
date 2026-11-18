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
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
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

test("create a household, invite a roommate by link, sign back in", async ({ browser }) => {
  // --- Ida creates an account and a household ---
  const idaContext = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"] });
  const ida = await idaContext.newPage();
  await ida.goto("/");
  await ida.getByRole("link", { name: "Create account" }).click();
  await signUp(ida, "Ida", "ida");
  await expect(ida).toHaveURL(/\/onboarding$/);
  await expect(ida.getByRole("heading", { level: 1 })).toContainText("Hi Ida");
  await ida.screenshot({ path: "test-shots/1-onboarding.png", fullPage: true, caret: "initial" });

  // A wrong code is explained, not just rejected.
  await ida.getByLabel("Join code").fill("zzz zzz");
  await ida.getByRole("button", { name: "Join household" }).click();
  await expect(ida.getByTestId("form-error")).toContainText("No household has that code");

  await ida.getByLabel("Household name").fill("Kollektivet");
  await ida.getByRole("button", { name: "Create household" }).click();
  await expect(ida).toHaveURL(/\/home$/);
  await expect(ida.getByRole("heading", { level: 1 })).toHaveText("Hi Ida");
  await expect(ida.getByText("Kollektivet", { exact: true })).toBeVisible();
  const code = (await ida.getByTestId("join-code").innerText()).replace(/\s/g, "");
  expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);

  // Sharing copies the invite link and says so.
  await ida.getByRole("button", { name: "Share invite link" }).click();
  await expect(ida.getByRole("button", { name: "Link copied" })).toBeVisible();
  expect(await ida.evaluate(() => navigator.clipboard.readText())).toBe(`${new URL(ida.url()).origin}/join/${code}`);
  await ida.screenshot({ path: "test-shots/2-home-alone.png", fullPage: true, caret: "initial" });

  // --- Knut opens the invite link without an account ---
  const knutContext = await browser.newContext();
  const knut = await knutContext.newPage();
  await knut.goto(`/join/${code.toLowerCase()}`);
  // He is told what he is invited to before being asked for anything.
  await expect(knut.getByRole("heading", { level: 1 })).toHaveText("You're invited to Kollektivet");
  await expect(knut.getByText("One person lives there so far.")).toBeVisible();
  await knut.screenshot({ path: "test-shots/3-invite.png", fullPage: true, caret: "initial", animations: "disabled" });
  await knut.getByRole("link", { name: "Create account" }).click();
  await expect(knut).toHaveURL(/\/sign-up\?next=/);
  await expect(knut.getByRole("heading", { level: 1 })).toHaveText("Create your account");
  await signUp(knut, "Knut", "knut");
  await expect(knut.getByRole("heading", { level: 1 })).toHaveText("Join Kollektivet?");
  await knut.screenshot({ path: "test-shots/4-join.png", fullPage: true, caret: "initial", animations: "disabled" });
  await knut.getByRole("button", { name: "Join Kollektivet" }).click();
  await expect(knut).toHaveURL(/\/home$/);
  await expect(knut.getByRole("heading", { level: 1 })).toHaveText("Hi Knut");
  // Once there are two of you, the invite card makes way for what is going on.
  await expect(knut.getByTestId("join-code")).toHaveCount(0);
  // Every area has a tile, and an old link to the hub that used to hold them lands on Home.
  for (const area of ["shower", "laundry", "cleaning", "dinner", "shopping", "expenses", "happenings", "board"]) {
    await expect(knut.getByTestId(`band-${area}`)).toBeVisible();
  }
  await knut.screenshot({ path: "test-shots/5-home-two.png", fullPage: true, caret: "initial", animations: "disabled" });
  await knut.goto("/flat");
  await expect(knut).toHaveURL(/\/home$/);
  const main = knut.getByRole("navigation", { name: "Main" });
  await main.getByRole("link", { name: "Household", exact: true }).click();
  await expect(knut.getByText("Knut (you)")).toBeVisible();
  await knut.screenshot({ path: "test-shots/6-household.png", fullPage: true, caret: "initial", animations: "disabled" });

  // Ida sees Knut after a reload, and only Ida is admin.
  await ida.goto("/settings");
  await expect(ida.getByTestId("member-Knut")).toBeVisible();
  await expect(ida.getByText("Admin", { exact: true })).toHaveCount(1);

  // --- Knut signs out and back in ---
  await main.getByRole("link", { name: "You", exact: true }).click();
  await expect(knut.getByRole("heading", { level: 1 })).toHaveText("You");
  await knut.getByRole("button", { name: "Sign out" }).click();
  await expect(knut).toHaveURL(/\/$/);
  await knut.goto("/home");
  await expect(knut).toHaveURL(/\/sign-in$/);
  await knut.getByLabel("Email").fill(email("knut"));
  await knut.getByLabel("Password", { exact: true }).fill("wrong-password");
  await knut.getByRole("button", { name: "Sign in" }).click();
  await expect(knut.getByTestId("form-error")).toHaveText("Wrong email or password. Check both and try again.");
  // The Show button reveals what was typed, since there is no password reset yet.
  await knut.getByRole("button", { name: "Show password" }).click();
  await expect(knut.getByLabel("Password", { exact: true })).toHaveAttribute("type", "text");
  await knut.getByLabel("Password", { exact: true }).fill(password);
  await knut.getByRole("button", { name: "Sign in" }).click();
  await expect(knut).toHaveURL(/\/home$/);

  // An email can only have one account.
  const third = await (await browser.newContext()).newPage();
  await third.goto("/sign-up");
  await signUp(third, "Imposter", "ida");
  await expect(third.getByTestId("form-error")).toContainText("already has an account");

  // A redirect after signing in can only lead to an invite, never to another site.
  const fourth = await (await browser.newContext()).newPage();
  await fourth.goto("/sign-in?next=/%5Cexample.com");
  await fourth.getByLabel("Email").fill(email("ida"));
  await fourth.getByLabel("Password", { exact: true }).fill(password);
  await fourth.getByRole("button", { name: "Sign in" }).click();
  await expect(fourth).toHaveURL(/\/home$/);

  // A link with a code nobody has says so straight away, before any sign-up.
  const lost = await (await browser.newContext()).newPage();
  await lost.goto("/join/ZZZZZZ");
  await expect(lost.getByRole("heading", { level: 1 })).toHaveText("That link doesn't work");
});
