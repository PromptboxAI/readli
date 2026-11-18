import { expect, test } from "@playwright/test";

async function signIn(page: import("@playwright/test").Page, as: string) {
  expect((await page.request.post("/api/family/session", { data: { as } })).status()).toBe(200);
}

test("Credits and history goes back to Books, on every screen size", async ({ page }) => {
  await signIn(page, "adult:sara");
  await page.goto("/family/books");
  await page.getByTestId("library-balance").click();
  await expect(page).toHaveURL(/\/family\/settings\/plan\?from=%2Ffamily%2Fbooks/);
  const back = page.getByTestId("back-link").filter({ visible: true });
  await expect(back).toHaveText(/Books/);
  await back.click();
  await expect(page).toHaveURL(/\/family\/books$/);
});

test("a book page shows each narrator's details folded under its row", async ({ page }) => {
  await signIn(page, "adult:sara");
  await page.goto("/family/books/the-princess-and-the-pea");
  await page.getByTestId("narrator-voice-sara").click();
  const row = page.getByTestId("narrator-voice-sara");
  await expect(row).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByTestId("narrator-details")).toBeVisible();
  await row.click();
  await expect(row).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByTestId("narrator-details")).toHaveCount(0);
});
