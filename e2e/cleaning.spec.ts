import { neon } from "@neondatabase/serverless";
import { expect, test, type Page } from "@playwright/test";
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

const tab = (page: Page, name: string) => page.getByRole("navigation", { name: "Main" }).getByRole("link", { name });
const turn = (page: Page, room: string) => page.getByTestId(`turn-${room}`).filter({ visible: true });
const headline = (page: Page) => page.getByTestId("headline").filter({ visible: true });

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

test("rooms go round between roommates, and turns can be done or taken over", async ({ browser }) => {
  const ida = await (await browser.newContext()).newPage();
  await ida.goto("/sign-up");
  await signUp(ida, "Ida", "ida");
  await ida.getByLabel("Household name").fill("Kollektivet");
  await ida.getByRole("button", { name: "Create household" }).click();
  await expect(ida).toHaveURL(/\/home$/);
  const code = (await ida.getByTestId("join-code").innerText()).replace(/\s/g, "");

  // --- An admin adds the rooms ---
  await tab(ida, "Cleaning").click();
  await expect(headline(ida)).toHaveText("No rooms yet");
  await ida.screenshot(shot("c1-empty"));
  await ida.getByRole("button", { name: "Bathroom", exact: true }).click();
  await ida.getByRole("button", { name: "Add room" }).click();
  await expect(turn(ida, "Bathroom")).toBeVisible();
  await ida.getByLabel("Room or chore").fill("Kitchen");
  await ida.getByLabel("Takes about").last().selectOption("45");
  await ida.getByRole("button", { name: "Add room" }).click();
  await expect(turn(ida, "Kitchen")).toContainText("about 45 min");
  await expect(headline(ida)).toHaveText("2 rooms are yours");

  // --- A second person joins. Turns already under way stay with whoever has them ---
  const knut = await (await browser.newContext()).newPage();
  await knut.goto(`/join/${code}`);
  await expect(knut.getByRole("heading", { level: 1 })).toHaveText("You're invited to Kollektivet");
  await knut.getByRole("link", { name: "Create account" }).click();
  await signUp(knut, "Knut", "knut");
  await knut.getByRole("button", { name: "Join Kollektivet" }).click();
  await expect(knut).toHaveURL(/\/home$/);
  await tab(knut, "Cleaning").click();
  await expect(headline(knut)).toHaveText("Nothing for you now");
  await expect(knut.getByRole("heading", { name: "Rooms" })).toHaveCount(0);
  await ida.reload();
  await expect(headline(ida)).toHaveText("2 rooms are yours");
  // The rotation only takes Knut in from the next round: he is next for the bathroom.
  await expect(turn(ida, "Bathroom")).toContainText("Next: Knut");

  // The admin deals this round out again, now that there are two of them.
  const redeal = ida.getByTestId("redeal");
  await redeal.getByRole("button", { name: "Deal turns out again" }).click();
  await redeal.getByRole("button", { name: "Deal this round's turns out again?" }).click();
  await expect(redeal.getByRole("status")).toHaveText("Dealt out again.");
  await knut.reload();
  await expect(headline(knut)).toHaveText("Your turn: Kitchen");
  await expect(knut.getByTestId("redeal")).toHaveCount(0);

  await ida.reload();
  await expect(headline(ida)).toHaveText("Your turn: Bathroom");
  await expect(turn(ida, "Bathroom")).toHaveAttribute("data-state", "mine");
  await expect(turn(ida, "Kitchen")).toHaveAttribute("data-state", "theirs");
  await expect(turn(ida, "Kitchen")).toContainText("Knut");
  await ida.screenshot(shot("c2-rota"));

  // --- Done, and undone ---
  await ida.getByRole("button", { name: "Done: Bathroom" }).click();
  await expect(turn(ida, "Bathroom")).toHaveAttribute("data-state", "done");
  await expect(turn(ida, "Bathroom")).toContainText("Done by you");
  await expect(headline(ida)).toHaveText("Nothing for you now");
  await ida.getByRole("button", { name: "Not done: Bathroom" }).click();
  await expect(turn(ida, "Bathroom")).toHaveAttribute("data-state", "mine");
  await ida.getByRole("button", { name: "Done: Bathroom" }).click();
  await expect(turn(ida, "Bathroom")).toHaveAttribute("data-state", "done");

  // --- Taking a turn over, and giving it back ---
  await ida.getByRole("button", { name: "Take over Kitchen" }).click();
  await expect(turn(ida, "Kitchen")).toHaveAttribute("data-state", "mine");
  await knut.reload();
  await expect(headline(knut)).toHaveText("Nothing for you now");
  await ida.getByRole("button", { name: "Give back Kitchen" }).click();
  await expect(turn(ida, "Kitchen")).toHaveAttribute("data-state", "theirs");

  // --- When everything is done ---
  await knut.reload();
  await knut.getByRole("button", { name: "Done: Kitchen" }).click();
  await expect(headline(knut)).toHaveText("All clean");
  await ida.reload();
  await expect(headline(ida)).toHaveText("All clean");
  await expect(turn(ida, "Kitchen")).toContainText("Done by Knut");
  await expect(ida.getByRole("region", { name: "Turns done, last 8 weeks" })).toContainText("You1 turn done");
  await ida.screenshot(shot("c3-all-clean"));

  // --- An admin changes and removes rooms ---
  const rooms = ida.getByRole("region", { name: "Rooms" });
  await rooms.locator("summary", { hasText: "Bathroom" }).click();
  // Nothing to save until something is changed.
  await expect(rooms.getByRole("button", { name: "Save", exact: true })).toHaveCount(0);
  await rooms.getByLabel("How often").first().selectOption("14");
  await rooms.getByRole("button", { name: "Save", exact: true }).click();
  await expect(rooms.locator("summary", { hasText: "Bathroom" })).toContainText("Every 2 weeks");
  // A new rhythm starts over, so the room is open again.
  await expect(turn(ida, "Bathroom")).not.toHaveAttribute("data-state", "done");

  await rooms.locator("summary", { hasText: "Kitchen" }).click();
  await rooms.getByRole("button", { name: "Remove Kitchen", exact: true }).click();
  await expect(turn(ida, "Kitchen")).toBeVisible();
  await rooms.getByRole("button", { name: "Remove Kitchen for everyone?" }).click();
  await expect(turn(ida, "Kitchen")).toHaveCount(0);
});
