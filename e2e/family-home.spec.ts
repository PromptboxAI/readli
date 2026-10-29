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

  // Every card opens Readli Kids from the same place, and says where that child is.
  await expect(kids).toHaveAttribute("data-layout", "detailed");
  await expect(kids.getByRole("button", { name: /Readli Kids/ })).toHaveCount(2);
  // Kids Mode is explained on request, not in a permanent paragraph.
  const about = page.getByTestId("kids-mode-note");
  await expect(about.getByText("family PIN")).toBeHidden();
  await about.getByText("About Kids Mode").click();
  await expect(about).toContainText("family PIN");

  // Mom's voice is prepared for the homepage stories in the preview: one row per book, with each child's place.
  const lion = page.getByTestId("shelf-book-the-lion-and-the-mouse");
  await expect(lion).toHaveAttribute("data-state", "ready");
  await expect(lion).toContainText("Read by Mom");
  await expect(lion).toContainText("Maya · not started");
  // A book carries no status of its own, only each child's place.
  for (const label of ["Ready to play", "In progress", "Completed"]) await expect(lion).not.toContainText(label);
  // Find your next story leads to Books: a slim strip on phones and tablets, a card beside the kids on desktop.
  const next = info.project.name === "desktop" ? page.getByTestId("next-story") : page.getByTestId("next-story-strip");
  await expect(next.getByRole("link", { name: "Browse Books" })).toBeVisible();
  await expect(next).toContainText(/of [\d.,]+ (monthly|trial) credits remaining/);
  await expect(next.getByRole("link", { name: /How credits work/ })).toHaveAttribute("href", "/family/settings/plan");

  // Home shows a few books, two across on wider screens, and the rest on request.
  const shelf = page.getByTestId("shelf-ready");
  const shown = await shelf.locator(":scope > li").count();
  expect(shown).toBeLessThanOrEqual(4);
  const viewAll = page.getByTestId("shelf-view-all");
  if (await viewAll.count()) {
    await viewAll.click();
    await expect(page).toHaveURL(/shelf=all/);
    await expect.poll(() => shelf.locator(":scope > li").count()).toBeGreaterThan(shown);
    await page.goto("/family");
  }
  await expect(page.getByRole("link", { name: "Invite a storyteller" })).toHaveAttribute("href", "/family/narrators#invite");

  const storytellers = page.getByTestId("home-storytellers");
  await expect(storytellers).toContainText("Approved for every child");
  await expect(storytellers.getByRole("link", { name: /Grandpa Lou/ })).toContainText("Waiting for their permission to share");
  // A voice still being made isn't listed yet.
  await expect(storytellers).not.toContainText("Uncle Sam");

  await noOverflow(page);
  await page.screenshot({ path: `e2e/screenshots/family-home-${info.project.name}.png`, fullPage: true });
});

test("Settings gathers the account, plan and credits, and Kids Mode", async ({ page }, info) => {
  await signIn(page, "adult:sara");
  await page.goto("/family");
  const nav = page.getByRole("navigation", { name: "Readli Family" });
  await expect(nav.getByRole("link")).toHaveText(["Home", "Books", "Family", "Settings"]);
  await nav.getByRole("link", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/family\/settings$/);
  await expect(nav.getByRole("link", { name: "Settings" })).toHaveAttribute("aria-current", "page");
  if (info.project.name === "phone") {
    // Phones open on the list of sections, each with a one-line summary.
    const list = page.getByTestId("settings-list");
    await expect(list.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(list.getByRole("link", { name: /Plan & credits/ })).toContainText("credits left");
    await expect(list.getByRole("link", { name: /Kids Mode/ })).toBeVisible();
    await page.screenshot({ path: `e2e/screenshots/settings-${info.project.name}.png`, fullPage: true });
    await list.getByRole("link", { name: /Plan & credits/ }).click();
  } else {
    // Wider screens open on Account, beside the sections.
    const rail = page.getByRole("navigation", { name: "Settings" });
    await expect(rail.getByRole("link", { name: "Account" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { name: "Account", level: 1 })).toBeVisible();
    await page.screenshot({ path: `e2e/screenshots/settings-${info.project.name}.png`, fullPage: true });
    await rail.getByRole("link", { name: "Plan & credits" }).click();
  }
  await expect(page).toHaveURL(/\/family\/settings\/plan$/);
  await expect(page.getByRole("heading", { name: "Plan & credits", level: 1 })).toBeVisible();
  await expect(page.getByTestId("current-plan")).toBeVisible();
  await expect(page.getByTestId("credit-balance")).toBeVisible();
  await noOverflow(page);
  await page.screenshot({ path: `e2e/screenshots/settings-plan-${info.project.name}.png`, fullPage: true });
});

test("the Family tab holds the kids and who reads to them", async ({ page }) => {
  await signIn(page, "adult:sara");
  await page.goto("/family/kids");
  const readers = page.getByTestId("family-readers");
  await expect(readers.getByRole("link", { name: /Family storytellers/ })).toContainText("slots");
  await readers.getByRole("link", { name: /My Voice/ }).click();
  await expect(page).toHaveURL(/\/family\/my-voice$/);
  await expect(page.getByRole("navigation", { name: "Readli Family" }).getByRole("link", { name: "Family" })).toHaveAttribute("aria-current", "page");
});

test("old settings links still open the right Settings page", async ({ page }) => {
  await signIn(page, "adult:sara");
  for (const [from, to] of [
    ["/family/controls", /\/family\/settings$/],
    ["/family/account", /\/family\/settings\/account$/],
    ["/family/billing?checkout=canceled", /\/family\/settings\/plan\?checkout=canceled$/],
    ["/family/credits", /\/family\/settings\/plan$/],
    ["/family/devices", /\/family\/settings\/kids-mode$/],
  ] as const) {
    await page.goto(from);
    await expect(page, from).toHaveURL(to);
  }
  await page.goto("/family/billing?checkout=canceled");
  await expect(page.getByText("Checkout was canceled. Nothing was charged.")).toBeVisible();
});

test("the Family tab lists the kids and opens Readli Kids from a child's profile", async ({ page }, info) => {
  await signIn(page, "adult:sara");
  await page.goto("/family");
  await page.getByRole("navigation", { name: "Readli Family" }).getByRole("link", { name: "Family" }).click();
  await expect(page).toHaveURL(/\/family\/kids$/);
  await expect(page.getByRole("heading", { name: "Kids profiles" })).toBeVisible();
  await noOverflow(page);
  await page.screenshot({ path: `e2e/screenshots/family-kids-${info.project.name}.png`, fullPage: true });
  await page.getByRole("button", { name: "Open Readli Kids for Maya" }).click();
  await expect(page).toHaveURL(/\/kids$/);
});

test("a kids profile can't open parent controls", async ({ page }) => {
  await signIn(page, "adult:sara");
  await signIn(page, "child:maya");
  await page.goto("/family/settings");
  await expect(page).toHaveURL(/\/kids$/);
});

test("every page below the main tabs has a way back up", async ({ page }) => {
  await signIn(page, "adult:sara");
  const pages: [string, string][] = [
    ["/family/narrators", "/family/kids"],
    ["/family/my-voice", "/family/kids"],
    ["/family/settings/plan", "/family/settings"],
    ["/family/settings/kids-mode", "/family/settings"],
    ["/family/settings/account", "/family/settings"],
    ["/family/kids/maya/storytellers", "/family/kids"],
  ];
  for (const [path, up] of pages) {
    await page.goto(path);
    await expect(page.getByTestId("back-link"), path).toHaveAttribute("href", up);
  }
  await page.goto("/family/narrators");
  await page.getByTestId("back-link").click();
  await expect(page).toHaveURL(/\/family\/kids$/);
});

test("Settings goes back to the page that opened it", async ({ page }) => {
  await signIn(page, "adult:sara");
  await page.goto("/family/books");
  await page.getByRole("banner").locator("button[aria-expanded]").filter({ visible: true }).click();
  await page.getByRole("navigation", { name: "Account" }).getByRole("link", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/family\/settings\?from=%2Ffamily%2Fbooks$/);
  const back = page.getByTestId("back-link").filter({ visible: true });
  await expect(back).toHaveText("← Books");
  await back.click();
  await expect(page).toHaveURL(/\/family\/books$/);
  // Opened directly, or from anywhere it can't trust, the way back is Home.
  for (const from of ["", "?from=https://example.com", "?from=//example.com"]) {
    await page.goto(`/family/settings${from}`);
    await expect(page.getByTestId("back-link").filter({ visible: true }), from).toHaveAttribute("href", "/family");
  }
});

test("a storyteller in a slot leads straight to choosing which kids hear them", async ({ page }) => {
  await signIn(page, "adult:sara");
  await page.goto("/family/narrators");
  await page.getByTestId("slot-voice-sara").getByRole("button", { name: "Choose kids" }).click();
  await expect(page.getByRole("heading", { name: /Which children can hear/ })).toBeVisible();
  // Home's "Not approved for a child yet" opens on the same choice.
  await page.goto("/family/narrators?choose=voice-sara");
  await expect(page.getByTestId("pick-kids")).toBeVisible();
});

test("Back after approving a storyteller shows the change, not a stale page", async ({ page }) => {
  await signIn(page, "adult:sara");
  await page.goto("/family");
  const dad = page.getByTestId("home-storytellers").getByRole("link", { name: /Dad/ });
  await expect(dad).toContainText("Approved for Leo");
  await page.goto("/family/kids/maya/storytellers");
  await expect(page.getByRole("heading", { name: "Manage storytellers for Maya" })).toBeVisible();
  await page.getByRole("switch", { name: "Dad for Maya" }).click();
  await expect(page.getByTestId("storyteller-voice-ben")).toContainText("Approved for Maya");
  await page.goBack();
  await expect(page).toHaveURL(/\/family$/);
  await expect(page.getByTestId("home-storytellers").getByRole("link", { name: /Dad/ })).toContainText("Approved for every child");
});

test("a ready story opens the grown-up player and plays stored audio", async ({ page }) => {
  await signIn(page, "adult:sara");
  await page.goto("/family");
  await page.getByTestId("shelf-ready").getByTestId("home-book-the-lion-and-the-mouse").click();
  await expect(page).toHaveURL(/\/family\/books\/the-lion-and-the-mouse\/listen$/);
  const player = page.getByTestId("grown-up-player");
  await expect(player.getByRole("heading", { name: "The Lion and the Mouse" })).toBeVisible();
  await expect(player.getByTestId("current-narrator")).toHaveText("Mom");
  // The same one-screen player as Readli Kids: nothing to scroll, the page fits its card.
  await expect(player).toHaveAttribute("data-mode", "read");
  expect(await player.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(0);
  await expect.poll(() => player.getByTestId("read-page").evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(0);
  await expect(player.getByTestId("player-page")).toHaveText(/Page 1 of \d+/);
  await page.screenshot({ path: `e2e/screenshots/grown-up-player-${test.info().project.name}.png` });
  await player.getByRole("button", { name: /Change storyteller/ }).click();
  await expect(player.getByRole("group", { name: "Storyteller" }).getByRole("button", { name: /Mom/ })).toHaveAttribute("aria-pressed", "true");
  await player.getByRole("button", { name: "Done" }).click();
  const sentences: number[] = [];
  page.on("request", (r) => {
    if (r.url().endsWith("/api/family/books/the-lion-and-the-mouse/listen") && r.method() === "POST") sentences.push((r.postDataJSON() as { sentence: number }).sentence);
  });
  // A fully prepared chapter plays as one continuous track joined from the stored sentences.
  const listen = page.waitForResponse((r) => r.url().endsWith("/api/family/books/the-lion-and-the-mouse/listen/track"));
  await player.getByRole("button", { name: "Play" }).click();
  const track = await listen;
  expect(track.status()).toBe(200);
  expect(track.request().postDataJSON()).toMatchObject({ voiceId: "voice-sara", chapter: 1 });
  await expect(player.getByRole("button", { name: "Pause" })).toBeVisible();
  // The sentence on screen follows the track's clock, with no request per sentence.
  await expect(player.getByTestId("sentence-position")).toHaveText(/Sentence 2 of/, { timeout: 15_000 });
  expect(sentences).toEqual([]);
  await expect(player.getByRole("button", { name: "Pause" })).toBeVisible();
  // Paused partway, the story can start again from the beginning.
  await player.getByRole("button", { name: "Pause" }).click();
  await player.getByRole("button", { name: "Start over" }).click();
  await expect(player.getByTestId("sentence-position")).toHaveText(/Sentence 1 of/);
  await expect(player.getByRole("button", { name: "Pause" })).toBeVisible();
  await noOverflow(page);
});

test("a kids profile can't use the grown-up player", async ({ page }) => {
  await signIn(page, "adult:sara");
  await signIn(page, "child:maya");
  const res = await page.request.post("/api/family/books/the-lion-and-the-mouse/listen", { data: { voiceId: "voice-sara", sentence: 0 } });
  expect(res.status()).toBe(403);
  await page.goto("/family/books/the-lion-and-the-mouse/listen");
  await expect(page).toHaveURL(/\/kids$/);
});


test("a book page sets up a storyteller in place, prepares the audiobook and plays it", async ({ page }) => {
  await signIn(page, "adult:sara");
  // Free one narrator slot, so Aunt Priya (shared, not in a slot) can use it.
  expect((await page.request.post("/api/family/narrators", { data: { voiceId: "voice-rose", action: "release" } })).status()).toBe(200);
  await page.goto("/family/books/the-princess-and-the-pea");
  await page.getByTestId("narrator-voice-priya").click();
  const priya = page.getByTestId("prepare-voice-priya");
  const setup = priya.getByTestId("setup");
  await expect(setup).toContainText("Shared with your family");
  await setup.getByRole("button", { name: "Use a narrator slot" }).click();
  await expect(setup).toContainText("In a narrator slot");
  await setup.getByRole("switch", { name: "Aunt Priya for Maya" }).click();
  await expect(setup.getByRole("switch", { name: "Aunt Priya for Maya" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText("Maya can listen to Aunt Priya.")).toBeVisible();

  // The approval is saved: after a reload it still shows, and Change opens the switches with Done to close them.
  await page.reload();
  await page.getByTestId("narrator-voice-priya").click();
  await expect(priya.getByTestId("setup")).toHaveCount(0);
  await expect(priya.locator("dt", { hasText: "Approved for" }).locator("+ dd")).toContainText("Maya");
  await priya.getByRole("button", { name: "Change" }).click();
  await expect(setup.getByRole("switch", { name: "Aunt Priya for Maya" })).toHaveAttribute("aria-checked", "true");
  await priya.getByTestId("setup-done").click();
  await expect(priya.getByTestId("setup")).toHaveCount(0);

  await priya.getByRole("button", { name: "Prepare whole book" }).click();
  await priya.getByTestId("confirm-generation").getByRole("button", { name: "Prepare now" }).click();
  const ready = priya.getByTestId("ready-to-play");
  await expect(ready).toBeVisible({ timeout: 20_000 });
  await expect(ready).toContainText("It's on Maya's bookshelf");
  await ready.getByRole("link", { name: "Play now" }).click();
  await expect(page).toHaveURL(/\/family\/books\/the-princess-and-the-pea\/listen\?voice=voice-priya/);
  await expect(page.getByTestId("grown-up-player")).toBeVisible();
});

test("Kids devices separates temporary Kids Mode from a registered device", async ({ page }, info) => {
  await signIn(page, "adult:sara");
  await page.goto("/family/settings/kids-mode");
  await expect(page.getByRole("heading", { name: "Kids Mode", level: 1 })).toBeVisible();
  const modes = page.getByTestId("kids-modes");
  await expect(modes).toContainText("Temporary");
  await expect(modes).toContainText("Ends on its own after 12 hours, and never registers a device");
  await expect(modes).toContainText("Stays set up");
  await expect(modes).toContainText("Ends after 90 days unused");
  await expect(page.getByRole("heading", { name: "Family PIN" })).toBeVisible();
  await noOverflow(page);
  await page.screenshot({ path: `e2e/screenshots/kids-devices-${info.project.name}.png`, fullPage: true });
});

test("six kids stay easy to tell apart, each one tap from Readli Kids, without sideways scrolling", async ({ page }, info) => {
  await signIn(page, "adult:sara");
  for (const name of ["Ava", "Ben", "Cleo", "Dev"]) expect((await page.request.post("/api/family/children", { data: { nickname: name } })).status()).toBe(200);
  await page.goto("/family");
  const kids = page.getByTestId("home-kids");
  await expect(kids).toHaveAttribute("data-layout", "compact");
  await expect(page.getByText("6 of 6 profiles")).toBeVisible();
  for (const name of ["Maya", "Leo", "Ava", "Ben", "Cleo", "Dev"]) {
    await expect(kids.getByRole("button", { name: `Open ${name}'s Readli Kids` })).toBeVisible();
  }
  // Every Open Readli Kids button in a row lines up, whether or not that child started a story.
  const tops = await kids.getByRole("button", { name: /Readli Kids/ }).evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().bottom)));
  const columns = info.project.name === "desktop" ? 3 : 2;
  for (let i = 0; i < tops.length; i += columns) expect(new Set(tops.slice(i, i + columns)).size).toBe(1);
  await noOverflow(page);
  await page.screenshot({ path: `e2e/screenshots/family-home-6-kids-${info.project.name}.png`, fullPage: true });
});

test("a grown-up picks up where they left off, without moving a child's place", async ({ page }) => {
  await signIn(page, "adult:sara");
  await page.goto("/family/books/the-lion-and-the-mouse/listen");
  const player = page.getByTestId("grown-up-player");
  await expect(player.getByTestId("sentence-position")).toHaveText(/Sentence 1 of/);
  // Opening a book saves nothing; moving does.
  const saved = page.waitForResponse((r) => r.url().endsWith("/api/family/books/the-lion-and-the-mouse/progress") && r.request().postDataJSON().sentence === 2);
  await player.getByRole("button", { name: "Next" }).click();
  await player.getByRole("button", { name: "Next" }).click();
  const res = await saved;
  expect(await res.json()).toMatchObject({ saved: true });
  expect(res.request().postDataJSON()).toMatchObject({ voiceId: "voice-sara", listenedAt: expect.any(Number), sentAt: expect.any(Number) });
  await page.reload();
  await expect(player.getByTestId("sentence-position")).toHaveText(/Sentence 3 of/);

  // Maya's own place in the same book is untouched.
  await signIn(page, "child:maya");
  await page.goto("/kids/listen/the-lion-and-the-mouse");
  await expect(page.getByTestId("sentence-position")).toHaveText(/Sentence 1 of/);
});
