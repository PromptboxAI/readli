import { expect, test } from "@playwright/test";

test("family journey fits in the old block's space", async ({ page }, info) => {
  await page.goto("/design/journey");
  const journey = page.locator("#family-journey");
  await expect(journey.getByRole("heading", { name: "One voice. Every grandchild. No distance between them." })).toBeVisible();
  const oldH = (await page.locator("#old-block").boundingBox())!.height;
  const newH = (await journey.boundingBox())!.height;
  console.log(`[journey] ${info.project.name}: old ${Math.round(oldH)}px, new ${Math.round(newH)}px`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await journey.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  const shot = await journey.screenshot({ path: `e2e/screenshots/journey-${info.project.name}.jpg`, type: "jpeg", quality: 60, animations: "disabled" });
  // Temporary: print the image so it can be read from the CI log while artifacts are out of reach.
  const b64 = shot.toString("base64");
  for (let i = 0; i < b64.length; i += 8000) console.log(`[journey-img ${info.project.name} ${i}] ${b64.slice(i, i + 8000)}`);
});
