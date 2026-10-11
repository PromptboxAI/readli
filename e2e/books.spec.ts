import { expect, test } from "@playwright/test";

test("anyone can browse and search the library without an account", async ({ page }) => {
  await page.goto("/books");
  await expect(page.getByRole("heading", { level: 1, name: "The Readli Library" })).toBeVisible();
  await expect(page.getByTestId("public-book-the-tale-of-peter-rabbit")).toBeVisible();
  await page.getByTestId("library-search").fill("duckling");
  await expect(page.getByTestId("public-book-the-ugly-duckling")).toBeVisible();
  await expect(page.getByTestId("public-book-the-tale-of-peter-rabbit")).toHaveCount(0);
  await page.getByTestId("library-search").fill("zzz");
  await expect(page.getByText("No stories match that yet.")).toBeVisible();
});

test("a book page sends grown-ups to their family library to prepare it", async ({ page }) => {
  await page.goto("/books/aesops-fables-retold");
  await expect(page.getByRole("heading", { level: 1, name: "Aesop's Fables" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Chapters" })).toBeVisible();
  await page.getByTestId("public-prepare").click();
  // No one is signed in, so preparing asks for a grown-up first.
  await expect(page.getByRole("heading", { name: "Ask a grown-up" })).toBeVisible();
});

test("full library editions list their real chapters", async ({ page }) => {
  await page.goto("/books/winnie-the-pooh");
  await expect(page.getByRole("heading", { name: "Chapters" })).toBeVisible();
  await expect(page.getByText("In Which Pooh Goes Visiting and Gets Into a Tight Place")).toBeVisible();
  await expect(page.getByTestId("public-coming-soon")).toHaveCount(0);
  await expect(page.getByTestId("public-prepare")).toBeVisible();
});
