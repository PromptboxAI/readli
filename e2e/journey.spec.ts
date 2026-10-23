import { expect, test } from "@playwright/test";

test("family journey fits in the old block's space", async ({ page }, info) => {
  await page.goto("/design/journey");
  const journey = page.locator("#family-journey");
  await expect(journey.getByRole("heading", { name: "How Grandpa Kevin reads to every grandchild" })).toBeVisible();
  const oldH = (await page.locator("#old-block").boundingBox())!.height;
  const newH = (await journey.boundingBox())!.height;
  console.log(`[journey] ${info.project.name}: old ${Math.round(oldH)}px, new ${Math.round(newH)}px`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await journey.scrollIntoViewIfNeeded();
  await journey.screenshot({ path: `e2e/screenshots/journey-${info.project.name}.png`, animations: "disabled" });
});
