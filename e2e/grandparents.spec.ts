import { expect, test } from "@playwright/test";

test("grandparent landing page asks for one thing: try your voice", async ({ page }, info) => {
  await page.goto("/grandparents");
  await expect(page.getByRole("heading", { level: 1, name: /Read bedtime stories to your grandkids/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Play Grandpa Kevin's sample" })).toBeVisible();
  const ctas = page.getByTestId("grandparents-cta");
  await expect(ctas).toHaveCount(2);
  for (const cta of await ctas.all()) await expect(cta).toHaveAttribute("href", "/try");
  await expect(page.getByText("No card or subscription").first()).toBeVisible();
  // No site navigation to wander off to.
  await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(0);
  await expect(page.getByTestId("grandparents-households")).toContainText("One voice. Every family you love.");
  await expect(page.getByTestId("grandparents-safety").getByRole("listitem")).toHaveCount(3);
  // No timed deletion promise on this page; the Help Center states it.
  await expect(page.locator("main")).not.toContainText(/24 hours|48 hours/);
  const founder = page.getByTestId("grandparents-who");
  await expect(founder.getByRole("heading", { name: "Built for my kids. Made for every family." })).toBeVisible();
  await expect(founder).toContainText("Kevin Godfrey");
  await expect(founder).not.toContainText("Readli.ai LLC");
  await expect(founder.getByRole("link", { name: "Read our story" })).toBeVisible({ visible: info.project.name === "phone" });
  await expect(page.getByTestId("footer-company")).toContainText("2168 Nesconset Hwy");
});

test("every link on the grandparent page opens a real page", async ({ page, request }) => {
  await page.goto("/grandparents");
  const hrefs = new Set(
    (await page.locator("main a[href^='/']").evaluateAll((as) => as.map((a) => a.getAttribute("href")!))).map((h) => h.split("#")[0]!),
  );
  expect(hrefs.size).toBeGreaterThan(5);
  for (const href of hrefs) expect((await request.get(href)).status(), href).toBe(200);
});

test("pricing explains credits in stories and offers a gift", async ({ page }) => {
  await page.goto("/pricing");
  await expect(page.getByTestId("plan-family")).toContainText(/about \d+ new bedtime stories/);
  const examples = page.getByTestId("credit-examples");
  await expect(examples).toContainText("Heidi");
  await expect(examples).toContainText("a chapter at a time");
  const gift = page.getByTestId("pricing-gift");
  for (const price of ["$19.99 a month", "$179.99"]) await expect(gift).toContainText(price);
  await expect(gift.getByRole("link", { name: "Give a gift" })).toHaveAttribute("href", "/gift/family");
});

test("book pages show what preparing the book costs", async ({ page }) => {
  await page.goto("/books/the-tale-of-peter-rabbit");
  await expect(page.getByTestId("public-credits")).toContainText(/About \d+ Readli credits to prepare in one voice/);
  await page.goto("/books/heidi");
  await expect(page.getByTestId("public-credits")).toContainText("a chapter at a time");
});

test("company page and footer say who makes Readli", async ({ page }) => {
  await page.goto("/company");
  await expect(page.getByTestId("company-details")).toContainText("Readli.ai LLC");
  await expect(page.getByTestId("founders")).toContainText("Kevin Godfrey");
  await expect(page.getByTestId("footer-company")).toContainText("Stony Brook, NY");
});
