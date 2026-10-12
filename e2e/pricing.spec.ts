import { expect, test } from "@playwright/test";

test("pricing page shows Family, Voice, extra storytellers and credit packs", async ({ page }) => {
  await page.goto("/pricing");
  await expect(page.getByRole("heading", { level: 1, name: "Pricing" })).toBeVisible();

  const family = page.getByTestId("plan-family");
  await expect(family).toContainText("$19.99");
  await expect(family).toContainText("$179.99/year");
  await expect(family).toContainText("40 narration credits every month");
  await expect(family.getByRole("link", { name: "Start your family" })).toHaveAttribute("href", "/signup/family");

  const voice = page.getByTestId("plan-voice");
  await expect(voice).toContainText("Always free");
  await expect(voice.getByRole("link", { name: "Share your voice" })).toHaveAttribute("href", "/signup/voice");

  await expect(page.getByRole("heading", { name: "Add a Family Storyteller" })).toBeVisible();
  await expect(page.getByText("$5.99").first()).toBeVisible();
  await expect(page.getByRole("cell", { name: "$31.97" })).toBeVisible();
  for (const price of ["$6.99", "$14.99", "$24.99"]) await expect(page.getByRole("cell", { name: price })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Storytellers and credits are different" })).toBeVisible();

  // Payments aren't live: nothing on the page leads to a checkout.
  await expect(page.locator("main a[href*='checkout']")).toHaveCount(0);
});

test("pricing is linked from the header and the footer", async ({ page }, info) => {
  await page.goto("/");
  await expect(page.getByRole("contentinfo").getByRole("link", { name: "Pricing" })).toHaveAttribute("href", "/pricing");
  if (info.project.name === "phone") await page.getByText("Menu").click();
  await page.getByRole("banner").getByRole("link", { name: "Pricing" }).click();
  await expect(page).toHaveURL(/\/pricing$/);
});
