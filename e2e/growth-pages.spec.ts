import { expect, test } from "@playwright/test";

const SITE = "https://readli.ai";

const noSidewaysScroll = async (page: import("@playwright/test").Page) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
};

test("the gift page explains a Readli gift, is indexable and is linked from home, pricing and the footer", async ({ page }) => {
  await page.goto("/gifts");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Give the gift of your voice at bedtime");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `${SITE}/gifts`);
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  await expect(page.getByTestId("gifts-plans")).toContainText("$179.99");
  await expect(page.getByTestId("gifts-plans")).toContainText("$19.99 a month");
  // Gifts aren't on sale in the test build, so the page says so and offers recording instead.
  await expect(page.getByTestId("gifts-soon")).toBeVisible();
  await expect(page.getByTestId("gifts-cta")).toHaveAttribute("href", "/try");
  const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(ld.join("")).toContain('"FAQPage"');
  await noSidewaysScroll(page);

  await page.goto("/");
  await expect(page.getByTestId("home-gift-band").getByRole("link", { name: "See Readli gifts" })).toHaveAttribute("href", "/gifts");
  await expect(page.locator("footer").getByRole("link", { name: "Gifts", exact: true })).toHaveAttribute("href", "/gifts");
  await page.goto("/pricing");
  await expect(page.getByTestId("pricing-gift").getByRole("link", { name: "How gifts work" })).toHaveAttribute("href", "/gifts");
});

test("the homepage shows where families can listen, each linking to its help answer", async ({ page }) => {
  await page.goto("/");
  const band = page.getByTestId("listen-anywhere");
  await expect(band.getByRole("heading", { level: 2 })).toHaveText("Bedtime, wherever it happens");
  await expect(band.getByRole("listitem")).toHaveCount(6);
  for (const name of ["A sleep timer", "Download for the trip", "Read along"]) await expect(band.getByRole("heading", { name })).toBeVisible();
  const hrefs = await band.getByRole("link").evaluateAll((links) => links.map((l) => l.getAttribute("href")));
  for (const href of new Set(hrefs)) {
    const res = await page.request.get(href!);
    expect(res.status(), href!).toBe(200);
  }
});

test("bedtime story collections list their books, play a sample and link back from the library", async ({ page }) => {
  await page.goto("/bedtime-stories");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Classic bedtime stories for kids");
  await expect(page.getByTestId("collection-list").getByRole("listitem")).toHaveCount(10);

  await page.getByTestId("collection-list").getByRole("link", { name: /^Beatrix Potter/ }).click();
  await expect(page).toHaveURL(/\/bedtime-stories\/beatrix-potter$/);
  // A fresh load, so head tags left over from the client-side navigation don't count.
  await page.goto("/bedtime-stories/beatrix-potter");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Beatrix Potter stories read aloud");
  await expect(page.getByTestId("collection-books").getByRole("link", { name: /The Tale of Peter Rabbit/ })).toHaveAttribute("href", "/books/the-tale-of-peter-rabbit");
  await expect(page.getByTestId("collection-sample").getByRole("button")).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `${SITE}/bedtime-stories/beatrix-potter`);
  const ld = (await page.locator('script[type="application/ld+json"]').allTextContents()).join("");
  expect(ld).toContain('"ItemList"');
  expect(ld).toContain('"FAQPage"');
  await noSidewaysScroll(page);

  await page.goto("/books");
  await expect(page.getByTestId("library-collections").getByRole("link", { name: "Classic fairy tales" })).toHaveAttribute("href", "/bedtime-stories/fairy-tales");
  await page.goto("/books/the-tale-of-peter-rabbit");
  await expect(page.getByTestId("public-collections").getByRole("link", { name: "Beatrix Potter" })).toHaveAttribute("href", "/bedtime-stories/beatrix-potter");
});

test("Spanish stories have their own shelf and are marked as Spanish", async ({ page }) => {
  await page.goto("/bedtime-stories/cuentos-en-espanol");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bedtime stories in Spanish: cuentos para dormir");
  await expect(page.getByTestId("collection-books").getByRole("link")).toHaveCount(3);
  await expect(page.getByTestId("collection-books").getByRole("link", { name: /Ratón Pérez/ })).toHaveAttribute("href", "/books/raton-perez");
  await noSidewaysScroll(page);

  await page.goto("/books/raton-perez");
  await expect(page.getByRole("heading", { level: 1 })).toHaveAttribute("lang", "es");
  await expect(page.getByTestId("public-language")).toContainText("Read aloud in Spanish.");
  await expect(page.getByTestId("public-opening")).toContainText("Entre la muerte del rey que rabió");
  const ld = (await page.locator('script[type="application/ld+json"]').allTextContents()).join("");
  expect(ld).toContain('"inLanguage":"es"');

  await page.goto("/books");
  await page.getByRole("searchbox").fill("spanish");
  await expect(page.getByTestId("language-badge")).toHaveCount(3);
});
