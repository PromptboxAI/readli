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
  await noOverflow(page);
  await page.screenshot({ path: `e2e/screenshots/admin-plans-${info.project.name}.png`, fullPage: true });
});
