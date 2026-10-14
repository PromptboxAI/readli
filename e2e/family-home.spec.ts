import { expect, test, type Page } from "@playwright/test";

/** The family home and parent controls against the preview family. */

async function signIn(page: Page, who: string) {
  expect((await page.request.post("/api/family/session", { data: { as: who } })).status(), who).toBe(200);
}

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
}

test("the family home leads with the kids, stories and storytellers", async ({ page }, info) => {
  await signIn(page, "adult:sara");
  await page.goto("/family");
  await expect(page.getByRole("heading", { name: "Welcome back, Mom" })).toBeVisible();
  const kids = page.getByTestId("home-kids");
  await expect(kids).toContainText("Maya");
  await expect(kids).toContainText("Leo");
  await expect(kids.getByRole("button", { name: "Open Maya's Readli Kids" })).toBeVisible();

  // Mom's voice is prepared for the homepage stories in the preview.
  await expect(page.getByTestId("shelf-ready").getByTestId("home-book-the-lion-and-the-mouse")).toContainText("Ready with Mom");
  await expect(page.getByTestId("shelf-new")).toBeVisible();

  const storytellers = page.getByTestId("home-storytellers");
  await expect(storytellers).toContainText("Approved for every child");
  await expect(storytellers.getByRole("link", { name: /Grandpa Lou/ })).toContainText("Waiting for their permission to share");
  // A voice still being made isn't listed yet.
  await expect(storytellers).not.toContainText("Uncle Sam");

  await noOverflow(page);
  await page.screenshot({ path: `e2e/screenshots/family-home-${info.project.name}.png`, fullPage: true });
});

test("parent controls gather the admin pages", async ({ page }, info) => {
  await signIn(page, "adult:sara");
  await page.goto("/family");
  await page.getByRole("link", { name: "All parent controls" }).click();
  await expect(page.getByRole("heading", { name: "Parent controls" })).toBeVisible();
  const controls = page.getByTestId("parent-controls");
  for (const name of ["Kids profiles", "Family storytellers", "Readli credits", "Plan and billing", "Kids devices and PIN", "Account settings"]) {
    await expect(controls.getByRole("link", { name: new RegExp(name) })).toBeVisible();
  }
  await expect(controls.getByRole("link", { name: /Kids profiles/ })).toContainText("2 of 6");
  await noOverflow(page);
  await page.screenshot({ path: `e2e/screenshots/parent-controls-${info.project.name}.png`, fullPage: true });
});

test("a kids profile can't open parent controls", async ({ page }) => {
  await signIn(page, "adult:sara");
  await signIn(page, "child:maya");
  await page.goto("/family/controls");
  await expect(page).toHaveURL(/\/kids$/);
});

test("a ready story opens the grown-up player and plays stored audio", async ({ page }) => {
  await signIn(page, "adult:sara");
  await page.goto("/family");
  await page.getByTestId("shelf-ready").getByTestId("home-book-the-lion-and-the-mouse").click();
  await expect(page).toHaveURL(/\/family\/books\/the-lion-and-the-mouse\/listen$/);
  const player = page.getByTestId("grown-up-player");
  await expect(player.getByRole("heading", { name: "The Lion and the Mouse" })).toBeVisible();
  await expect(player.getByRole("button", { name: /Mom/ })).toHaveAttribute("aria-pressed", "true");
  const listen = page.waitForResponse((r) => r.url().endsWith("/api/family/books/the-lion-and-the-mouse/listen"));
  await player.getByRole("button", { name: "Play" }).click();
  expect((await listen).status()).toBe(200);
  await expect(player.getByRole("button", { name: "Pause" })).toBeVisible();
  await noOverflow(page);
});

test("a kids profile can't use the grown-up player", async ({ page }) => {
  await signIn(page, "adult:sara");
  await signIn(page, "child:maya");
  const res = await page.request.post("/api/family/books/the-lion-and-the-mouse/listen", { data: { voiceId: "voice-sara", sentence: 0 } });
  expect(res.status()).toBe(403);
  await page.goto("/family/books/the-lion-and-the-mouse/listen");
  await expect(page).toHaveURL(/\/kids$/);
});


test("a book page sets up a storyteller in place, prepares the audiobook and plays it", async ({ page }) => {
  await signIn(page, "adult:sara");
  // Free one narrator slot, so Aunt Priya (shared, not in a slot) can use it.
  expect((await page.request.post("/api/family/narrators", { data: { voiceId: "voice-rose", action: "release" } })).status()).toBe(200);
  await page.goto("/family/books/the-princess-and-the-pea");
  const priya = page.getByTestId("prepare-voice-priya");
  const setup = priya.getByTestId("setup");
  await expect(setup).toContainText("Shared with your family");
  await setup.getByRole("button", { name: "Use a narrator slot" }).click();
  await expect(setup).toContainText("In a narrator slot");
  await setup.getByRole("switch", { name: "Aunt Priya for Maya" }).click();
  await expect(setup.getByRole("switch", { name: "Aunt Priya for Maya" })).toHaveAttribute("aria-checked", "true");

  await priya.getByRole("button", { name: /Prepare Audiobook/ }).click();
  await priya.getByTestId("confirm-generation").getByRole("button", { name: "Prepare now" }).click();
  const ready = priya.getByTestId("ready-to-play");
  await expect(ready).toBeVisible({ timeout: 20_000 });
  await expect(ready).toContainText("It's on Maya's bookshelf");
  await ready.getByRole("link", { name: "Play now" }).click();
  await expect(page).toHaveURL(/\/family\/books\/the-princess-and-the-pea\/listen\?voice=voice-priya/);
  await expect(page.getByTestId("grown-up-player")).toBeVisible();
});
