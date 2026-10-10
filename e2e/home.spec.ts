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

  // Load every lazy image now, then confirm none is broken. Scrolling past lazy images in a
  // headless run doesn't reliably start their fetch, which made this check flaky.
  await page.evaluate(() => document.querySelectorAll<HTMLImageElement>('img[loading="lazy"]').forEach((img) => (img.loading = "eager")));
  await expect
    .poll(() => page.evaluate(() => [...document.images].every((img) => img.complete && img.naturalWidth > 0)), { timeout: 15_000 })
    .toBe(true);
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

test("links from the footer open the next page at the top", async ({ page }) => {
  await page.goto("/");
  await page.locator("footer").scrollIntoViewIfNeeded();
  await page.locator("footer").getByRole("link", { name: "Company" }).click();
  await expect(page).toHaveURL(/\/company$/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
});

test("header and page links never lead to a missing page", async ({ page, request }) => {
  const hrefs = new Set<string>();
  for (const path of ["/", "/company", "/login"]) {
    await page.goto(path);
    for (const href of await page.locator("header a[href^='/'], main a[href^='/']").evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? "/")))
      hrefs.add(href.split("#")[0] || "/");
  }
  for (const href of hrefs) expect((await request.get(href)).status(), href).toBe(200);
});
