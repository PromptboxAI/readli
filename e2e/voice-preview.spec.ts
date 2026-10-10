import { expect, test } from "@playwright/test";

test("a finished take becomes a voice and reads a story, within the free preview limit", async ({ page }, info) => {
  await page.goto("/try");
  await page.getByLabel(/18 or older/).check();
  await page.getByLabel(/may process this recording/).check();
  await page.getByRole("button", { name: "Continue to recording" }).click();

  await page.getByRole("button", { name: "Start recording" }).click();
  // A real minute of audio: the server checks the take's bytes against its length, so a fake clock won't do here.
  test.setTimeout(150_000);
  await expect(page.getByRole("button", { name: "Finish" })).toBeEnabled({ timeout: 70_000 });
  await page.getByRole("button", { name: "Finish" }).click();
  await page.getByRole("button", { name: "Choose a story" }).click();

  const preview = page.getByTestId("voice-preview");
  const peter = preview.getByRole("article", { name: "The Tale of Peter Rabbit" });
  await expect(peter.getByRole("button", { name: "Hear this passage" })).toBeEnabled();
  await peter.getByRole("button", { name: "Hear this passage" }).click();

  await expect(preview.getByText("The Tale of Peter Rabbit · read by you")).toBeVisible({ timeout: 15_000 });
  await expect(preview.getByLabel("The Tale of Peter Rabbit, read in your voice")).toHaveAttribute("src", /^blob:/);
  await expect(preview.getByText("Test mode: this is a stand-in sound, not your voice.")).toBeVisible();
  await expect(preview.getByText("1 free preview left.", { exact: false })).toBeVisible();
  await page.screenshot({ path: `e2e/screenshots/try-preview-${info.project.name}.png` });

  // Second preview reuses the same voice, then the free limit is reached.
  await preview.getByRole("article", { name: "Winnie-the-Pooh" }).getByRole("button", { name: "Hear this passage" }).click();
  await expect(preview.getByText("Winnie-the-Pooh · read by you")).toBeVisible({ timeout: 15_000 });
  await expect(preview.getByText("0 free previews left.", { exact: false })).toBeVisible();
  await expect(preview.getByRole("article", { name: "Alice’s Adventures in Wonderland" }).getByRole("button")).toBeDisabled();
});

test("the server refuses previews without a session and a voice", async ({ request }) => {
  const res = await request.post("/api/demo/generate", { data: { slug: "winnie-the-pooh" } });
  expect(res.status()).toBe(401);
  const consentless = await request.post("/api/guest/session", { data: { adultOwner: true } });
  expect(consentless.status()).toBe(400);
});
