import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, who: string) {
  expect((await page.request.post("/api/family/session", { data: { as: who } })).status(), who).toBe(200);
}

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

test("family setup opens with a welcome page that leads to step 1", async ({ page }) => {
  await signIn(page, "adult:sara");
  await page.goto("/family/setup?step=welcome");
  const welcome = page.getByTestId("onboarding-welcome");
  await expect(welcome).toContainText("Welcome to Readli Family");
  await expect(welcome.getByRole("img")).not.toHaveCount(0);
  await noOverflow(page);
  await welcome.getByTestId("welcome-start").click();
  await expect(page).toHaveURL(/step=voice/);
  await expect(page.getByTestId("setup-progress")).toContainText("Step 1 of 5");
  await page.getByRole("link", { name: "Back", exact: true }).click();
  await expect(page.getByTestId("onboarding-welcome")).toBeVisible();
});

test("storytellers get a welcome page, then record, share and listen steps", async ({ page }) => {
  await signIn(page, "adult:june");
  await page.goto("/voice/setup?step=welcome");
  const welcome = page.getByTestId("onboarding-welcome");
  await expect(welcome).toContainText("Welcome to Readli Voice");
  await noOverflow(page);
  await welcome.getByTestId("welcome-start").click();
  await expect(page.getByTestId("storyteller-progress")).toContainText("Step 1 of 3");
  await page.getByTestId("storyteller-next").click();
  await expect(page.getByTestId("storyteller-share")).toBeVisible();
  await expect(page.getByTestId("storyteller-families")).toContainText("can use your voice now");
  await page.getByTestId("storyteller-next").click();
  await expect(page.getByTestId("storyteller-listen")).toBeVisible();
  const shelf = page.getByTestId("hear-story-shelf");
  await expect(shelf).toContainText("The Lion and the Mouse");
  await expect(shelf.getByRole("button", { name: "Hear this passage" }).first()).toBeVisible();
  await noOverflow(page);
});

test("setup's book and listen steps stay in setup, with a small player", async ({ page }) => {
  await signIn(page, "adult:sara");
  await page.goto("/family/setup?step=book");
  const prep = page.getByTestId("setup-prepare");
  await expect(prep).toContainText("The Lion and the Mouse");
  await expect(prep.getByTestId("setup-book-ready")).toBeVisible();
  await page.getByTestId("setup-next").click();
  await expect(page).toHaveURL(/step=listen/);
  const player = page.getByTestId("setup-mini-player");
  await expect(player.getByRole("button", { name: "Play" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Play it now" })).toHaveCount(0);
  await noOverflow(page);
  // A prepared story plays as one continuous track, not a clip per sentence with a pause between them.
  const clips: string[] = [];
  page.on("request", (r) => {
    if (/\/listen(\/track)?$/.test(new URL(r.url()).pathname)) clips.push(new URL(r.url()).pathname);
  });
  await player.getByRole("button", { name: "Play" }).click();
  await expect(player.getByRole("button", { name: "Pause" })).toBeVisible();
  expect(clips).toEqual(["/api/family/books/the-lion-and-the-mouse/listen/track"]);
});

test("finishing setup ends on a page that says what to do next", async ({ page }) => {
  await signIn(page, "adult:sara");
  await page.goto("/family/setup?step=listen");
  await page.getByTestId("setup-next").click();
  await expect(page).toHaveURL(/step=done/);
  await expect(page.getByRole("heading", { level: 1, name: "You're all set!" })).toBeVisible();
  const next = page.getByTestId("setup-whats-next");
  await expect(next.getByRole("button", { name: /Open Maya's Readli Kids/ })).toBeVisible();
  await expect(next.getByRole("heading", { name: "Add more books" })).toBeVisible();
  await expect(next.locator('a[href^="/family/books/"]')).toHaveCount(6);
  await expect(next.getByTestId("setup-browse-books")).toHaveAttribute("href", "/family/books");
  await expect(next.getByTestId("setup-invite-voices")).toHaveAttribute("href", "/family/narrators#invite");
  await noOverflow(page);
  await page.screenshot({ path: "test-results/setup-done.png", fullPage: true });
});
