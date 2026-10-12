import { expect, test } from "@playwright/test";

// Family invitations need real accounts and Supabase; the preview build shows what it can safely.

test("the invite page explains it needs accounts in the preview", async ({ page }) => {
  await page.goto("/voice/invite");
  await expect(page.getByRole("heading", { name: "Invite your family" })).toBeVisible();
  await expect(page.getByRole("note")).toContainText("Family invitations need Readli accounts");
});

test("an unknown invitation link is not found", async ({ page }) => {
  const res = await page.goto("/v/abcdefghijklmnopqrstuvwxyz012345");
  expect(res?.status()).toBe(404);
  const respond = await page.goto("/v/respond/nope?action=decline");
  expect(respond?.status()).toBe(404);
});

test("admin can see the invitation limits with Kevin's defaults", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByRole("link", { name: "Family invitations" })).toHaveAttribute("href", "/admin/invitations");
  await page.goto("/admin/invitations");
  await expect(page.getByRole("heading", { name: "Family invitations" })).toBeVisible();
  await expect(page.getByLabel("People per send")).toHaveValue("10");
  await expect(page.getByLabel("People per contributor per day")).toHaveValue("30");
  await expect(page.getByLabel("Resends per person")).toHaveValue("3");
  await expect(page.getByLabel("Days a link works")).toHaveValue("14");
  await expect(page.getByLabel("Contributors can send invitations")).not.toBeChecked();
});
