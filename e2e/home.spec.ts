import { expect, test } from "@playwright/test";

test("homepage follows the design brief order with six books under the demo", async ({ page }, info) => {
  await page.goto("/");
  const headings = await page.locator("main h2").allTextContents();
  expect(headings.slice(0, 2)).toEqual(["Try your voice. No signup.", "Pick a story to hear in your voice"]);
  expect(headings).toEqual(
    expect.arrayContaining(["How Readli Family Works", "Every family has a story. Every voice makes it special.", "Safe for families by design", "Start a family library"]),
  );

  const books = page.getByTestId("demo-books").getByRole("article");
  await expect(books).toHaveCount(6);

  // Family tree: explorable without signing up, nothing is sent.
  const tree = page.getByTestId("family-tree");
  await tree.getByRole("button", { name: /Grandpa Joe/ }).click();
  const profile = page.getByRole("region", { name: "Grandpa Joe's profile" });
  await profile.getByRole("button", { name: "Invite to record" }).click();
  await expect(profile).toContainText("nothing was sent");
  await tree.getByRole("button", { name: "List", exact: true }).click();
  await expect(tree.getByRole("list", { name: "Example family members" }).getByRole("button")).toHaveCount(11);
  await tree.getByRole("button", { name: "Tree", exact: true }).click();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  // Scroll through so lazy-loaded images render, then confirm every image loaded.
  for (let y = 0; y < (await page.evaluate(() => document.body.scrollHeight)); y += 600) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(50);
  }
  await expect.poll(() => page.evaluate(() => [...document.images].every((img) => img.complete && img.naturalWidth > 0))).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `e2e/screenshots/home-${info.project.name}.png`, fullPage: true });
});

test("footer and company page link every official account in a new tab", async ({ page }) => {
  for (const path of ["/", "/company"]) {
    await page.goto(path);
    const social = page.getByRole("list", { name: "Readli on social media" }).getByRole("link");
    await expect(social).toHaveCount(8);
    for (const link of await social.all()) {
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
  }
  await expect(page.getByTestId("official-accounts").getByRole("link")).toHaveCount(8);
  await expect(page.getByRole("link", { name: /LinkedIn/ }).first()).toHaveAttribute("href", "https://www.linkedin.com/company/readli/");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
