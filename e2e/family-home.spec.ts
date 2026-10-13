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
  for (const name of ["Kids profiles", "Family storytellers", "Readli credits", "Plan and billing", "Kids devices and PIN", "Account settings"]) {
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

test("every Readli Family page has a way back up", async ({ page }) => {
  await signIn(page, "adult:sara");
  const pages: [string, string][] = [
    ["/family/narrators", "/family"],
    ["/family/my-voice", "/family"],
    ["/family/kids", "/family"],
    ["/family/books", "/family"],
    ["/family/controls", "/family"],
    ["/family/billing", "/family/controls"],
    ["/family/credits", "/family/controls"],
    ["/family/devices", "/family/controls"],
    ["/family/kids/maya/storytellers", "/family/kids"],
  ];
  for (const [path, up] of pages) {
    await page.goto(path);
    await expect(page.getByTestId("back-link"), path).toHaveAttribute("href", up);
  }
  await page.goto("/family/narrators");
  await page.getByTestId("back-link").click();
  await expect(page).toHaveURL(/\/family$/);
});

test("a storyteller in a slot leads straight to choosing which kids hear them", async ({ page }) => {
  await signIn(page, "adult:sara");
  await page.goto("/family/narrators");
  await expect(page.getByTestId("slot-voice-sara").getByRole("link", { name: "Choose kids" })).toHaveAttribute("href", "/family/kids");
});

test("Back after approving a storyteller shows the change, not a stale page", async ({ page }) => {
  await signIn(page, "adult:sara");
  await page.goto("/family");
  const dad = page.getByTestId("home-storytellers").getByRole("link", { name: /Dad/ });
  await expect(dad).toContainText("Approved for Leo");
  await page.getByRole("link", { name: "Manage storytellers" }).first().click();
  await expect(page.getByRole("heading", { name: "Manage storytellers for Maya" })).toBeVisible();
  await page.getByRole("switch", { name: "Dad for Maya" }).click();
  await expect(page.getByTestId("storyteller-voice-ben")).toContainText("Approved for Maya");
  await page.goBack();
  await expect(page).toHaveURL(/\/family$/);
  await expect(page.getByTestId("home-storytellers").getByRole("link", { name: /Dad/ })).toContainText("Approved for every child");
});

