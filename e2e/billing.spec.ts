import { expect, test, type Page } from "@playwright/test";

/** Plan and billing for parents. Payments are off in tests, so nothing can be charged. */

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
}

test("a parent sees their plan and slots, and billing stays switched off", async ({ page }, info) => {
  const res = await page.request.post("/api/family/session", { data: { as: "adult:sara" } });
  expect(res.status()).toBe(200);
  await page.goto("/family");
  await page.getByRole("link", { name: "Plan and billing" }).click();
  await expect(page.getByRole("heading", { name: "Plan and billing" })).toBeVisible();
  const plan = page.getByTestId("current-plan");
  await expect(plan).toContainText("Readli Family");
  await expect(plan).toContainText("4 storyteller slots (2 extra, $11.98 a month)");
  await expect(page.getByRole("button", { name: "Change card, slots or cancel" })).toBeDisabled();
  await expect(page.getByText("Storytellers and credits are separate")).toBeVisible();
  await noOverflow(page);
  await page.screenshot({ path: `e2e/screenshots/billing-${info.project.name}.png`, fullPage: true });

  // While payments are off the endpoints don't exist.
  expect((await page.request.post("/api/billing/checkout", { data: { item: "family_monthly" } })).status()).toBe(404);
  expect((await page.request.post("/api/billing/portal", { data: {} })).status()).toBe(404);
  expect((await page.request.post("/api/billing/webhook", { data: "{}" })).status()).toBe(404);
});

test("a child can't open plan and billing", async ({ page }) => {
  expect((await page.request.post("/api/family/session", { data: { as: "adult:sara" } })).status()).toBe(200);
  expect((await page.request.post("/api/family/session", { data: { as: "child:maya" } })).status()).toBe(200);
  await page.goto("/family/billing");
  await expect(page.getByRole("heading", { name: "Ask a grown-up" })).toBeVisible();
});
