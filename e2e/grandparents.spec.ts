import { expect, test } from "@playwright/test";

test("grandparent landing page asks for one thing: try your voice", async ({ page }) => {
  await page.goto("/grandparents");
  await expect(page.getByRole("heading", { level: 1, name: /Read bedtime stories to your grandkids/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Play Grandpa Kevin's sample" })).toBeVisible();
  const ctas = page.getByTestId("grandparents-cta");
  await expect(ctas.first()).toHaveAttribute("href", "/try");
  // No site navigation to wander off to.
  await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(0);
  await expect(page.getByTestId("grandparents-free")).toContainText("You never pay");
  await expect(page.getByTestId("grandparents-after")).toContainText("They hear you, no account needed");
  await expect(page.getByTestId("grandparents-safety")).toContainText("within 48 hours");
  await expect(page.getByTestId("grandparents-who")).toContainText("Readli.ai LLC");
  await expect(page.getByTestId("grandparents-who")).toContainText("Stony Brook");
});

test("pricing explains credits in stories and offers a gift", async ({ page }) => {
  await page.goto("/pricing");
  await expect(page.getByTestId("plan-family")).toContainText(/about \d+ new bedtime stories/);
  const examples = page.getByTestId("credit-examples");
  await expect(examples).toContainText("Heidi");
  await expect(examples).toContainText("a chapter at a time");
  const gift = page.getByTestId("pricing-gift");
  for (const price of ["$19.99", "$59.97", "$179.99"]) await expect(gift).toContainText(price);
  await expect(gift.getByRole("link", { name: "Give a gift" })).toHaveAttribute("href", "/invite/gift");
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
