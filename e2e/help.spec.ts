import { expect, test } from "@playwright/test";

test("help center shows the hero, six topics and an email contact", async ({ page }, info) => {
  await page.goto("/help");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hi there! How can we help?");
  await expect(page.getByText("Find answers about family stories, voices, subscriptions, and more.")).toBeVisible();
  const topics = page.getByRole("region", { name: "Browse by topic" }).getByRole("link");
  await expect(topics).toHaveCount(6);
  await expect(page.getByRole("link", { name: "Contact Support" })).toHaveAttribute("href", /^mailto:admin@readli\.ai/);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({ path: `e2e/screenshots/help-${info.project.name}.png`, fullPage: true });
});

test("help search finds the right article and opens a shareable page", async ({ page }) => {
  await page.goto("/help");
  await page.getByRole("searchbox", { name: "Search help articles" }).fill("microphone");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/\/help\?q=microphone/);
  const first = page.getByRole("region", { name: /for “microphone”/ }).getByRole("link").first();
  await expect(first).toContainText("My microphone isn't recording.");
  await first.click();
  await expect(page).toHaveURL(/\/help\/account-and-troubleshooting\/microphone-not-recording$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("My microphone isn't recording.");
  await expect(page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Account & Troubleshooting" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Related articles" })).toBeVisible();
});

test("help search says so when nothing matches", async ({ page }) => {
  await page.goto("/help?q=xylophone");
  await expect(page.getByRole("heading", { name: "No articles found for “xylophone”" })).toBeVisible();
});

test("draft articles about unreleased features stay hidden on the live site", async ({ page, request }) => {
  expect((await request.get("/help/billing-credits-and-gifts/gift-memberships")).status()).toBe(404);
  await page.goto("/help/billing-credits-and-gifts");
  await expect(page.getByRole("link", { name: /What's included in the \$19\.99/ })).toBeVisible();
  await expect(page.getByText("How do gift memberships work?")).toHaveCount(0);
  await expect(page.getByText("Draft: hidden until launch")).toHaveCount(0);
});

test("privacy help links to the privacy policy and parent safety pages", async ({ page }) => {
  await page.goto("/help/privacy-and-child-safety");
  const main = page.locator("main");
  await expect(main.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy");
  await expect(main.getByRole("link", { name: "Family privacy & safety" })).toHaveAttribute("href", "/parents/safety");
});

test("footer links to help without dropping the legal and safety pages", async ({ page }) => {
  await page.goto("/");
  const footer = page.locator("footer");
  for (const [name, href] of [
    ["Library", "/books"],
    ["Help", "/help"],
    ["Privacy", "/privacy"],
    ["Terms", "/terms"],
    ["Accessibility", "/accessibility"],
    ["Parent Safety", "/parents/safety"],
    ["Do Not Sell or Share My Personal Information", "/privacy/choices"],
  ] as const)
    await expect(footer.getByRole("link", { name, exact: true })).toHaveAttribute("href", href);
});

test("the recording tips page has its own top-level heading", async ({ page }) => {
  await page.goto("/help/recording-tips");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tips for a better voice recording");
});

test("printable guides are one clean page each, linked from Help", async ({ page }, info) => {
  await page.goto("/help");
  await page.getByTestId("printable-guides").getByRole("link", { name: "How to record your voice for Readli" }).click();
  await expect(page).toHaveURL(/\/help\/print\/record-your-voice$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("How to record your voice for Readli");
  await expect(page.getByTestId("handout").getByRole("listitem")).toHaveCount(5);
  await expect(page.getByRole("button", { name: "Print this page" })).toBeVisible();
  // Printed, the buttons and links back drop away.
  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("button", { name: "Print this page" })).toBeHidden();
  await page.emulateMedia({ media: "screen" });
  await page.screenshot({ path: `e2e/screenshots/handout-${info.project.name}.png`, fullPage: true });
  expect((await page.goto("/help/print/set-up-readli-kids"))?.status()).toBe(200);
  expect((await page.goto("/help/print/nope"))?.status()).toBe(404);
});

test("family screens link to the help article that answers them, and never to a hidden draft", async ({ page }) => {
  expect((await page.request.post("/api/family/session", { data: { as: "adult:sara" } })).status()).toBe(200);
  await page.goto("/family/kids");
  const link = page.getByTestId("help-link-parents-control-voices");
  await expect(link).toHaveText("How voice permissions work");
  await link.click();
  await expect(page).toHaveURL(/\/help\/privacy-and-child-safety\/parents-control-voices$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Can parents control which voices each child hears?");

  await page.goto("/family/settings/kids-mode");
  await expect(page.getByTestId("help-link-readli-kids-on-ipad")).toHaveAttribute("href", "/help/getting-started/readli-kids-on-ipad");
  // A draft article (not published on this build) gets no link.
  await expect(page.locator('[data-testid^="help-link-invite-relatives-elsewhere"]')).toHaveCount(0);
});
