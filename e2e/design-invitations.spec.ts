import { expect, test, type Page } from "@playwright/test";

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
}

const SCREENS = [
  { path: "/design/invitations", name: "composer", heading: "Invite your family" },
  { path: "/design/invitations/email", name: "email", heading: "Hi Sara, June has a story for you." },
  { path: "/design/invitations/preview", name: "preview", heading: "June recorded her voice to read stories to your family" },
  { path: "/design/invitations/accept", name: "accept", heading: "Add June to your Family Circle" },
];

for (const s of SCREENS) {
  test(`family invitation design: ${s.name}`, async ({ page }, info) => {
    await page.goto(s.path);
    await expect(page.getByTestId("design-banner")).toContainText("Nothing here sends, saves or charges");
    await expect(page.getByRole("heading", { level: 1, name: s.heading })).toBeVisible();
    await noOverflow(page);
    await page.screenshot({ path: `e2e/screenshots/design-invitations-${s.name}-${info.project.name}.png`, fullPage: true });
  });
}

test("the preview page discloses the trial and renewal, with checkout off", async ({ page }) => {
  await page.goto("/design/invitations/preview");
  const card = page.getByTestId("trial-card");
  await expect(card.getByRole("button", { name: "Start Your Free Family Trial" })).toBeDisabled();
  await expect(page.getByTestId("renewal-disclosure")).toContainText("$19.99 a month");
  await card.getByRole("radio", { name: /Yearly/ }).click();
  await expect(page.getByTestId("renewal-disclosure")).toContainText("$179.99 a year");
});
