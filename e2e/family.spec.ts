import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

/** Amendment 002: two-key family voice permissions, end to end against the preview family. */

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
}

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
  await page.goto("/family/kids/maya/storytellers");
  await expect(page.getByRole("heading", { name: "Manage storytellers for Maya" })).toBeVisible();

  const lou = page.getByTestId("storyteller-voice-lou");
  await expect(lou).toContainText("Waiting for permission");
  await expect(lou.getByRole("switch")).toBeDisabled();

  // Priya shared her voice, but sharing alone doesn't put her in one of the family's narrator slots.
  const priya = page.getByTestId("storyteller-voice-priya");
  await expect(priya).toContainText("Needs a narrator slot");
  await expect(priya.getByRole("switch")).toBeDisabled();
  await priya.getByRole("link", { name: "Manage narrator slots" }).click();

  await expect(page.getByTestId("slots-used")).toHaveText("4 of 4 slots used");
  await expect(page.getByTestId("slot-voice-priya").getByRole("button", { name: "Add to a slot" })).toBeDisabled();
  await page.getByRole("button", { name: "Add a slot", exact: true }).click();
  await expect(page.getByTestId("slot-checkout")).toContainText("$5.99/month");
  await page.getByRole("button", { name: "Confirm slot" }).click();
  await expect(page.getByTestId("slots-used")).toHaveText("4 of 5 slots used");
  await page.getByTestId("slot-voice-priya").getByRole("button", { name: "Add to a slot" }).click();
  await expect(page.getByTestId("slots-used")).toHaveText("5 of 5 slots used");

  await page.goto("/family/kids/maya/storytellers");
  await expect(page.getByTestId("storyteller-voice-priya")).toContainText("Not available to this child");
  await expect(page.getByTestId("storyteller-voice-priya")).toContainText("Available to your family");
  await page.getByTestId("storyteller-voice-priya").getByRole("switch", { name: "Aunt Priya for Maya" }).click();
  await expect(page.getByTestId("storyteller-voice-priya")).toContainText("Approved for Maya");

  // Leo's choices are separate.
  await page.getByRole("link", { name: "Leo" }).click();
  await expect(page.getByRole("heading", { name: "Manage storytellers for Leo" })).toBeVisible();
  await expect(page.getByTestId("storyteller-voice-priya")).toContainText("Not available to this child");
});

test("a ready storyteller is added and approved for children from one page", async ({ page }) => {
  await signIn(page, "adult:sara");
  // The "ready to read" notice opens Family storytellers on that storyteller's card.
  await page.goto("/family/narrators?add=voice-priya");
  const priya = page.getByTestId("slot-voice-priya");
  await expect(priya).toContainText("Ready to add");
  // Every slot is in use: the voice is ready, but nothing is bought automatically.
  await expect(priya.getByTestId("slots-full-note")).toContainText("all your narrator slots are in use");
  await expect(page.getByTestId("slots-used")).toHaveText("4 of 4 slots used");

  await page.getByRole("button", { name: "Add a slot", exact: true }).click();
  await page.getByRole("button", { name: "Confirm slot" }).click();
  await priya.getByRole("button", { name: "Add to a slot" }).click();
  const pick = page.getByTestId("pick-kids");
  await expect(pick).toBeVisible();
  // No child is ticked for the parent.
  await expect(pick.getByRole("checkbox", { name: "Maya" })).not.toBeChecked();
  await pick.getByRole("checkbox", { name: "Maya" }).check();
  await pick.getByRole("button", { name: "Approve for this child" }).click();
  await expect(page.getByText(/Maya can now hear/)).toBeVisible();
  await noOverflow(page);

  await page.goto("/family/kids/maya/storytellers");
  await expect(page.getByTestId("storyteller-voice-priya")).toContainText("Approved for Maya");
  await page.goto("/family/kids/leo/storytellers");
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

  // Playing starts this child's listening session and reads from the current sentence.
  await page.getByRole("button", { name: "Play" }).click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  await page.getByRole("button", { name: "Pause" }).click();

  // Each child keeps their own place: coming back resumes at the same sentence and narrator.
  await page.reload();
  await expect(page.getByTestId("sentence-position")).toHaveText(/Sentence 3 of/);
  await expect(page.getByTestId("current-narrator")).toHaveText("Grandma June");

  // Kids can't reach parent controls: the device is sent back to its bookshelf.
  await page.goto("/family/kids/maya/storytellers");
  await expect(page).toHaveURL(/\/kids$/);
});

test("the kids player buffers the next few sentences so the story reads straight through", async ({ page }) => {
  await signIn(page, "adult:sara");
  await page.goto("/family");
  await page.getByRole("button", { name: "Open Maya's Readli Kids" }).click();
  await page.getByRole("link", { name: /The Lion and the Mouse/ }).click();
  await expect(page.getByTestId("current-narrator")).toHaveText("Mom");
  await expect(page.getByText(/Preview family: narration here is a stand-in sound/)).toBeVisible();

  const asked: number[] = [];
  page.on("request", (r) => {
    if (r.url().endsWith("/api/kids/narrations") && r.method() === "POST") asked.push((r.postDataJSON() as { sentence: number }).sentence);
  });
  await page.getByRole("button", { name: "Play" }).click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  // The next three sentences are fetched while the first is still playing, so a short line doesn't leave a gap.
  await expect.poll(() => asked).toEqual([0, 1, 2, 3]);
  await expect(page.getByTestId("sentence-position")).toHaveText(/Sentence 2 of/, { timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  await expect.poll(() => asked.includes(4)).toBe(true);
  await page.getByRole("button", { name: "Pause" }).click();
  // Paused partway, the story can start again from the beginning.
  await page.getByRole("button", { name: "Start over" }).click();
  await expect(page.getByTestId("sentence-position")).toHaveText(/Sentence 1 of/);
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  await page.getByRole("button", { name: "Pause" }).click();
});

test("the kids player skips a sentence whose audio won't play instead of stopping", async ({ page }) => {
  await signIn(page, "adult:sara");
  await page.goto("/family");
  await page.getByRole("button", { name: "Open Maya's Readli Kids" }).click();
  await page.getByRole("link", { name: /The Lion and the Mouse/ }).click();
  await expect(page.getByTestId("current-narrator")).toHaveText("Mom");

  // The second sentence's audio is broken every time it is asked for.
  await page.route("**/api/kids/narrations", async (route) => {
    const { sentence } = route.request().postDataJSON() as { sentence: number };
    if (sentence !== 1) return route.continue();
    await route.fulfill({ json: { url: "/missing-sentence.mp3", expiresAt: new Date(Date.now() + 60_000).toISOString() } });
  });
  await page.getByRole("button", { name: "Play" }).click();
  await expect(page.getByTestId("sentence-position")).toHaveText(/Sentence 3 of/, { timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  await page.getByRole("button", { name: "Pause" }).click();
});

test("the kids player keeps reading when its listening session lapses", async ({ page }) => {
  await signIn(page, "adult:sara");
  await page.goto("/family");
  await page.getByRole("button", { name: "Open Maya's Readli Kids" }).click();
  await page.getByRole("link", { name: /The Lion and the Mouse/ }).click();
  await expect(page.getByTestId("current-narrator")).toHaveText("Mom");

  const asked: number[] = [];
  page.on("request", (r) => {
    if (r.url().endsWith("/api/kids/narrations") && r.method() === "POST") asked.push((r.postDataJSON() as { sentence: number }).sentence);
  });
  await page.getByRole("button", { name: "Play" }).click();
  await expect.poll(() => asked).toEqual([0, 1, 2, 3]);
  // The server forgets the session, as it does after the page sits idle.
  expect((await page.request.delete("/api/kids/maya/listening")).status()).toBeLessThan(300);
  await expect(page.getByTestId("sentence-position")).toHaveText(/Sentence 3 of/, { timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  await expect(page.getByText("That storyteller isn't available right now")).toHaveCount(0);
  await page.getByRole("button", { name: "Pause" }).click();
});

test("an owner's revocation removes the voice from every child, and sharing again starts off", async ({ page }) => {
  await signIn(page, "adult:sara");
  expect((await page.request.post("/api/family/narrators/slots")).status()).toBe(200);
  expect((await page.request.post("/api/family/narrators", { data: { voiceId: "voice-priya", action: "activate" } })).status()).toBe(200);
  expect((await approve(page.request, "maya", "voice-priya", true)).status()).toBe(200);
  await signIn(page, "adult:priya");
  await page.goto("/family/my-voice");
  const toggle = page.getByRole("switch", { name: "Share my voice with Our family" });
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  // Read-only: what the family's parents chose for Priya's voice.
  const status = page.locator('[data-testid^="family-status-"]');
  await expect(status).toContainText("Added as a narrator");
  await expect(status).toContainText("Reading to Maya");
  await toggle.click();
  await expect(page.getByRole("status")).toContainText("removed from every child");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await expect(status).toContainText("Waiting for a parent to add you as a narrator");

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

test("direct API requests can't reach unapproved voices or change approvals", async ({ page, context, browser, playwright }) => {
  const anon = await playwright.request.newContext({ baseURL: "http://localhost:3100" });
  expect((await anon.get("/api/kids/maya/narrators")).status()).toBe(401);
  expect((await approve(anon, "maya", "voice-lou", true)).status()).toBe(401);
  await anon.dispose();

  await signIn(page, "adult:sara");
  // A parent can't approve a voice its owner never shared.
  expect((await approve(page.request, "maya", "voice-lou", true)).status()).toBe(409);
  // The same grown-up on another browser, which stays signed in while this one is in Kids Mode.
  const phone = await browser.newContext();
  await phone.addCookies(await context.cookies());
  // A child can't open a profile alone, or change anything once inside one.
  await signIn(page, "child:maya");
  expect((await page.request.post("/api/family/session", { data: { as: "child:leo" } })).status()).toBe(403);
  expect((await approve(page.request, "maya", "voice-priya", true)).status()).toBe(403);
  expect((await page.request.put("/api/family/voices/voice-priya/share", { data: { householdId: "home-demo", shared: true } })).status()).toBe(403);
  // Unapproved, unshared, and a sibling's narrators are all refused.
  const narrate = (voiceId: string, childId = "maya") =>
    page.request.post("/api/kids/narrations", { data: { childId, voiceId, bookSlug: "the-lion-and-the-mouse", sentence: 0 } });
  expect((await narrate("voice-lou")).status()).toBe(403);
  expect((await narrate("voice-rose")).status()).toBe(403);
  expect((await narrate("voice-rose", "leo")).status()).toBe(403);
  expect((await page.request.get("/api/kids/leo/narrators")).status()).toBe(403);
  // An approved narrator works, and its audio is re-checked on fetch.
  expect((await narrate("voice-june")).status()).toBe(409); // not listening yet
  expect((await page.request.post("/api/kids/maya/listening")).status()).toBe(200);
  const ok = await narrate("voice-june");
  expect(ok.status()).toBe(200);
  const { url } = (await ok.json()) as { url: string };
  expect((await page.request.get(url)).status()).toBe(200);
  expect((await approve(phone.request, "maya", "voice-june", false)).status()).toBe(200);
  expect((await page.request.get(url)).status()).toBe(403);
  await phone.close();
});

test("a fourth child can be added at no extra charge, up to six", async ({ page }) => {
  await signIn(page, "adult:sara");
  await page.goto("/family/kids");
  await expect(page.getByTestId("profiles-count")).toHaveText("2 of 6 profiles");
  for (const name of ["Ava", "Ben"]) {
    await page.getByLabel("Add a child").fill(name);
    await page.getByRole("button", { name: "Add profile" }).click();
    await expect(page.getByRole("status")).toContainText(`${name}'s profile is ready`);
  }
  await expect(page.getByTestId("profiles-count")).toHaveText("4 of 6 profiles");
  await expect(page.getByRole("status")).toContainText("no extra charge");
  for (const name of ["Cleo", "Dev"]) expect((await page.request.post("/api/family/children", { data: { nickname: name } })).status()).toBe(200);
  expect((await page.request.post("/api/family/children", { data: { nickname: "Eli" } })).status()).toBe(409);
});

test("only three children can listen at once", async ({ page, context, browser }) => {
  await signIn(page, "adult:sara");
  for (const name of ["Ava", "Ben"]) await page.request.post("/api/family/children", { data: { nickname: name } });
  const kids = ((await (await page.request.get("/api/family/children")).json()) as { children: { id: string }[] }).children.map((c) => c.id);
  expect(kids).toHaveLength(4);
  // Each child listens on their own browser, opened by the same grown-up.
  const parent = await context.cookies();
  for (const [i, id] of kids.entries()) {
    const tablet = await browser.newContext();
    await tablet.addCookies(parent);
    const res = await tablet.request.post("/api/family/session", { data: { as: `child:${id}` } });
    expect(res.status(), id).toBe(200);
    expect((await tablet.request.post(`/api/kids/${id}/listening`)).status(), id).toBe(i < 3 ? 200 : 429);
  }
});

test("kids can only switch to a storyteller whose reading is prepared at their place", async ({ page }) => {
  await signIn(page, "adult:sara");
  await signIn(page, "child:maya");
  await page.goto("/kids/listen/the-tale-of-peter-rabbit");
  await expect(page.getByTestId("current-narrator")).toHaveText("Mom");
  await page.getByRole("button", { name: /Change storyteller/ }).click();
  const picker = page.getByRole("group", { name: "Choose a storyteller" });
  // Grandma June has only the first two sentences of this book prepared.
  await expect(picker.getByRole("button", { name: /Grandma June/ })).toContainText("Ready here");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByTestId("sentence-position")).toHaveText(/Sentence 3 of/);
  const june = picker.getByRole("button", { name: /Grandma June/ });
  await expect(june).toContainText("Not ready yet");
  await expect(june).toBeDisabled();
  await expect(page.getByTestId("current-narrator")).toHaveText("Mom");
  // Going back to a prepared sentence, the switch is instant and keeps the place.
  await page.getByRole("button", { name: "Back" }).click();
  await june.click();
  await expect(page.getByTestId("current-narrator")).toHaveText("Grandma June");
  await expect(page.getByTestId("sentence-position")).toHaveText(/Sentence 2 of/);
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByTestId("not-prepared")).toBeVisible();
  await expect(page.getByRole("button", { name: "Play" })).toBeDisabled();
});

test("a parent prepares narration ahead of time and is told when it's ready", async ({ page }) => {
  await signIn(page, "adult:sara");
  await page.goto("/family");
  await page.getByRole("navigation", { name: "Readli Family" }).getByRole("link", { name: "Books" }).click();
  await expect(page.getByRole("heading", { name: "Books", exact: true })).toBeVisible();
  await page.getByTestId("catalog").getByTestId("book-the-princess-and-the-pea").click();
  await expect(page.getByRole("heading", { name: "The Princess and the Pea" })).toBeVisible();

  // One status per narrator, in the narrator list.
  const status = (voice: string) => page.getByTestId(`narrator-${voice}`).getByTestId("availability");
  await expect(status("voice-june")).toHaveText("Partly ready");
  await expect(status("voice-rose")).toHaveText("Not prepared");
  await expect(status("voice-sara")).toHaveText("Ready");
  // Aunt Priya shared her voice but isn't in a narrator slot.
  await expect(status("voice-priya")).toHaveText("Needs setup");
  await page.getByTestId("narrator-voice-priya").click();
  await expect(page.getByTestId("prepare-voice-priya")).toContainText("narrator slot");
  // Narration that is already prepared plays straight away and asks for nothing more.
  await page.getByTestId("narrator-voice-sara").click();
  const sara = page.getByTestId("prepare-voice-sara");
  await expect(sara.getByTestId("ready-to-play")).toBeVisible();
  await expect(sara.getByRole("button", { name: /Prepare whole book|Prepare the rest/ })).toHaveCount(0);

  await page.getByTestId("narrator-voice-june").click();
  const june = page.getByTestId("prepare-voice-june");
  await expect(page.getByTestId("book-status")).toHaveText("Partly ready");
  await june.getByRole("button", { name: /Prepare the rest/ }).click();
  const confirm = june.getByTestId("confirm-generation");
  await expect(confirm).toContainText("already prepared are free");
  await expect(confirm).toContainText("Your balance");
  await confirm.getByRole("button", { name: "Prepare now" }).click();
  await expect(status("voice-june")).toHaveText("Ready", { timeout: 15_000 });

  await page.goto("/family");
  const notice = page.getByTestId("notifications");
  await expect(notice).toContainText("The Princess and the Pea");
  await expect(notice).toContainText("read by Grandma June");
  // Dismissing it keeps it dismissed for this grown-up; the audiobook stays on the bookshelf.
  const dismissed = page.waitForResponse((r) => r.url().endsWith("/api/family/notifications") && r.request().method() === "POST");
  await notice.getByRole("button", { name: "Dismiss" }).click();
  expect((await dismissed).status()).toBe(200);
  await page.reload();
  await expect(page.getByTestId("notifications")).toHaveCount(0);
  await expect(page.getByTestId("shelf-book-the-princess-and-the-pea")).toBeVisible();
});

test("Books is one catalog with search, simple filters and each book's cost in the chosen voice", async ({ page }, info) => {
  await signIn(page, "adult:sara");
  await page.goto("/family/books");
  const catalog = page.getByTestId("catalog");
  const book = (slug: string) => catalog.getByTestId(`book-${slug}`);
  // Every book shows by default, shortest first, including ones the family can't afford yet.
  await expect(book("aesops-fables-retold")).toContainText("More credits needed");
  await expect(book("the-lion-and-the-mouse").getByTestId("cost")).toContainText("Ready · free to play");
  await expect(catalog.getByTestId("catalog-count")).toContainText("Showing 12 of");
  await noOverflow(page);
  await page.screenshot({ path: `e2e/screenshots/books-catalog-${info.project.name}.png`, fullPage: true });

  const filter = (name: string) => catalog.getByRole("group", { name: "Filters" }).getByRole("button", { name });
  await filter("Ready to play").click();
  await expect(filter("Ready to play")).toHaveAttribute("aria-pressed", "true");
  await expect(book("the-lion-and-the-mouse")).toBeVisible();
  await expect(book("aesops-fables-retold")).toHaveCount(0);
  await filter("Longer adventures").click();
  await expect(book("aesops-fables-retold")).toBeVisible();
  await filter("Fits my credits").click();
  await expect(book("aesops-fables-retold")).toHaveCount(0);
  await filter("All").click();

  await catalog.getByRole("searchbox", { name: "Search books" }).fill("velveteen");
  await expect(book("the-lion-and-the-mouse")).toHaveCount(0);
  await catalog.getByRole("searchbox", { name: "Search books" }).fill("zzz");
  await expect(catalog.getByTestId("catalog-empty")).toBeVisible();

  // Opening a book and coming back keeps the same view.
  await catalog.getByRole("searchbox", { name: "Search books" }).fill("");
  await filter("Quick stories").click();
  await book("the-lion-and-the-mouse").click();
  await expect(page).toHaveURL(/\/family\/books\/the-lion-and-the-mouse$/);
  await page.goBack();
  await expect(filter("Quick stories")).toHaveAttribute("aria-pressed", "true");
  await expect(book("aesops-fables-retold")).toHaveCount(0);
});

test("short on credits: prepare a chapter, or buy credits and come straight back to confirm", async ({ page }) => {
  await signIn(page, "adult:sara");
  await page.goto("/family/books/aesops-fables-retold");
  const status = (voice: string) => page.getByTestId(`narrator-${voice}`).getByTestId("availability");
  await page.getByTestId("narrator-voice-june").click();
  const june = page.getByTestId("prepare-voice-june");
  await expect(status("voice-june")).toHaveText("Needs credits");
  await expect(june.getByRole("button", { name: "Prepare whole book" })).toBeDisabled();
  await expect(june.getByTestId("credits-needed")).toContainText("more credits for the whole book");
  await expect(page.getByTestId("shorter-books")).toBeVisible();

  // One chapter fits the balance.
  await june.getByTestId("chapter-1").getByRole("button", { name: /Prepare/ }).click();
  await expect(june.getByTestId("confirm-generation")).toContainText("Chapter 1, The Tortoise and the Hare");
  await june.getByTestId("confirm-generation").getByRole("button", { name: "Prepare now" }).click();
  await expect(status("voice-june")).toHaveText("Partly ready", { timeout: 15_000 });
  await expect(june.getByTestId("chapter-1")).toContainText("Ready");

  // Buying credits returns to this book and narrator with the confirmation already open.
  await june.getByTestId("get-credits").click();
  await expect(page.getByRole("heading", { name: "Readli credits" })).toBeVisible();
  await expect(page.getByTestId("need")).toContainText("more credits");
  await page.getByRole("button", { name: "Buy 20" }).click();
  await expect(page).toHaveURL(/\/family\/books\/aesops-fables-retold\?voice=voice-june&scope=book/);
  const confirm = page.getByTestId("prepare-voice-june").getByTestId("confirm-generation");
  await expect(confirm).toBeVisible();
  await expect(confirm).toContainText("The whole book");
  await confirm.getByRole("button", { name: "Prepare now" }).click();
  await expect(status("voice-june")).toHaveText("Ready", { timeout: 20_000 });

  await page.goto("/family/credits");
  await expect(page.getByTestId("credit-history")).toContainText("Aesop's Fables read by Grandma June");
  await expect(page.getByTestId("credit-history")).toContainText("Credit pack (20)");
});

test("kids can't buy credits or start narration", async ({ page }) => {
  await signIn(page, "adult:sara");
  await signIn(page, "child:maya");
  expect((await page.request.post("/api/family/narration-credits", { data: { packId: "pack-small" } })).status()).toBe(403);
  expect((await page.request.post("/api/family/books/aesops-fables-retold/narration", { data: { voiceId: "voice-june", scope: "chapter", chapter: 2, confirm: true } })).status()).toBe(403);
  await page.goto("/kids/discover");
  await expect(page.getByTestId("discover-aesops-fables-retold")).toContainText("Aesop's Fables");
  await expect(page.getByRole("link", { name: /Aesop's Fables/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Prepare/ })).toHaveCount(0);
});

test("family storytellers: invite into a free slot, see who's on the way, and only offer extra slots when full", async ({ page }, info) => {
  await signIn(page, "adult:sara");
  await page.goto("/family/narrators");
  await expect(page.getByRole("heading", { name: "Family storytellers" })).toBeVisible();
  await expect(page.getByTestId("slots-used")).toHaveText("4 of 4 slots used");
  // Every slot is in use, so an extra slot is offered.
  await expect(page.getByRole("heading", { name: "Need more narrators?" })).toBeVisible();
  await expect(page.getByTestId("slot-voice-lou")).toContainText("Not shared yet");

  await page.getByTestId("slot-voice-rose").getByRole("button", { name: "Free up this slot" }).click();
  await expect(page.getByTestId("slots-used")).toHaveText("3 of 4 slots used");
  // Uncle Sam's voice is still being made, but nobody holds a slot until a parent adds a ready voice.
  await expect(page.getByTestId("reserved-slot")).toHaveCount(0);
  const freeSlot = page.getByTestId("free-slot");
  await expect(freeSlot).toContainText("Available");
  // With an included slot open, there's no upsell.
  await expect(page.getByRole("heading", { name: "Need more narrators?" })).toHaveCount(0);

  await freeSlot.getByRole("button", { name: "Invite a storyteller" }).click();
  const form = page.getByTestId("invite-form");
  await form.getByLabel("Their email").fill("andrea@example.com");
  await form.getByLabel(/Their name/).fill("Mommy");
  await form.getByText("Mom", { exact: true }).click();
  await noOverflow(page);
  await page.screenshot({ path: `e2e/screenshots/storytellers-invite-${info.project.name}.png`, fullPage: true });
  await form.getByRole("button", { name: "Create invitation" }).click();
  await expect(page.getByTestId("invite-sent")).toContainText("Invitation ready for Mommy");
  await expect(page.getByTestId("invite-sent")).toContainText("nothing was sent");

  // Inviting neither holds nor uses a slot; the invitation shows as on the way and can be withdrawn.
  await expect(page.getByTestId("slots-used")).toHaveText("3 of 4 slots used");
  await expect(page.getByTestId("reserved-slot")).toHaveCount(0);
  await expect(page.getByTestId("free-slot")).toContainText("Available");
  const invite = page.getByTestId("on-the-way").getByRole("listitem").filter({ hasText: "Mommy" });
  await expect(invite).toContainText("Invitation sent");
  await noOverflow(page);
  await page.screenshot({ path: `e2e/screenshots/storytellers-on-the-way-${info.project.name}.png`, fullPage: true });
  await invite.getByRole("button", { name: "Withdraw" }).click();
  await expect(page.getByTestId("on-the-way").getByRole("listitem").filter({ hasText: "Mommy" })).toHaveCount(0);
  await expect(page.getByTestId("free-slot")).toContainText("Available");
});

test("family storytellers: a parent can still invite when every slot is in use", async ({ page }) => {
  await signIn(page, "adult:sara");
  await page.goto("/family/narrators");
  // The preview family uses all four slots. Aunt Priya is ready, but can't be added until one frees up.
  await expect(page.getByTestId("slots-used")).toHaveText("4 of 4 slots used");
  await expect(page.getByTestId("free-slot")).toHaveCount(0);
  const priya = page.getByTestId("slot-voice-priya");
  await expect(priya.getByRole("button", { name: "Add to a slot" })).toBeDisabled();
  await expect(priya.getByTestId("slots-full-note")).toBeVisible();

  await page.getByRole("button", { name: "Invite a storyteller" }).click();
  await page.getByTestId("invite-form").getByLabel("Their name").fill("Pat");
  await page.getByRole("button", { name: "Create invitation" }).click();
  await expect(page.getByTestId("invite-sent")).toContainText("Invitation ready for Pat");
  await expect(page.getByTestId("slots-used")).toHaveText("4 of 4 slots used");
  await expect(page.getByTestId("on-the-way").getByRole("listitem").filter({ hasText: "Pat" })).toContainText("Invitation sent");
  await noOverflow(page);
});

test("family storytellers: a parent can remove a storyteller from the family", async ({ page }) => {
  await signIn(page, "adult:sara");
  await page.goto("/family/narrators");
  const lou = page.getByTestId("slot-voice-lou");
  await expect(lou).toContainText("Not shared yet");
  page.once("dialog", (d) => d.accept());
  await lou.getByRole("button", { name: "Remove from family" }).click();
  await expect(page.getByText("Grandpa Lou was removed from your family.")).toBeVisible();
  await expect(page.getByTestId("slot-voice-lou")).toHaveCount(0);
});

test("family storytellers: a family's nickname for a storyteller shows only in that family", async ({ page }) => {
  await signIn(page, "adult:sara");
  await page.goto("/family/narrators");
  const june = page.getByTestId("slot-voice-june");
  await june.getByRole("button", { name: "Change what we call them" }).click();
  await june.getByLabel("What your family calls Grandma June").fill("Gigi");
  await june.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Your family will see Grandma June as Gigi.")).toBeVisible();
  await expect(june).toContainText("Gigi");
  await expect(june).toContainText("Grandma June");
  await noOverflow(page);

  // Clearing it brings back her own name.
  await june.getByRole("button", { name: "Change what we call them" }).click();
  await june.getByLabel("What your family calls Grandma June").fill("");
  await june.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Your family will see Grandma June's own name again.")).toBeVisible();
});

test("Home's invite link opens the invite form on Family storytellers", async ({ page }) => {
  await signIn(page, "adult:sara");
  await page.goto("/family/narrators#invite");
  await expect(page.getByTestId("invite-form")).toBeVisible();
});
