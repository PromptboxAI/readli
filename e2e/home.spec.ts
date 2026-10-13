import { expect, test } from "@playwright/test";

test("homepage follows the design brief order with six books under the demo", async ({ page }, info) => {
  await page.goto("/");
  const headings = await page.locator("main h2").allInnerTexts();
  expect(headings.slice(0, 2)).toEqual(["Hear your voice tell a story.", "Pick a story to hear in your voice"]);
  expect(headings).toEqual(
    expect.arrayContaining(["How Readli Family Works", "Every family has a story. Every voice makes it special.", "Start a family library"]),
  );
  expect(headings).not.toContain("Safe for families by design");
  expect(headings).not.toContain("Your book buddy, at rest and listening");

  const books = page.getByTestId("demo-books").getByRole("article");
  await expect(books).toHaveCount(6);

  // Family tree: explorable without signing up, nothing is sent.
  const tree = page.getByTestId("family-tree");
  // Phones open on the list, cut off after Grandpa Joe.
  const phone = (page.viewportSize()?.width ?? 1000) < 640;
  await expect(tree.getByRole("button", { name: "List", exact: true })).toHaveAttribute("aria-pressed", String(phone));
  await tree.getByRole("button", { name: /Grandpa Joe/ }).click();
  const profile = page.getByRole("region", { name: "Grandpa Joe's profile" });
  await profile.getByRole("button", { name: "Invite to record" }).click();
  await expect(profile).toContainText("nothing was sent");
  await tree.getByRole("button", { name: "List", exact: true }).click();
  await expect(tree.getByRole("list", { name: "Example family members" }).getByRole("button")).toHaveCount(phone ? 4 : 11);
  await tree.getByRole("button", { name: "Tree", exact: true }).click();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  // Confirm no image is broken by fetching each one, rather than waiting for the browser to load
  // lazy images, which a headless run doesn't reliably start and made this check flaky.
  const broken = await page.evaluate(async () => {
    const srcs = [...new Set([...document.images].map((img) => img.currentSrc || img.src).filter(Boolean))];
    const results = await Promise.all(
      srcs.map(async (src) => {
        const res = await fetch(src).catch(() => null);
        return res?.ok && (res.headers.get("content-type") ?? "").startsWith("image/") ? null : src;
      }),
    );
    return results.filter((src) => src !== null);
  });
  expect(broken).toEqual([]);
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
  for (const path of ["/", "/company", "/login", "/privacy", "/terms", "/accessibility", "/parents/safety", "/help", "/help/privacy-and-child-safety", "/help/books-and-listening", "/help/getting-started/what-is-readli"]) {
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
  for (const name of ["Mom", "Grandpa", "Aunt Pook", "Uncle Kevin"]) await expect(section.getByText(name, { exact: true })).toBeVisible();
  await expect(section.getByText("Awaiting voice-owner permission")).toBeVisible();
  // Phones skip the three points and use a text link instead of the button.
  const points = section.getByText("Voices are private by default");
  if (info.project.name === "phone") await expect(points).toBeHidden();
  else await expect(points).toBeVisible();
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

test("terms explain both voice approvals and accessibility gives a contact", async ({ page }) => {
  await page.goto("/terms");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Terms of Service");
  await expect(page.locator("main section h2")).toHaveCount(16);
  await expect(page.locator("#private-family-voices-and-child-level-approval")).toContainText("two independent permissions");
  await expect(page.getByText("COUNSEL REVIEW REQUIRED")).toHaveCount(0);
  await expect(page.getByText("Pre-publication verification")).toHaveCount(0);

  await page.goto("/accessibility");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Accessibility Statement");
  await expect(page.getByRole("link", { name: "admin@readli.ai" })).toHaveAttribute("href", "mailto:admin@readli.ai");
  await expect(page.getByText("IMPLEMENTATION CHECK")).toHaveCount(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("try your voice shows three steps on desktop and a short pitch on phones", async ({ page }, info) => {
  await page.goto("/");
  const section = page.locator("#try-your-voice");
  // No studio picture: the hero already shows a highlighted story (Kevin, 2026-10-12).
  await expect(section.getByTestId("voice-studio-preview")).toHaveCount(0);
  await expect(page.locator("#try-heading")).toHaveText("Hear your voice tell a story.");
  if (info.project.name === "desktop") {
    await expect(section.getByTestId("demo-steps").getByRole("heading", { level: 3 })).toHaveText(["Confirm it's your voice", "Read a short story", "Hear it in a story"]);
    await expect(section.getByText("deleted within 24 hours")).toBeVisible();
    await section.getByRole("link", { name: /Start recording/ }).click();
  } else {
    await expect(section.getByText("Read a short passage, then hear your voice bring a story to life.")).toBeVisible();
    await expect(section.getByText("No signup required")).toBeVisible();
    await section.getByRole("link", { name: "Try Your Voice Free" }).click();
  }
  await expect(page).toHaveURL(/\/try$/);
});

test("the library section shows the six new books on a shelf and links to the library", async ({ page }) => {
  await page.goto("/");
  const section = page.locator("#stories");
  await expect(section.getByRole("heading", { level: 2 })).toHaveText("A Whole World of Stories Awaits");
  await expect(section.getByRole("img")).toHaveCount(6);
  await expect(section.getByRole("link", { name: "Goldilocks and the Three Bears" })).toHaveAttribute("href", "/books/goldilocks-and-the-three-bears");
  await expect(section.getByRole("link", { name: "Explore the Readli Library" })).toHaveAttribute("href", "/books");
});

test("phone menu closes after tapping a section link", async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "phone menu only");
  await page.goto("/");
  await page.getByText("Menu", { exact: true }).click();
  const menu = page.locator("header details nav");
  await expect(menu).toBeVisible();
  await menu.getByRole("link", { name: "How it Works" }).click();
  await expect(page).toHaveURL(/#how-it-works$/);
  await expect(menu).toBeHidden();
});

test("the closing section offers the 14-day Readli Family trial", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("family-trial-line")).toContainText("Try Readli Family free for 14 days. Card required, cancel any time.");
  await expect(page.getByRole("link", { name: "Start your free trial" })).toHaveAttribute("href", "/signup/family");
});
