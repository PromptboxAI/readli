import { expect, test, type Page } from "@playwright/test";

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
}

test("invite hub offers Invite Family beside Invite & Gift", async ({ page }, info) => {
  await page.goto("/invite");
  const actions = page.getByTestId("invite-actions");
  await expect(actions.getByRole("link", { name: /Invite Family/ })).toHaveAttribute("href", "/invite/family");
  await expect(actions.getByRole("link", { name: /Invite & Gift/ })).toHaveAttribute("href", "/invite/gift");
  await expect(page.getByText("Start a paid plan for them")).toBeVisible();
  await noOverflow(page);
  await page.screenshot({ path: `e2e/screenshots/invite-${info.project.name}.png`, fullPage: true });
});

test("inviting family adds a pending storyteller and shares no voice", async ({ page }, info) => {
  await page.goto("/invite/family");
  await page.getByLabel("Who are you inviting?").fill("Uncle Mike");
  await page.getByText("Uncle", { exact: true }).click();
  await expect(page.getByTestId("invite-preview")).toContainText("Hi Uncle Mike!");
  await expect(page.getByTestId("invite-preview")).toContainText("private until you choose to share it");
  await page.screenshot({ path: `e2e/screenshots/invite-family-${info.project.name}.png`, fullPage: true });
  await page.getByRole("button", { name: "Create invite link" }).click();
  await expect(page.getByRole("heading", { name: "Invitation ready for Uncle Mike" })).toBeVisible();
  await expect(page.getByText("nothing was sent")).toBeVisible();
  const card = page.getByTestId("invite-list").getByRole("listitem").first();
  await expect(card).toContainText("Uncle Mike");
  await expect(card).toContainText("Invitation sent");
  await noOverflow(page);
});

test("gift checkout stays closed until prices are final, and the recipient runs their own home", async ({ page }, info) => {
  await page.goto("/invite/gift");
  await expect(page.getByText("$149.99")).toBeVisible();
  await page.getByText("Monthly sponsorship").click();
  await page.getByLabel("Their name").fill("Ben and family");
  await page.getByLabel("Their email").fill("ben@example.com");
  await page.getByLabel("From").fill("Nana Rose");
  await page.getByLabel(/A note for them/).fill("Bedtime stories on me. Love, Nana");
  await noOverflow(page);
  await page.screenshot({ path: `e2e/screenshots/invite-gift-${info.project.name}.png`, fullPage: true });
  await page.getByRole("button", { name: "Review gift" }).click();

  await expect(page).toHaveURL(/\/invite\/gift\/checkout\?/);
  await expect(page.getByTestId("payments-off")).toBeVisible();
  await expect(page.getByRole("button", { name: "Start sponsorship" })).toBeDisabled();
  await expect(page.getByText("$14.99 a month").first()).toBeVisible();
  await expect(page.getByText(/7 days before each charge/)).toBeVisible();
  await noOverflow(page);
  await page.screenshot({ path: `e2e/screenshots/gift-checkout-${info.project.name}.png`, fullPage: true });

  await page.getByRole("link", { name: "Preview their gift" }).click();
  await expect(page.getByRole("heading", { name: "Nana Rose sent you a gift" })).toBeVisible();
  await page.screenshot({ path: `e2e/screenshots/gift-wrapped-${info.project.name}.png`, fullPage: true });
  await page.getByRole("button", { name: "Open your gift" }).click();
  await expect(page.getByTestId("gift-card")).toContainText("Bedtime stories on me");
  await expect(page.getByText(/can't see your family circle, your children or anyone's voice/)).toBeVisible();
  await noOverflow(page);
  await page.screenshot({ path: `e2e/screenshots/gift-recipient-${info.project.name}.png`, fullPage: true });
});

test("gift codes are checked before opening", async ({ page }) => {
  await page.goto("/gift");
  await page.getByRole("textbox", { name: "Gift code" }).fill("nope");
  await page.getByRole("button", { name: "Open my gift" }).click();
  await expect(page.getByText(/doesn.t look like a gift code/)).toBeVisible();
  await page.getByRole("textbox", { name: "Gift code" }).fill("abcd efgh jkmn");
  await page.getByRole("button", { name: "Open my gift" }).click();
  await expect(page).toHaveURL(/code=ABCD-EFGH-JKMN/);
});

test("gift management cancels unopened gifts and stops sponsorships at month end", async ({ page }, info) => {
  await page.goto("/invite/gift/manage");
  const list = page.getByTestId("gift-list");
  await expect(list.getByRole("listitem")).toHaveCount(3);
  await expect(list).toContainText("Renewal notice");
  await page.screenshot({ path: `e2e/screenshots/gift-manage-${info.project.name}.png`, fullPage: true });
  const priya = list.getByRole("listitem").filter({ hasText: "Aunt Priya" });
  await priya.getByRole("button", { name: "Stop renewing" }).click();
  await priya.getByRole("button", { name: "Stop renewing" }).click();
  await expect(priya.getByRole("status")).toContainText("keeps Readli until the end of the month");
  const ben = list.getByRole("listitem").filter({ hasText: "Ben and family" });
  await ben.getByRole("button", { name: "Cancel gift" }).click();
  await ben.getByRole("button", { name: "Cancel gift" }).click();
  await expect(ben).toContainText("Cancelled");
  await noOverflow(page);
});

test("rewards track activities, and following Readli is optional and unrewarded", async ({ page }, info) => {
  await page.goto("/rewards");
  await expect(page.getByTestId("rewards-activities").getByRole("listitem")).toHaveCount(5);
  await expect(page.getByRole("progressbar", { name: "Starter activities" })).toHaveAttribute("aria-valuenow", "2");
  const follow = page.getByTestId("follow-readli");
  const links = follow.getByRole("list", { name: "Readli's official accounts" }).getByRole("link");
  await expect(links).toHaveCount(8);
  for (const link of await links.all()) await expect(link).toHaveAttribute("target", "_blank");
  await expect(page.getByTestId("follow-optional")).toContainText("doesn't earn rewards");
  await expect(page.getByTestId("rewards-fine-print")).toContainText("never earns rewards");
  await expect(page.getByTestId("rewards-fine-print")).toContainText("doesn't add narration minutes");
  await expect(page.getByTestId("rewards-earned")).toContainText("up to 3 a year");
  await expect(page.locator("#refer")).toContainText("second month");
  await noOverflow(page);
  await page.screenshot({ path: `e2e/screenshots/rewards-${info.project.name}.png`, fullPage: true });
});

test("a referral link remembers its code and goes to sign-up", async ({ page, context }) => {
  await page.goto("/r/ABCdef12");
  await expect(page).toHaveURL(/\/signup/);
  const ref = (await context.cookies()).find((c) => c.name === "readli_ref");
  expect(ref).toMatchObject({ value: "abcdef12", httpOnly: true });
  await page.goto("/r/not-a-code!");
  expect(new URL(page.url()).pathname).toBe("/");
});

test("onboarding lets adults skip Follow Readli's Story", async ({ page }, info) => {
  await page.goto("/welcome");
  await expect(page.getByRole("heading", { name: "Welcome to Readli Family!" })).toBeVisible();
  await page.screenshot({ path: `e2e/screenshots/welcome-rewards-${info.project.name}.png`, fullPage: true });
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Follow Readli's Story" })).toBeVisible();
  await noOverflow(page);
  await page.screenshot({ path: `e2e/screenshots/welcome-follow-${info.project.name}.png`, fullPage: true });
  await page.getByRole("button", { name: "Skip" }).click();
  await expect(page.getByRole("heading", { name: "You're all set" })).toBeVisible();
});
