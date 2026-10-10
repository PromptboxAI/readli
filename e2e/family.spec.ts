import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

/** Amendment 002: two-key family voice permissions, end to end against the preview family. */

async function signIn(page: Page, who: string) {
  const res = await page.request.post("/api/family/session", { data: { as: who } });
  expect(res.status(), who).toBe(200);
}

async function approve(request: APIRequestContext, child: string, voiceId: string, approved: boolean) {
  return request.put(`/api/family/kids/${child}/storytellers`, { data: { changes: [{ voiceId, approved }] } });
}

test("a parent manages storytellers child by child", async ({ page }) => {
  await page.goto("/family");
  await page.getByRole("button", { name: "Sign in as Mom" }).click();
  await expect(page.getByRole("heading", { name: "Mom" })).toBeVisible();
  await page.getByRole("link", { name: "Manage storytellers" }).first().click();
  await expect(page.getByRole("heading", { name: "Manage storytellers for Maya" })).toBeVisible();

  const priya = page.getByTestId("storyteller-voice-priya");
  await expect(priya).toContainText("Not available to this child");
  await expect(priya).toContainText("Available to your family");
  const lou = page.getByTestId("storyteller-voice-lou");
  await expect(lou).toContainText("Waiting for permission");
  await expect(lou.getByRole("switch")).toBeDisabled();

  await priya.getByRole("switch", { name: "Aunt Priya for Maya" }).click();
  await expect(page.getByTestId("storyteller-voice-priya")).toContainText("Approved for Maya");

  // Leo's choices are separate.
  await page.getByRole("link", { name: "Leo" }).click();
  await expect(page.getByRole("heading", { name: "Manage storytellers for Leo" })).toBeVisible();
  await expect(page.getByTestId("storyteller-voice-priya")).toContainText("Not available to this child");
});

test("kids see only approved narrators and can switch without losing their place", async ({ page }) => {
  await signIn(page, "adult:sara");
  await page.goto("/family");
  await page.getByRole("button", { name: "Open Maya's Readli Kids" }).click();
  await expect(page.getByRole("heading", { name: /Hi Maya/ })).toBeVisible();
  await page.getByRole("link", { name: /The Lion and the Mouse/ }).click();

  await expect(page.getByTestId("current-narrator")).toHaveText("Mom");
  await page.getByRole("button", { name: /Change storyteller/ }).click();
  const picker = page.getByRole("group", { name: "Choose a storyteller" });
  await expect(picker.getByRole("button")).toHaveCount(2);
  await expect(picker).toContainText("Grandma June");
  for (const hidden of ["Nana Rose", "Aunt Priya", "Grandpa Lou", "Uncle Sam"]) await expect(picker).not.toContainText(hidden);

  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByTestId("sentence-position")).toHaveText(/Sentence 3 of/);
  await picker.getByRole("button", { name: /Grandma June/ }).click();
  await expect(page.getByTestId("current-narrator")).toHaveText("Grandma June");
  await expect(page.getByTestId("sentence-position")).toHaveText(/Sentence 3 of/);

  // Kids can't reach parent controls.
  await page.goto("/family/kids/maya/storytellers");
  await expect(page.getByRole("heading", { name: "Ask a grown-up" })).toBeVisible();
});

test("an owner's revocation removes the voice from every child, and sharing again starts off", async ({ page }) => {
  await signIn(page, "adult:sara");
  expect((await approve(page.request, "maya", "voice-priya", true)).status()).toBe(200);
  await signIn(page, "adult:priya");
  await page.goto("/family/my-voice");
  const toggle = page.getByRole("switch", { name: "Share my voice with Our family" });
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await toggle.click();
  await expect(page.getByRole("status")).toContainText("removed from every child");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");

  await signIn(page, "adult:sara");
  await signIn(page, "child:maya");
  const res = await page.request.get("/api/kids/maya/narrators");
  const ids = ((await res.json()) as { narrators: { voiceId: string }[] }).narrators.map((n) => n.voiceId);
  expect(ids).not.toContain("voice-priya");
});

test("a friendly empty state when no storytellers are approved", async ({ page }) => {
  await signIn(page, "adult:sara");
  for (const v of ["voice-sara", "voice-ben", "voice-rose"]) expect((await approve(page.request, "leo", v, false)).status()).toBe(200);
  await signIn(page, "child:leo");
  await page.goto("/kids/listen/winnie-the-pooh");
  await expect(page.getByTestId("no-storytellers")).toContainText("No storytellers yet");
});

test("direct API requests can't reach unapproved voices or change approvals", async ({ page, playwright }) => {
  const anon = await playwright.request.newContext({ baseURL: "http://localhost:3100" });
  expect((await anon.get("/api/kids/maya/narrators")).status()).toBe(401);
  expect((await approve(anon, "maya", "voice-lou", true)).status()).toBe(401);
  await anon.dispose();

  await signIn(page, "adult:sara");
  // A parent can't approve a voice its owner never shared.
  expect((await approve(page.request, "maya", "voice-lou", true)).status()).toBe(409);
  // A child can't open a profile alone, or change anything once inside one.
  await signIn(page, "child:maya");
  expect((await page.request.post("/api/family/session", { data: { as: "child:leo" } })).status()).toBe(403);
  expect((await approve(page.request, "maya", "voice-priya", true)).status()).toBe(403);
  expect((await page.request.put("/api/family/voices/voice-priya/share", { data: { householdId: "home-demo", shared: true } })).status()).toBe(403);
  // Unapproved, unshared, and a sibling's narrators are all refused.
  const narrate = (voiceId: string, childId = "maya") =>
    page.request.post("/api/kids/narrations", { data: { childId, voiceId, bookSlug: "winnie-the-pooh", sentence: 0 } });
  expect((await narrate("voice-lou")).status()).toBe(403);
  expect((await narrate("voice-rose")).status()).toBe(403);
  expect((await narrate("voice-rose", "leo")).status()).toBe(403);
  expect((await page.request.get("/api/kids/leo/narrators")).status()).toBe(403);
  // An approved narrator works, and its audio is re-checked on fetch.
  const ok = await narrate("voice-june");
  expect(ok.status()).toBe(200);
  const { url } = (await ok.json()) as { url: string };
  expect((await page.request.get(url)).status()).toBe(200);
  await signIn(page, "adult:sara");
  expect((await approve(page.request, "maya", "voice-june", false)).status()).toBe(200);
  await signIn(page, "child:maya");
  expect((await page.request.get(url)).status()).toBe(403);
});
