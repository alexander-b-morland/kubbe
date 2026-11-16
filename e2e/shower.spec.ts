import { neon } from "@neondatabase/serverless";
import { expect, test, type Page } from "@playwright/test";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

// Accounts from this run use the @kubbe.test pattern, so they can be removed afterwards.
const run = Date.now().toString(36);
const email = (who: string) => `e2e-${who}-${run}@kubbe.test`;
const password = "correct-horse-battery";
const shot = (name: string) => ({ path: `test-shots/${name}.png`, fullPage: true, caret: "initial" as const });

async function signUp(page: Page, name: string, who: string) {
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email").fill(email(who));
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
}

// Next.js keeps the previous screen in the page, hidden, so only look at what is visible.
const slot = (page: Page, time: string) => page.getByTestId(`slot-${time}`).filter({ visible: true });
const state = async (page: Page, time: string) => (await slot(page, time).getAttribute("data-state")) ?? "";
/** Switch to tomorrow, and wait until the screen really shows it before going on. */
async function tomorrow(page: Page) {
  const link = page.getByRole("navigation", { name: "Day" }).filter({ visible: true }).getByRole("link").nth(1);
  await link.click();
  await expect(link).toHaveAttribute("aria-current", "date");
}

/** Book a slot and wait until the server has confirmed it (the Cancel button only shows then). */
async function book(page: Page, time: string) {
  await page.getByRole("button", { name: `Book ${time}` }).click();
  await expect(page.getByRole("button", { name: `Cancel ${time}` })).toBeVisible();
}

test.afterAll(async () => {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`delete from household where created_by in (select id from "user" where email like 'e2e-%@kubbe.test')`;
  await sql`delete from "user" where email like 'e2e-%@kubbe.test'`;
});

test("book the shower, with the rules holding between two roommates", async ({ browser }) => {
  // --- Ida sets up the household and opens the shower ---
  const ida = await (await browser.newContext()).newPage();
  await ida.goto("/sign-up");
  await signUp(ida, "Ida", "ida");
  await ida.getByLabel("Household name").fill("Kollektivet");
  await ida.getByRole("button", { name: "Create household" }).click();
  await expect(ida).toHaveURL(/\/home$/);
  const code = (await ida.getByTestId("join-code").innerText()).replace(/\s/g, "");

  await ida.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Shower" }).click();
  await expect(ida).toHaveURL(/\/shower$/);
  await expect(ida.getByTestId("headline")).toBeVisible();
  // Tomorrow, so the test does not depend on what time it runs.
  await tomorrow(ida);
  await expect(ida).toHaveURL(/\/shower\?day=\d{4}-\d{2}-\d{2}$/);
  await expect(slot(ida, "07:00")).toHaveAttribute("data-state", "free");
  await ida.screenshot(shot("s1-shower-empty"));

  // --- Booking circles the time and shows it as yours ---
  await ida.getByRole("button", { name: "Book 07:00" }).click();
  await ida.screenshot(shot("s2-booking-in-progress"));
  await expect(slot(ida, "07:00")).toHaveAttribute("data-state", "mine");
  await expect(slot(ida, "07:00").getByText("You")).toBeVisible();
  await expect(ida.getByRole("button", { name: "Cancel 07:00" })).toBeVisible();

  // No back to back: the slots on either side are closed to Ida, and say why.
  for (const time of ["06:40", "07:20"]) {
    await expect(slot(ida, time)).toHaveAttribute("data-state", "blocked");
    await expect(slot(ida, time)).toContainText("Right next to your slot");
  }
  await expect(ida.getByRole("button", { name: "Book 07:20" })).toHaveCount(0);
  await ida.screenshot({ ...shot("s3-booked"), animations: "disabled" });

  // --- Knut joins and sees Ida's slot as taken ---
  const knut = await (await browser.newContext()).newPage();
  await knut.goto(`/join/${code}`);
  await signUp(knut, "Knut", "knut");
  await knut.getByRole("button", { name: "Join household" }).click();
  await expect(knut).toHaveURL(/\/home$/);
  await knut.goto(new URL(ida.url()).pathname + new URL(ida.url()).search);
  await expect(slot(knut, "07:00")).toHaveAttribute("data-state", "taken");
  await expect(slot(knut, "07:00")).toContainText("Ida");
  await expect(knut.getByRole("button", { name: "Book 07:00" })).toHaveCount(0);

  // Next to someone else's slot is fine.
  await book(knut, "07:20");

  // --- Two people press Book on the same slot at the same moment ---
  await Promise.all([ida.reload(), knut.reload()]);
  await expect(ida.getByRole("button", { name: "Book 10:00" })).toBeVisible();
  await expect(knut.getByRole("button", { name: "Book 10:00" })).toBeVisible();
  await Promise.all([
    ida.getByRole("button", { name: "Book 10:00" }).click(),
    knut.getByRole("button", { name: "Book 10:00" }).click(),
  ]);
  // Exactly one of them gets it. The other is told, and sees who has it.
  await expect
    .poll(async () => [await state(ida, "10:00"), await state(knut, "10:00")].sort().join())
    .toBe("mine,taken");
  const idaWon = (await state(ida, "10:00")) === "mine";
  const [winner, loser, winnerName] = idaWon ? [ida, knut, "Ida"] : [knut, ida, "Knut"];
  await expect(winner.getByRole("button", { name: "Cancel 10:00" })).toBeVisible();
  await expect(loser.getByTestId("slot-error")).toContainText("Someone just took that slot");
  await expect(slot(loser, "10:00")).toContainText(winnerName);
  await loser.screenshot({ ...shot("s4-taken"), animations: "disabled" });

  // --- The daily limit is three ---
  for (const time of idaWon ? ["12:00"] : ["12:00", "15:00"]) await book(ida, time);
  await expect(slot(ida, "18:00")).toHaveAttribute("data-state", "blocked");
  await expect(slot(ida, "18:00")).toContainText("You've used your slots");

  // --- Home tells Knut about his next slot ---
  await knut.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Home" }).click();
  await expect(knut.getByTestId("band-shower")).toContainText("Your slot: 07:20 tomorrow");
  await knut.screenshot({ ...shot("s5-home"), animations: "disabled" });
  await knut.goBack();

  // --- Cancelling gives the slot back ---
  await ida.getByRole("button", { name: "Cancel 07:00" }).click();
  await expect(slot(ida, "07:00")).toHaveAttribute("data-state", "free");
  await expect(ida.getByRole("button", { name: "Book 07:00" })).toBeVisible();
  await expect(slot(ida, "18:00")).toHaveAttribute("data-state", "free");
  await knut.reload();
  await expect(slot(knut, "07:00")).toHaveAttribute("data-state", "blocked");
});
