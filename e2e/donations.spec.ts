import { expect, test } from "@playwright/test";

test("Readli Gives Back explains the donation and checks the request form", async ({ page }) => {
  await page.goto("/donations");
  await expect(page).toHaveTitle("Donation Requests for School Raffles & Charity Auctions | Readli");
  await expect(page.getByRole("heading", { level: 1, name: "Helping Good Causes Tell Great Stories." })).toBeVisible();
  // Plan facts come from the live plan settings, never a number typed into the page.
  const pkg = page.getByTestId("donation-package");
  await expect(page.getByTestId("donation-value")).toHaveText("$179.99");
  await expect(pkg).toContainText("Up to 6 child profiles.");
  await expect(pkg).toContainText("2 active saved family narrators");
  await expect(page.getByTestId("donations-cta")).toHaveAttribute("href", "#request");

  const form = page.getByTestId("donation-form");
  await form.getByRole("button", { name: "Request Our Readli Donation" }).click();
  await expect(form.getByRole("alert")).toHaveText("Please fix the highlighted fields.");
  await expect(form.getByText("Enter your organization's name.")).toBeVisible();
  await expect(form.getByText("Tell us a little about your fundraiser and who it helps.")).toBeVisible();
  await expect(form.getByRole("textbox", { name: "Your name *" })).toBeFocused();
  await expect(form.getByRole("textbox", { name: "Organization name *" })).toHaveAttribute("aria-invalid", "true");
  await expect(form.getByRole("combobox")).toHaveCount(0);

  await expect(page.locator("footer").getByRole("link", { name: "Readli Gives Back" })).toHaveAttribute("href", "/donations");
});

test("/redeem asks the winner for their code in the program's words", async ({ page }) => {
  await page.goto("/redeem");
  await expect(page.getByRole("heading", { level: 1, name: "Your Next Chapter Starts Here." })).toBeVisible();
  await page.getByLabel("Redemption code").fill("nope");
  await page.getByRole("button", { name: "Redeem Gift" }).click();
  await expect(page.getByText(/doesn't look like a gift code/)).toBeVisible();
});
