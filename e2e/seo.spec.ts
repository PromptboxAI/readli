import { expect, test } from "@playwright/test";

const SITE = "https://readli.ai";

/** Crawler files are the same on every screen size, so one project checks them. */
const desktopOnly = () => test.skip(test.info().project.name !== "desktop", "crawler files are not layout-specific");

test("the sitemap is well-formed XML that a search engine can read", async ({ page, request }) => {
  desktopOnly();
  test.setTimeout(120_000);
  const res = await request.get("/sitemap.xml");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("xml");
  const xml = await res.text();
  expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);

  await page.goto("/");
  const parsed = await page.evaluate((text) => {
    const doc = new DOMParser().parseFromString(text, "application/xml");
    return {
      error: doc.querySelector("parsererror")?.textContent ?? null,
      root: doc.documentElement.localName,
      locs: [...doc.getElementsByTagName("loc")].map((l) => l.textContent ?? ""),
    };
  }, xml);
  expect(parsed.error).toBeNull();
  expect(parsed.root).toBe("urlset");
  expect(parsed.locs).toContain(`${SITE}/`);
  expect(parsed.locs).toContain(`${SITE}/books`);
  expect(new Set(parsed.locs).size).toBe(parsed.locs.length);

  // Every listed page must exist, so the sitemap never sends Google to a 404 or a redirect.
  for (const loc of parsed.locs) {
    expect(loc.startsWith(`${SITE}/`), loc).toBe(true);
    const listed = await request.get(loc.slice(SITE.length) || "/", { maxRedirects: 0 });
    expect(listed.status(), loc).toBe(200);
  }
});

test("robots.txt allows the site and points to the sitemap", async ({ request }) => {
  desktopOnly();
  const res = await request.get("/robots.txt");
  expect(res.status()).toBe(200);
  const body = await res.text();
  expect(body).toContain("Allow: /");
  expect(body).not.toMatch(/^Disallow: \/$/m);
  expect(body).toContain(`Sitemap: ${SITE}/sitemap.xml`);
});

test("Readli is described the same way in the footer, on /company and in llms.txt", async ({ page, request }) => {
  desktopOnly();
  const short = "Readli reads classic children's books aloud in the voices of the people your kids love.";
  const long = "Readli is a family storytelling app.";
  await page.goto("/");
  await expect(page.locator("footer")).toContainText(short);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", short);
  await page.goto("/company");
  await expect(page.locator("main")).toContainText(long);
  const llms = await (await request.get("/llms.txt")).text();
  expect(llms).toContain(short);
  expect(llms).toContain(long);
});
