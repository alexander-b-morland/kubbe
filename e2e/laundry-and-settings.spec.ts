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

// Next.js keeps the previous screen in the page, hidden, so only look at what is visible.
const slot = (page: Page, time: string) => page.getByTestId(`slot-${time}`).filter({ visible: true });
// The way around: four tabs, and every area as a tile on Home.
const nav = (page: Page, name: string) => page.getByRole("navigation", { name: "Main" }).getByRole("link", { name, exact: true });
/** Open an area the way a person does: Home, then its tile. */
async function openArea(page: Page, key: string) {
  await nav(page, "Home").click();
  await page.getByTestId(`band-${key}`).filter({ visible: true }).click();
  await expect(page).toHaveURL(new RegExp(`/${key}(\\?|$)`));
}
async function openHousehold(page: Page) {
  await nav(page, "Household").click();
  await expect(page).toHaveURL(/\/settings$/);
}
/** The rules for showers and machines are one step in from Household. */
async function openRules(page: Page) {
  await openHousehold(page);
  await page.getByTestId("open-rules").filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/settings\/rules$/);
}
/**
 * Press "Leave Kollektivet" under You, then the question it turns into. Right after a reload the page
 * may not be interactive yet, so the first press is retried until the question shows.
 */
async function leave(page: Page, question: string) {
  const area = page.getByTestId("leave");
  const confirm = area.getByRole("button", { name: question });
  await expect(async () => {
    // A reload restores the scroll position, which can leave the button under the fixed tab bar.
    await area.evaluate((element) => element.scrollIntoView({ block: "center" }));
    // A press made before the page is interactive is replayed later, so check before pressing again.
    if (!(await confirm.isVisible())) {
      await area.getByRole("button", { name: "Leave Kollektivet" }).click({ timeout: 1000 }).catch(() => {});
    }
    await expect(confirm).toBeVisible({ timeout: 3000 });
  }).toPass();
  // The first press only asks, and offers a way back. Nothing has happened yet.
  await expect(area.getByRole("button", { name: "Keep as it is" })).toBeVisible();
  await expect(page).toHaveURL(/\/profile$/);
  await confirm.click();
}

/** Switch to tomorrow, and wait until the screen really shows it before going on. */
async function tomorrow(page: Page) {
  const link = page.getByRole("navigation", { name: "Day" }).filter({ visible: true }).getByRole("link").nth(1);
  await link.click();
  await expect(link).toHaveAttribute("aria-current", "date");
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

test("an admin sets the rules, then washes and dries", async ({ browser }) => {
  // Three people, the rules, laundry and the household: longer than the default allows.
  test.slow();
  const ida = await (await browser.newContext()).newPage();
  await ida.goto("/sign-up");
  await signUp(ida, "Ida", "ida");
  await ida.getByLabel("Household name").fill("Kollektivet");
  await ida.getByRole("button", { name: "Create household" }).click();
  await expect(ida).toHaveURL(/\/home$/);

  // --- Rules: switch the dryer on, make shower slots 30 minutes ---
  await openRules(ida);
  // Settings that already have a value show no Save button until something changes.
  await expect(ida.getByRole("button", { name: /^Save/ })).toHaveCount(0);
  const dryer = ida.getByTestId("resource-dryer");
  await dryer.locator("summary").click();
  await expect(dryer.getByRole("button", { name: "Save", exact: true })).toHaveCount(0);
  // A second dryer is only offered once the first is in use.
  await expect(ida.getByTestId("add-dryer")).toHaveCount(0);
  await dryer.getByLabel("Can be booked").check();
  await dryer.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dryer.getByRole("status")).toHaveText("Saved");
  await expect(ida.getByTestId("add-dryer")).toBeVisible();

  const shower = ida.getByTestId("resource-shower");
  await shower.locator("summary").click();
  await shower.getByLabel("Slot length").selectOption("30");
  await shower.getByLabel("Until").selectOption("22:00");
  await shower.getByRole("button", { name: "Save", exact: true }).click();
  await expect(shower.getByRole("status")).toHaveText("Saved");
  // The form shows what was saved, not what it showed before.
  await expect(shower.getByLabel("Slot length")).toHaveValue("30");
  await expect(shower.getByLabel("Until")).toHaveValue("22:00");
  await ida.screenshot(shot("l1-settings"));

  // A nonsense rule is refused with a reason.
  await shower.getByLabel("Until").selectOption("05:00");
  await shower.getByRole("button", { name: "Save", exact: true }).click();
  await expect(shower.getByTestId("form-error")).toHaveText("Closing time must be after opening time.");

  // --- A second shower: add it, book it, remove it again ---
  await ida.getByTestId("add-shower").getByRole("button", { name: "+ Add another shower" }).click();
  const second = ida.locator('[data-testid="resource-shower"][data-name="Shower 2"]');
  await expect(second).toBeVisible();
  // It starts with the rules the first shower was given, not the app's defaults.
  await expect(second).toContainText("30-minute slots, 06:00 to 22:00");
  await openArea(ida, "shower");
  const which = ida.getByRole("navigation", { name: "Which shower" }).filter({ visible: true });
  await expect(which.getByRole("link")).toHaveText(["Shower", "Shower 2"]);
  await which.getByRole("link", { name: "Shower 2" }).click();
  await expect(which.getByRole("link", { name: "Shower 2" })).toHaveAttribute("aria-current", "page");
  await tomorrow(ida);
  await ida.getByRole("button", { name: "Book 06:30" }).click();
  await expect(ida.getByRole("button", { name: "Cancel 06:30", exact: true })).toBeVisible();
  await openRules(ida);
  await second.locator("summary").click();
  await second.getByRole("button", { name: "Remove Shower 2", exact: true }).click();
  await second.getByRole("button", { name: "Remove Shower 2 and its bookings?" }).click();
  await expect(ida.getByTestId("resource-shower")).toHaveCount(1);
  // The only one left of a kind cannot be removed, only switched off.
  await expect(shower.getByRole("button", { name: /^Remove/ })).toHaveCount(0);

  await openArea(ida, "shower");
  await tomorrow(ida);
  await expect(slot(ida, "06:30")).toBeVisible();
  await expect(slot(ida, "06:20")).toHaveCount(0);
  await expect(slot(ida, "21:30")).toBeVisible();
  await expect(slot(ida, "22:00")).toHaveCount(0);

  // --- Laundry: book a wash, take the dryer suggestion ---
  await openArea(ida, "laundry");
  await expect(ida).toHaveURL(/\/laundry$/);
  await tomorrow(ida);
  await expect(ida.getByRole("navigation", { name: "Machine" }).getByRole("link")).toHaveText(["Washing machine", "Dryer"]);
  await ida.getByRole("button", { name: "Book 09:00" }).click();
  await expect(ida.getByRole("button", { name: "Cancel 09:00", exact: true })).toBeVisible();
  const suggestion = ida.getByTestId("dryer-suggestion");
  await expect(suggestion).toContainText("Your wash ends at 11:00. Want the dryer after it?");
  await ida.screenshot(shot("l2-laundry"));
  await suggestion.getByRole("button", { name: "Book dryer at 11:00" }).click();
  // The offer turns into a confirmation, so there is no need to go and check.
  await expect(ida.getByTestId("dryer-booked")).toContainText("Dryer booked for 11:00");
  await expect(suggestion).toHaveCount(0);

  await ida.getByRole("navigation", { name: "Machine" }).getByRole("link", { name: "Dryer" }).click();
  await expect(slot(ida, "11:00")).toHaveAttribute("data-state", "mine");
  // The dryer's own sheet says when the wash is out.
  await expect(ida.getByTestId("wash-note").filter({ visible: true })).toContainText("Your wash ends at 11:00.");
  await ida.screenshot(shot("l3-dryer"));

  // --- People: a member cannot change rules; the last admin cannot leave ---
  await openHousehold(ida);
  const code = (await ida.getByTestId("join-code").filter({ visible: true }).innerText()).replace(/\s/g, "");
  const knut = await (await browser.newContext()).newPage();
  await knut.goto(`/join/${code}`);
  await expect(knut.getByRole("heading", { level: 1 })).toHaveText("You're invited to Kollektivet");
  await knut.getByRole("link", { name: "Create account" }).click();
  await signUp(knut, "Knut", "knut");
  await expect(knut).toHaveURL(/\/home$/);
  await openRules(knut);
  await expect(knut.getByText("Only an admin can change these.")).toBeVisible();
  await expect(knut.getByTestId("resource-shower")).toHaveCount(0);
  await openHousehold(knut);
  await expect(knut.getByRole("button", { name: "Make Ida admin" })).toHaveCount(0);
  await expect(knut.getByTestId("replace-code")).toHaveCount(0);

  await ida.goto("/profile");
  await leave(ida, "Leave and cancel your bookings?");
  await expect(ida.getByTestId("leave").getByRole("alert")).toContainText("You're the only admin");

  await openHousehold(ida);
  // Handing out admin rights asks first.
  await ida.getByTestId("member-Knut").getByRole("button", { name: "Make Knut admin" }).click();
  await ida.getByTestId("member-Knut").getByRole("button", { name: /^Make Knut an admin\?/ }).click();
  await expect(ida.getByTestId("member-Knut").getByText("Admin", { exact: true })).toBeVisible();
  await openRules(knut);
  await expect(knut.getByTestId("resource-shower")).toBeVisible();

  // --- You: change your name; replace the join code ---
  // --- Your profile: a name, a drawn avatar, a bio and a fun answer ---
  await nav(knut, "You").click();
  await expect(knut.getByTestId("headline").filter({ visible: true })).toHaveText("Knut");
  await expect(knut.getByRole("heading", { level: 1 })).toContainText("an admin of Kollektivet");
  await expect(knut.getByRole("button", { name: "Save", exact: true })).toHaveCount(0);
  // Ida's colour is marked as hers, and cannot be picked while others are free.
  await expect(knut.locator("label[data-taken]")).toHaveCount(1);
  await expect(knut.locator("label[data-taken]")).toContainText("Ida");
  await expect(knut.locator("label[data-taken] input")).toBeDisabled();
  await knut.getByLabel("Your name").filter({ visible: true }).fill("Knut B");
  await knut.getByLabel("Ghost").check({ force: true });
  await knut.getByLabel("About you").fill("Plays the trombone. Trades dishes for coffee.");
  await knut.getByRole("radio", { name: "Night owl" }).check({ force: true });
  await knut.getByLabel("My signature dish").fill("Taco, every Friday");
  // The name shows in the preview as it is typed, and a tap fills in a common diet.
  await expect(knut.getByTestId("preview")).toContainText("Knut B");
  await knut.getByRole("button", { name: "Vegetarian", exact: true }).click();
  await knut.getByRole("button", { name: "Nuts", exact: true }).click();
  await expect(knut.locator('input[name="avoids"]')).toHaveValue("Vegetarian, Nuts");
  await knut.getByRole("button", { name: "Save", exact: true }).click();
  await expect(knut.getByRole("status")).toHaveText("Saved");
  await knut.screenshot(shot("p1-profile-edit"));
  // Ida sees it on his page.
  await openHousehold(ida);
  await ida.reload();
  await ida.getByRole("link", { name: "Knut B" }).filter({ visible: true }).click();
  await expect(ida.getByRole("heading", { level: 1 })).toHaveText("Knut B");
  await expect(ida.getByText("Plays the trombone. Trades dishes for coffee.")).toBeVisible();
  await expect(ida.getByText("Taco, every Friday")).toBeVisible();
  await expect(ida.getByText("Picked: Night owl")).toBeVisible();
  await expect(ida.getByText("Doesn't eat: Vegetarian, Nuts")).toBeVisible();
  // The way back is at the top of the page.
  await ida.getByTestId("back").filter({ visible: true }).click();
  await expect(ida).toHaveURL(/\/settings$/);
  await ida.screenshot(shot("p2-profile"));
  await openHousehold(ida);
  await openHousehold(knut);
  await expect(knut.getByTestId("member-Knut B")).toContainText("(you)");

  // Any area can be switched off, the shower too. Its tile goes, and so does its screen.
  const used = knut.getByRole("region", { name: "What you use" });
  await used.getByRole("checkbox", { name: /^Shower/ }).uncheck();
  await expect(used.getByRole("status")).toHaveText("Saved");
  await knut.goto("/home");
  await expect(knut.getByTestId("band-shower")).toHaveCount(0);
  await expect(knut.getByTestId("band-laundry").filter({ visible: true })).toBeVisible();
  await knut.goto("/shower");
  await expect(knut).toHaveURL(/\/home$/);
  await openHousehold(knut);
  await knut.getByRole("region", { name: "What you use" }).getByRole("checkbox", { name: /^Shower/ }).check();
  await expect(knut.getByRole("region", { name: "What you use" }).getByRole("status")).toHaveText("Saved");

  // Picking a time zone saves it, with no button.
  const details = knut.getByRole("region", { name: "Name and time zone" });
  await details.getByLabel("Time zone").selectOption("Europe/Oslo");
  await expect(details.getByRole("status")).toHaveText("Saved");
  await expect(details.getByLabel("Time zone")).toHaveValue("Europe/Oslo");
  await expect(details.getByRole("button", { name: /^Save/ })).toHaveCount(0);

  // Replacing the code asks first, and the old link is dead afterwards.
  const replace = knut.getByTestId("replace-code");
  await replace.getByRole("button", { name: "Replace with a new code" }).click();
  await expect(knut.getByTestId("join-code").filter({ visible: true })).toHaveText(`${code.slice(0, 3)} ${code.slice(3)}`);
  await replace.getByRole("button", { name: "Replace the code? Old links stop working." }).click();
  await expect(knut.getByTestId("join-code").filter({ visible: true })).not.toHaveText(`${code.slice(0, 3)} ${code.slice(3)}`);
  const stranger = await (await browser.newContext()).newPage();
  await stranger.goto(`/join/${code}`);
  await expect(stranger.getByRole("heading", { level: 1 })).toHaveText("That link doesn't work");

  // --- An admin removes someone: they are out, and the code they knew stops working ---
  const per = await (await browser.newContext()).newPage();
  const newCode = (await knut.getByTestId("join-code").filter({ visible: true }).innerText()).replace(/\s/g, "");
  await per.goto(`/join/${newCode}`);
  await per.getByRole("link", { name: "Create account" }).click();
  await signUp(per, "Per", "per");
  await expect(per).toHaveURL(/\/home$/);
  await knut.reload();
  const perRow = knut.getByTestId("member-Per");
  await perRow.getByRole("button", { name: "Remove Per", exact: true }).click();
  await perRow.getByRole("button", { name: "Remove Per from Kollektivet and cancel their bookings?" }).click();
  await expect(knut.getByTestId("member-Per")).toHaveCount(0);
  await expect(knut.getByTestId("join-code").filter({ visible: true })).not.toHaveText(`${newCode.slice(0, 3)} ${newCode.slice(3)}`);
  // Per lands on the start screen, and is told why.
  await per.goto("/home");
  await expect(per).toHaveURL(/\/onboarding$/);
  await expect(per.getByTestId("removed")).toContainText("An admin removed you from Kollektivet");
  await per.goto(`/join/${newCode}`);
  await expect(per.getByRole("heading", { level: 1 })).toHaveText("That link doesn't work");

  // --- Leaving works once there is another admin ---
  await ida.goto("/profile");
  await leave(ida, "Leave and cancel your bookings?");
  await expect(ida).toHaveURL(/\/onboarding\?left=1$/);
  await expect(ida.getByRole("status")).toContainText("You've left your household");
});
