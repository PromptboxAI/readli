import { expect, test } from "@playwright/test";

test("homepage follows the design brief order with six books under the demo", async ({ page }, info) => {
  await page.goto("/");
  const headings = await page.locator("main h2").allTextContents();
  expect(headings.slice(0, 2)).toEqual(["Try your voice. No signup.", "Pick a story to hear in your voice"]);
  expect(headings).toEqual(
    expect.arrayContaining(["How families work", "Three ways to listen", "Safe for families by design", "Start a family library"]),
  );

  const books = page.getByTestId("demo-books").getByRole("article");
  await expect(books).toHaveCount(6);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  await page.screenshot({ path: `e2e/screenshots/home-${info.project.name}.png`, fullPage: true });
});
