import { expect, test, type Page } from "@playwright/test";

/** The family home and parent controls against the preview family. */

async function signIn(page: Page, who: string) {
  expect((await page.request.post("/api/family/session", { data: { as: who } })).status(), who).toBe(200);
}

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
}

test("the family home leads with the kids, stories and storytellers", async ({ page }, info) => {
  await signIn(page, "adult:sara");
  await page.goto("/family");
  await expect(page.getByRole("heading", { name: "Welcome back, Mom" })).toBeVisible();
  const kids = page.getByTestId("home-kids");
  await expect(kids).toContainText("Maya");
  await expect(kids).toContainText("Leo");
  await expect(kids.getByRole("button", { name: "Open Maya's Readli Kids" })).toBeVisible();

  // Mom's voice is prepared for the homepage stories in the preview.
  await expect(page.getByTestId("shelf-ready").getByTestId("home-book-the-lion-and-the-mouse")).toContainText("Ready with Mom");
  await expect(page.getByTestId("shelf-new")).toBeVisible();

  const storytellers = page.getByTestId("home-storytellers");
  await expect(storytellers).toContainText("Approved for every child");
  await expect(storytellers.getByRole("link", { name: /Grandpa Lou/ })).toContainText("Waiting for their permission to share");
  // A voice still being made isn't listed yet.
  await expect(storytellers).not.toContainText("Uncle Sam");

  await noOverflow(page);
  await page.screenshot({ path: `e2e/screenshots/family-home-${info.project.name}.png`, fullPage: true });
});

test("parent controls gather the admin pages", async ({ page }, info) => {
  await signIn(page, "adult:sara");
  await page.goto("/family");
  await page.getByRole("link", { name: "All parent controls" }).click();
  await expect(page.getByRole("heading", { name: "Parent controls" })).toBeVisible();
  const controls = page.getByTestId("parent-controls");
  for (const name of ["Kids profiles", "Family storytellers", "Readli credits", "Plan and billing", "Kids Mode PIN and devices", "Account settings"]) {
    await expect(controls.getByRole("link", { name: new RegExp(name) })).toBeVisible();
  }
  await expect(controls.getByRole("link", { name: /Kids profiles/ })).toContainText("2 of 6");
  await noOverflow(page);
  await page.screenshot({ path: `e2e/screenshots/parent-controls-${info.project.name}.png`, fullPage: true });
});

test("a kids profile can't open parent controls", async ({ page }) => {
  await signIn(page, "adult:sara");
  await signIn(page, "child:maya");
  await page.goto("/family/controls");
  await expect(page).toHaveURL(/\/kids$/);
});
