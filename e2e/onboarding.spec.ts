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
  await expect(page.getByRole("button", { name: "Play my story" })).toBeVisible();
  await noOverflow(page);
});

test("setup's book and listen steps stay in setup, with a small player", async ({ page }) => {
  await signIn(page, "adult:sara");
  await page.goto("/family/setup?step=book");
  const prep = page.getByTestId("setup-prepare");
  await expect(prep).toContainText("The Lion and the Mouse");
  await prep.getByTestId("setup-book-next").click();
  await expect(page).toHaveURL(/step=listen/);
  const player = page.getByTestId("setup-mini-player");
  await expect(player.getByRole("button", { name: "Play" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Play it now" })).toHaveCount(0);
  await noOverflow(page);
});
