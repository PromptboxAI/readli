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

test("links from the footer open the next page at the top", async ({ page }) => {
  await page.goto("/");
  await page.locator("footer").scrollIntoViewIfNeeded();
  await page.locator("footer").getByRole("link", { name: "Company" }).click();
  await expect(page).toHaveURL(/\/company$/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
});

test("header and page links never lead to a missing page", async ({ page, request }) => {
  const hrefs = new Set<string>();
  for (const path of ["/", "/company", "/login", "/privacy", "/terms", "/parents/safety"]) {
    await page.goto(path);
    for (const href of await page.locator("header a[href^='/'], main a[href^='/']").evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? "/")))
      hrefs.add(href.split("#")[0] || "/");
  }
  for (const href of hrefs) expect((await request.get(href)).status(), href).toBe(200);
});

test("family voices section shows the parent controls illustration and links to safety", async ({ page }, info) => {
  await page.goto("/");
  const section = page.locator("#family-privacy");
  await expect(section.getByRole("heading", { level: 2 })).toHaveText("Your family. Your voices. Your rules.");
  await expect(section.getByRole("img", { name: /Manage voices for Milly/ })).toBeVisible();
  for (const name of ["Mom", "Grandpa", "Aunt Pook", "Uncle Chris"]) await expect(section.getByText(name, { exact: true })).toBeVisible();
  await expect(section.getByText("Awaiting voice-owner permission")).toBeVisible();
  await section.scrollIntoViewIfNeeded();
  await section.screenshot({ path: `e2e/screenshots/family-voices-${info.project.name}.png` });
  await section.getByRole("link", { name: /Learn about family privacy & safety/ }).click();
  await expect(page).toHaveURL(/\/parents\/safety$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Family privacy & safety");
});

test("privacy page shows every policy section and fits the screen", async ({ page }, info) => {
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Privacy Policy");
  await expect(page.locator("main section h2")).toHaveCount(12);
  await expect(page.getByText("Required publication details")).toHaveCount(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({ path: `e2e/screenshots/privacy-${info.project.name}.png`, fullPage: true });
});

test("terms draft explains that both voice approvals are required", async ({ page }) => {
  await page.goto("/terms");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Terms of Service");
  await expect(page.getByText("This is a working draft for legal review.")).toBeVisible();
  await expect(page.locator("main section h2")).toHaveCount(12);
  await expect(page.locator("#family-voices-and-parent-approval")).toContainText("Both approvals are required");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
