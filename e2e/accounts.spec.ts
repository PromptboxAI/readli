import { expect, test, type Page } from "@playwright/test";

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
}

test("signup offers exactly two ways in: Family at $14.99 and Voice for free", async ({ page }, info) => {
  await page.goto("/signup");
  const options = page.getByTestId("signup-options");
  await expect(options.getByRole("heading", { level: 2 })).toHaveText(["Create a Family", "Share Your Voice"]);
  await expect(options).toContainText("$14.99");
  await expect(options).toContainText("Free");
  await expect(options.getByRole("heading", { name: /Kids/ })).toHaveCount(0);
  await noOverflow(page);
  await page.screenshot({ path: `e2e/screenshots/signup-${info.project.name}.png`, fullPage: true });
});

test("family invitations land on Readli Voice signup", async ({ page }, info) => {
  await page.goto("/signup?invite=abc123");
  await expect(page).toHaveURL(/\/signup\/voice\?invite=abc123/);
  await expect(page.getByTestId("invited-banner")).toContainText("Accepting doesn't share your voice");
  await noOverflow(page);
  await page.screenshot({ path: `e2e/screenshots/signup-voice-${info.project.name}.png`, fullPage: true });
});

test("family checkout shows the plan and stays switched off", async ({ page }, info) => {
  await page.goto("/signup/family");
  await expect(page.getByTestId("family-price")).toContainText("$14.99");
  await expect(page.getByText("Up to six child profiles").first()).toBeVisible();
  await expect(page.getByTestId("checkout-off")).toBeVisible();
  await expect(page.getByTestId("family-trial")).toContainText("Try it free for 14 days");
  await expect(page.getByTestId("family-trial")).toContainText("Not switched on yet");
  await expect(page.getByRole("button", { name: "Start Readli Family" })).toBeDisabled();
  await noOverflow(page);
  await page.screenshot({ path: `e2e/screenshots/signup-family-${info.project.name}.png`, fullPage: true });
});

test("contributors approve requests and stop sharing per family", async ({ page }, info) => {
  await page.goto("/voice");
  await page.screenshot({ path: `e2e/screenshots/voice-dashboard-${info.project.name}.png`, fullPage: true });
  const requests = page.getByTestId("sharing-requests");
  await requests.getByRole("button", { name: "Share my voice" }).click();
  const shared = page.getByTestId("shared-families");
  await expect(shared.getByRole("listitem")).toHaveCount(3);
  await shared.getByRole("listitem").filter({ hasText: "Priya" }).getByRole("button", { name: "Stop sharing" }).click();
  await expect(shared.getByRole("listitem")).toHaveCount(2);
  await noOverflow(page);
});

test("extra narrator slots add to the bill but aren't sold until approved", async ({ page }, info) => {
  await page.goto("/billing/narrator-slots");
  await expect(page.getByTestId("slot-total")).toHaveText("$17.98");
  await page.getByRole("button", { name: "One more slot" }).click();
  await expect(page.getByTestId("slot-total")).toHaveText("$20.97");
  await expect(page.getByTestId("slots-not-for-sale")).toBeVisible();
  await expect(page.getByRole("button", { name: /Add 2 slots/ })).toBeDisabled();
  await noOverflow(page);
  await page.screenshot({ path: `e2e/screenshots/narrator-slots-${info.project.name}.png`, fullPage: true });
});

test("admin plan settings list every configurable limit", async ({ page }, info) => {
  await page.goto("/admin/plans");
  const settings = page.getByTestId("plan-settings");
  for (const label of ["Readli Family monthly price", "Included active narrator slots", "Maximum child profiles", "Included concurrent child streams", "Gifted membership entitlements"]) {
    await expect(settings).toContainText(label);
  }
  await expect(settings).toContainText("$149.99");
  const rewards = page.getByTestId("reward-settings");
  for (const text of ["Off", "14 days", "10 minutes", "Paid months before a referral earns", "Referral free months per rolling 12 months", "Standard only"]) {
    await expect(rewards).toContainText(text);
  }
  await noOverflow(page);
  await page.screenshot({ path: `e2e/screenshots/admin-plans-${info.project.name}.png`, fullPage: true });
});

test("contributors verify, consent, record and approve their voice", async ({ page }, info) => {
  await page.goto("/voice/record");
  await page.getByLabel("Code").fill("123456");
  await page.getByRole("button", { name: "Verify" }).click();
  const agree = page.getByRole("button", { name: "I agree" });
  await expect(agree).toBeDisabled();
  for (const box of await page.getByRole("checkbox").all()) await box.check();
  await page.screenshot({ path: `e2e/screenshots/voice-consent-${info.project.name}.png`, fullPage: true });
  await agree.click();
  await expect(page.getByRole("heading", { name: "Read the story out loud" })).toBeVisible();
  await page.getByRole("button", { name: "I've finished recording" }).click();
  await page.screenshot({ path: `e2e/screenshots/voice-approve-${info.project.name}.png`, fullPage: true });
  await page.getByRole("button", { name: "Approve my voice" }).click();
  await expect(page.getByText("Nobody can use it until you share it")).toBeVisible();
  await noOverflow(page);
});
