import { expect, test, type Page } from "@playwright/test";

async function consent(page: Page) {
  await page.goto("/try");
  const cont = page.getByRole("button", { name: "Continue to recording" });
  await expect(cont).toBeDisabled();
  await page.getByLabel(/18 or older/).check();
  await expect(cont).toBeDisabled();
  await page.getByLabel(/may process this recording/).check();
  await cont.click();
}

test("continuous take: no Next button, scrolls, pauses, resumes, finishes into six books", async ({ page }, info) => {
  await consent(page);
  const prompter = page.getByTestId("teleprompter");
  await expect(page.getByRole("button", { name: /next/i })).toHaveCount(0);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({ path: `e2e/screenshots/try-ready-${info.project.name}.png` });

  await page.getByRole("button", { name: "Start recording" }).click();
  await expect(page.getByRole("status")).toHaveText(/Recording/);
  await expect.poll(() => prompter.evaluate((el) => el.scrollTop), { timeout: 5_000 }).toBeGreaterThan(5);
  await page.screenshot({ path: `e2e/screenshots/try-recording-${info.project.name}.png` });

  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByRole("status")).toHaveText(/Paused/);
  const pausedAt = await prompter.evaluate((el) => el.scrollTop);
  await page.waitForTimeout(600);
  expect(await prompter.evaluate((el) => el.scrollTop)).toBe(pausedAt);

  await page.getByRole("button", { name: "Resume" }).click();
  await expect(page.getByRole("status")).toHaveText(/Recording/);
  await page.getByRole("button", { name: "Finish" }).click();

  await expect(page.getByTestId("review-panel")).toBeVisible();
  await page.getByRole("button", { name: "Choose a story" }).click();
  await expect(page.getByTestId("demo-books").getByRole("article")).toHaveCount(6);
});

test("speed and text size change without interrupting the take", async ({ page }) => {
  await consent(page);
  const settings = page.locator("details", { hasText: "Reading settings" });
  if (!(await settings.evaluate((el) => (el as HTMLDetailsElement).open))) await settings.locator("summary").click();

  await page.getByRole("button", { name: "Start recording" }).click();
  await page.getByRole("button", { name: "Increase scroll speed" }).click();
  await expect(page.getByText("140 words/min")).toBeVisible();
  const sizeGroup = page.getByRole("group", { name: "Text size" });
  const before = await sizeGroup.textContent();
  await page.getByRole("button", { name: "Increase text size" }).click();
  await expect(sizeGroup).not.toHaveText(before ?? "");
  await expect(page.getByRole("status")).toHaveText(/Recording/);
});

test("manual drag repositions the script while recording continues", async ({ page }) => {
  await consent(page);
  await page.getByRole("button", { name: "Start recording" }).click();
  const prompter = page.getByTestId("teleprompter");
  await prompter.hover();
  await page.mouse.wheel(0, 400);
  await expect.poll(() => prompter.evaluate((el) => el.scrollTop)).toBeGreaterThan(200);
  await expect(page.getByRole("status")).toHaveText(/Recording/);
});

test.describe("reduced motion", () => {
  test("auto-scroll is off and the script stays put", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await consent(page);
    await page.getByRole("button", { name: "Start recording" }).click();
    await page.waitForTimeout(800);
    expect(await page.getByTestId("teleprompter").evaluate((el) => el.scrollTop)).toBe(0);
    await expect(page.getByText(/Auto-scroll is off/)).toBeVisible();
  });
});
