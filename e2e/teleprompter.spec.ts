import { expect, test, type Page } from "@playwright/test";

async function consent(page: Page) {
  // Fake clock so tests can jump past the one-minute minimum; time still flows normally otherwise.
  await page.clock.install();
  await page.goto("/try");
  const cont = page.getByRole("button", { name: "Continue to recording" });
  await expect(cont).toBeDisabled();
  await page.getByLabel(/18 or older/).check();
  await expect(cont).toBeDisabled();
  await page.getByLabel(/may process this recording/).check();
  await cont.click();
}

test("continuous take: no Next button, scrolls, pauses, resumes, finishes once the last paragraph starts", async ({ page }, info) => {
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
  const finish = page.getByRole("button", { name: "Finish" });
  await expect(finish).toBeDisabled();
  await expect(page.getByTestId("script-progress")).toBeVisible();
  // Time alone isn't enough: Finish waits for the last paragraph too.
  await page.clock.fastForward(61_000);
  await expect(finish).toBeDisabled();
  await expect(page.locator("#duration-guidance-text")).toContainText(/last paragraph/i);
  await prompter.hover();
  // Scroll to the end, stepping the timers so each scroll registers, then spend a few seconds on the last line.
  await expect
    .poll(async () => {
      await page.mouse.wheel(0, 5_000);
      await page.clock.runFor(500);
      // A jump fires the elapsed-time timer once with the whole gap, like a few seconds on the last line.
      await page.clock.fastForward(4_000);
      return finish.isEnabled();
    }, { timeout: 20_000 })
    .toBe(true);
  await finish.click();

  await expect(page.getByTestId("review-panel")).toBeVisible();
  // A real take from the (fake) microphone is ready to play back.
  await expect(page.getByLabel("Play back your recording")).toHaveAttribute("src", /^blob:/);
  await page.screenshot({ path: `e2e/screenshots/try-review-${info.project.name}.png` });
  // The fake clock leaves only seconds of real audio, so the take is held back for another try; the
  // voice preview test covers a real-length take going on to the six books.
  await expect(page.getByTestId("qc-blocking")).toBeVisible();
  await expect(page.getByRole("button", { name: "Choose a story" })).toHaveCount(0);
});

test("start over clears the take and its progress", async ({ page }) => {
  await consent(page);
  await page.getByRole("button", { name: "Start recording" }).click();
  await page.getByTestId("teleprompter").hover();
  await page.mouse.wheel(0, 20_000);
  await page.getByRole("button", { name: "Pause" }).click();
  await page.getByRole("button", { name: "Start over" }).click();
  await expect(page.getByRole("status")).toHaveText(/Ready to record/);
  await expect(page.getByTestId("script-progress")).toHaveAttribute("aria-valuenow", "0");
});

test("recording tips open over the recorder and close back to it", async ({ page }) => {
  await consent(page);
  await page.getByRole("button", { name: "Tips for a better voice recording" }).click();
  const tips = page.getByTestId("recording-tips");
  await expect(tips).toBeVisible();
  await expect(tips.getByText("Use your natural storytime voice")).toBeVisible();
  await tips.getByRole("button", { name: "Back to recording" }).click();
  await expect(tips).toBeHidden();
  await expect(page.getByRole("button", { name: "Start recording" })).toBeVisible();
});

test("speed and text size change without interrupting the take", async ({ page }) => {
  await consent(page);
  const settings = page.locator("details", { hasText: "Reading settings" });
  if (!(await settings.evaluate((el) => (el as HTMLDetailsElement).open))) await settings.locator("summary").click();

  await page.getByRole("button", { name: "Start recording" }).click();
  await page.getByRole("button", { name: "Increase scroll speed" }).click();
  await expect(page.getByText("150 words/min")).toBeVisible();
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

test("blocked microphone shows recovery guidance and does not start", async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("blocked", "NotAllowedError"));
  });
  await consent(page);
  await page.getByRole("button", { name: "Start recording" }).click();
  await expect(page.getByText(/Microphone access was blocked/)).toBeVisible();
  await expect(page.getByTestId("mic-blocked").getByRole("listitem").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Reload the page" })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText(/Ready to record/);
});

test("mic test lights up before recording", async ({ page }) => {
  await consent(page);
  await page.getByRole("button", { name: "Test my microphone" }).click();
  await expect(page.getByTestId("input-meter")).toContainText("Listening");
  await expect(page.getByRole("status")).toHaveText(/Ready to record/);
});
