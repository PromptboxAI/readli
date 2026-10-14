import { expect, test, type Page } from "@playwright/test";

/** Readli Kids: the bookshelf and the two-mode player, against the preview family. */

async function signIn(page: Page, who: string) {
  expect((await page.request.post("/api/family/session", { data: { as: who } })).status(), who).toBe(200);
}

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
}

test("the kids bookshelf shows ready stories first and keeps the rest for a grown-up", async ({ page }, info) => {
  await signIn(page, "adult:sara");
  await signIn(page, "child:maya");
  await page.goto("/kids");
  await expect(page.getByRole("heading", { name: "Hi Maya! Pick a story." })).toBeVisible();
  const mine = page.getByRole("region", { name: "Ready to listen" });
  await expect(mine.getByRole("link", { name: /The Lion and the Mouse/ })).toContainText("with Mom");
  // A book nobody has prepared is never offered as playable: no link, no controls.
  const later = page.getByRole("region", { name: "Discover more stories" });
  await expect(later).toContainText("Aesop's Fables");
  await expect(later.getByRole("link")).toHaveCount(0);
  await expect(page.getByTestId("kids-continue")).toHaveCount(0);
  await noOverflow(page);
  await page.screenshot({ path: `e2e/screenshots/kids-home-${info.project.name}.png`, fullPage: true });
});

test("the player opens in Listen mode, switches to Read-along at the same place, and remembers it", async ({ page }, info) => {
  await signIn(page, "adult:sara");
  await signIn(page, "child:maya");
  await page.goto("/kids/listen/the-lion-and-the-mouse");
  const player = page.getByTestId("kids-player");
  await expect(player).toHaveAttribute("data-mode", "listen");
  await expect(page.getByRole("heading", { name: "The Lion and the Mouse" })).toBeVisible();
  await expect(player).toContainText(/Mom is reading · page 1 of \d+/);
  await noOverflow(page);
  await page.screenshot({ path: `e2e/screenshots/player-listen-${info.project.name}.png` });

  await page.getByRole("button", { name: "Next" }).click();
  const saved = page.waitForResponse((r) => r.url().includes("/api/kids/maya/progress") && r.request().method() === "PUT");
  await page.getByRole("button", { name: "Next" }).click();
  await saved;
  await page.getByRole("button", { name: "Show pictures and words" }).click();
  await expect(player).toHaveAttribute("data-mode", "read");
  await expect(page.getByTestId("sentence-position")).toHaveText(/Sentence 3 of/);
  await expect(player.locator("[data-current]")).toBeVisible();
  await expect(page.getByTestId("current-narrator")).toHaveText("Mom");
  await noOverflow(page);
  await page.screenshot({ path: `e2e/screenshots/player-read-${info.project.name}.png` });

  // The sleep timer cycles off, 15, 30, 45 and off again.
  const sleep = page.getByRole("button", { name: /Sleep timer/ });
  await expect(sleep).toHaveAccessibleName("Sleep timer: Off");
  await sleep.click();
  await expect(sleep).toHaveAccessibleName("Sleep timer: 15m");

  // Read-along is remembered on this device, at the same place.
  await page.reload();
  await expect(player).toHaveAttribute("data-mode", "read");
  await expect(page.getByTestId("sentence-position")).toHaveText(/Sentence 3 of/);
  await page.getByRole("button", { name: "Just listen" }).first().click();
  await expect(player).toHaveAttribute("data-mode", "listen");

  // Back on the bookshelf, the story waits in Continue listening.
  await page.getByRole("link", { name: "My stories" }).click();
  const resume = page.getByTestId("kids-continue");
  await expect(resume).toContainText("The Lion and the Mouse");
  await expect(resume).toContainText(/Mom is reading · page 1 of \d+/);
});
