import { expect, test } from "@playwright/test";

test("a finished take becomes a voice and reads four stories, with free replays", async ({ page }, info) => {
  await page.goto("/try");
  await page.getByLabel(/18 or older/).check();
  await page.getByLabel(/may process this recording/).check();
  await page.getByRole("button", { name: "Continue to recording" }).click();

  await page.getByRole("button", { name: "Start recording" }).click();
  // Real audio time: the server checks the take's bytes against its length, so a fake clock won't do here.
  test.setTimeout(180_000);
  await page.getByTestId("teleprompter").hover();
  await page.mouse.wheel(0, 20_000);
  await expect(page.getByRole("button", { name: "Finish" })).toBeEnabled({ timeout: 70_000 });
  await page.getByRole("button", { name: "Finish" }).click();
  await page.getByRole("button", { name: "Choose a story" }).click();

  // The stories are their own step: the teleprompter is gone, not scrolled past.
  await expect(page.getByTestId("demo-books").getByRole("article")).toHaveCount(6);
  await expect(page.getByTestId("teleprompter")).toHaveCount(0);
  await expect(page.getByTestId("try-steps")).toContainText("Hear a story");
  const preview = page.getByTestId("voice-preview");
  const peter = preview.getByRole("article", { name: "The Tale of Peter Rabbit" });
  await expect(peter.getByRole("button", { name: "Hear this passage" })).toBeEnabled();
  await peter.getByRole("button", { name: "Hear this passage" }).click();

  await expect(preview.getByText("The Tale of Peter Rabbit · read by you")).toBeVisible({ timeout: 15_000 });
  await expect(preview.getByLabel("The Tale of Peter Rabbit, read in your voice")).toHaveAttribute("src", /^blob:/);
  await expect(preview.getByText("Test mode: this is a stand-in sound, not your voice.")).toBeVisible();
  await expect(preview.getByTestId("preview-counter")).toContainText("1 of 4 stories explored");
  // Next steps keep the take, so nobody reads the story again.
  const next = preview.getByTestId("try-next-steps");
  await expect(next.getByRole("link", { name: "Share my voice, free" })).toHaveAttribute("href", /^\/signup\/voice\?from=try/);
  await expect(next.getByRole("link", { name: "Start Readli Family" })).toHaveAttribute("href", /^\/signup\/family\?from=try/);
  await page.screenshot({ path: `e2e/screenshots/try-preview-${info.project.name}.png` });

  // Second preview with noise clean-up flipped re-makes the voice from the saved take, then the free limit is reached.
  const cleanUp = preview.getByLabel(/Clean up background noise/);
  const wasOn = await cleanUp.isChecked();
  await cleanUp.setChecked(!wasOn);
  await preview.getByRole("article", { name: "Winnie-the-Pooh" }).getByRole("button", { name: "Hear this passage" }).click();
  await expect(preview.getByText("Winnie-the-Pooh · read by you")).toBeVisible({ timeout: 15_000 });
  await expect(preview.getByText(`Noise clean-up ${wasOn ? "off" : "on"}`)).toBeVisible();
  await expect(preview.getByTestId("preview-counter")).toContainText("2 of 4 stories explored");

  const unheard = preview.getByRole("article").filter({ has: page.getByRole("button", { name: "Hear this passage" }) });
  await unheard.first().getByRole("button", { name: "Hear this passage" }).click();
  await expect(preview.getByTestId("preview-counter")).toContainText("3 of 4 stories explored", { timeout: 15_000 });

  // Replaying a story already heard in this voice doesn't count.
  await preview.getByRole("article", { name: "Winnie-the-Pooh" }).getByRole("button", { name: "Play again" }).click();
  await expect(preview.getByText("Winnie-the-Pooh · read by you")).toBeVisible();
  await expect(preview.getByTestId("preview-counter")).toContainText("3 of 4 stories explored");

  await unheard.first().getByRole("button", { name: "Hear this passage" }).click();
  await expect(preview.getByTestId("preview-counter")).toContainText("4 of 4 stories explored", { timeout: 15_000 });
  await expect(preview.getByText("You've explored all your free stories.").first()).toBeVisible();
  await expect(unheard.first().getByRole("button", { name: "Hear this passage" })).toBeDisabled();
  await preview.getByRole("article", { name: "Winnie-the-Pooh" }).getByRole("button", { name: "Play again" }).click();
  await expect(preview.getByText("Winnie-the-Pooh · read by you")).toBeVisible();

  // The browser's back button returns to the recording, with the take still there.
  await page.goBack();
  await expect(page.getByTestId("teleprompter")).toBeVisible();
  await expect(page.getByRole("button", { name: "Choose a story" })).toBeVisible();

  // Back from a signup page reopens the stories in the voice already made, without recording again.
  await page.goto("/signup/voice?from=try&book=winnie-the-pooh");
  await expect(page.getByRole("heading", { name: "Save your voice for free" })).toBeVisible();
  await expect(page.getByTestId("demo-recording")).toContainText("heard Winnie-the-Pooh in your voice");
  await expect(page.getByText("Readli Voice doesn't include")).toHaveCount(0);
  await page.getByRole("link", { name: "← Back" }).click();
  await expect(page).toHaveURL(/\/try\?resume=1/);
  await expect(page.getByTestId("demo-books").getByRole("article")).toHaveCount(6);
  await expect(page.getByTestId("teleprompter")).toHaveCount(0);
  await expect(page.getByTestId("try-next-steps")).toBeVisible();
  await page.getByTestId("voice-preview").getByRole("article", { name: "Winnie-the-Pooh" }).getByRole("button").click();
  await expect(page.getByText("Winnie-the-Pooh · read by you")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("preview-counter")).toContainText("4 of 4 stories explored");
});

test("the server refuses previews without a session and a voice", async ({ request }) => {
  const res = await request.post("/api/demo/generate", { data: { slug: "winnie-the-pooh" } });
  expect(res.status()).toBe(401);
  const consentless = await request.post("/api/guest/session", { data: { adultOwner: true } });
  expect(consentless.status()).toBe(400);
});
