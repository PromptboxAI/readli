import { expect, test, type Page } from "@playwright/test";

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
}

test("signup offers exactly two ways in: Family at $19.99 and Voice for free", async ({ page }, info) => {
  await page.goto("/signup");
  const options = page.getByTestId("signup-options");
  await expect(options.getByRole("heading", { level: 2 })).toHaveText(["Create a Family", "Share Your Voice"]);
  await expect(options).toContainText("$19.99");
  await expect(options).toContainText("Free");
  await expect(options.getByRole("heading", { name: /Kids/ })).toHaveCount(0);
  await noOverflow(page);
  await page.screenshot({ path: `e2e/screenshots/signup-${info.project.name}.png`, fullPage: true });
});

test("family invitations land on the join page, never the preview signup form", async ({ page }, info) => {
  await page.goto("/signup?invite=abc123");
  await expect(page).toHaveURL(/\/voice\/join\?invite=abc123/);
  await expect(page.getByRole("heading", { name: "Storyteller invitation" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create my free account" })).toHaveCount(0);
  // Older links keep working.
  await page.goto("/signup/voice?invite=abc123");
  await expect(page).toHaveURL(/\/voice\/join\?invite=abc123/);
  await page.goto("/voice?invite=abc123");
  await expect(page).toHaveURL(/\/voice\/join\?invite=abc123/);
  await noOverflow(page);
  await page.screenshot({ path: `e2e/screenshots/signup-voice-${info.project.name}.png`, fullPage: true });
});

test("the yearly link on the pricing page opens signup with yearly picked", async ({ page }) => {
  await page.goto("/pricing");
  await page.getByRole("link", { name: "$179.99/year" }).click();
  await expect(page).toHaveURL(/\/signup\/family\?billing=annual$/);
  await expect(page.getByLabel("Yearly")).toBeChecked();
  await expect(page.getByTestId("family-price")).toContainText("$179.99");
});

test("family checkout shows the plan and stays switched off", async ({ page }, info) => {
  await page.goto("/signup/family");
  // Step 1 is just email or Google; the name comes after payment.
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Your name")).toHaveCount(0);
  await expect(page.getByTestId("family-price")).toContainText("$19.99");
  await page.getByLabel("Yearly").check();
  await expect(page.getByTestId("family-price")).toContainText("$179.99");
  await expect(page.getByText("Renews yearly")).toBeVisible();
  await page.getByLabel("Monthly").check();
  await expect(page.getByTestId("family-price")).toContainText("$19.99");
  await expect(page.getByText("Up to six child profiles").first()).toBeVisible();
  await expect(page.getByTestId("checkout-off")).toBeVisible();
  // There is no free trial: the plan is charged at checkout.
  await expect(page.getByTestId("family-trial")).toHaveCount(0);
  await expect(page.getByText(/free trial|days free/i)).toHaveCount(0);
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

test("extra narrator slots add to the bill but aren't sold until payments are on", async ({ page }, info) => {
  await page.goto("/billing/narrator-slots");
  await expect(page.getByTestId("slot-total")).toHaveText("$25.98");
  await page.getByRole("button", { name: "One more slot" }).click();
  await expect(page.getByTestId("slot-total")).toHaveText("$31.97");
  await expect(page.getByTestId("slots-not-for-sale")).toBeVisible();
  await expect(page.getByRole("button", { name: /Add 2 slots/ })).toBeDisabled();
  await noOverflow(page);
  await page.screenshot({ path: `e2e/screenshots/narrator-slots-${info.project.name}.png`, fullPage: true });
});

test("admin home links the admin pages and explains real numbers need Supabase", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Readli admin" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Plan settings" })).toHaveAttribute("href", "/admin/plans");
  await expect(page.getByText("Real numbers and tester plans show here once sign-in and Supabase are connected.")).toBeVisible();
  await noOverflow(page);
});

test("admin finances page explains it needs Supabase in the preview", async ({ page }) => {
  await page.goto("/admin/finance");
  await expect(page.getByRole("heading", { name: "Finances" })).toBeVisible();
  await expect(page.getByText("Financial reporting shows here once sign-in and Supabase are connected.")).toBeVisible();
  await noOverflow(page);
});

test("admins can issue complimentary memberships for an unknown raffle winner", async ({ page }, info) => {
  await page.goto("/admin");
  await page.getByRole("link", { name: "Complimentary memberships" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Complimentary memberships" })).toBeVisible();
  const form = page.getByTestId("complimentary-form");
  await expect(form.getByRole("radio", { name: "12 months" })).toBeChecked();
  await expect(form.getByLabel("Occasion")).toContainText("Raffle prize");
  await expect(form.getByRole("radio", { name: /Unknown winner/ })).toBeChecked();
  await expect(form.getByLabel("Recipient name")).toBeDisabled();
  await form.getByLabel(/Event or fundraiser name/).fill("Mount Elementary Basket Dinner");
  await expect(form).toContainText("You've won a year of Readli Family!");
  await expect(form).toContainText("Donated by Readli for the Mount Elementary Basket Dinner.");
  await form.getByRole("radio", { name: "3 months" }).check();
  await expect(form).toContainText("You've won 3 months of Readli Family!");
  await page.screenshot({ path: `e2e/screenshots/admin-complimentary-${info.project.name}.png`, fullPage: true });
  await form.getByRole("button", { name: "Issue 1 membership" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Complimentary memberships need sign-in" })).toBeVisible();
  await noOverflow(page);
});

test("the claim page asks for a code when there isn't one, and never shows a voice", async ({ page }, info) => {
  await page.goto("/claim");
  await expect(page.getByRole("heading", { name: "Claim your Readli gift" })).toBeVisible();
  await page.getByRole("textbox", { name: "Gift code" }).fill("nope");
  await page.getByRole("button", { name: "Find my gift" }).click();
  await expect(page.getByText(/doesn.t look like a gift code/)).toBeVisible();
  await expect(page.getByTestId("gift-voice-preview")).toHaveCount(0);
  await noOverflow(page);
  await page.screenshot({ path: `e2e/screenshots/claim-${info.project.name}.png`, fullPage: true });
});

test("admin plan settings list every configurable limit", async ({ page }, info) => {
  await page.goto("/admin/plans");
  const settings = page.getByTestId("plan-settings");
  for (const label of ["Readli Family monthly price", "Included active narrator slots", "Maximum child profiles", "Included concurrent child streams", "Gifted membership entitlements"]) {
    await expect(settings).toContainText(label);
  }
  await expect(settings).toContainText("$179.99");
  const rewards = page.getByTestId("reward-settings");
  for (const text of ["Off", "14 days", "10 credits", "Paid months before a referral earns", "Referral free months per rolling 12 months", "Standard only"]) {
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

test("account settings and the account API need a real signed-in grown-up", async ({ page }) => {
  await page.goto("/family/settings");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByText("Log in to your own family to change your name")).toBeVisible();
  await noOverflow(page);
  expect((await page.request.get("/api/account/export")).status()).toBe(401);
  expect((await page.request.delete("/api/account", { data: { confirm: "DELETE" } })).status()).toBe(401);
});
