import { expect, test, type Page } from "@playwright/test";

/** Readli Kids: the bookshelf and the two-mode player, against the preview family. */

async function signIn(page: Page, who: string) {
  expect((await page.request.post("/api/family/session", { data: { as: who } })).status(), who).toBe(200);
}

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
}

/** The player fits one screen with nothing to scroll, and the whole cover shows at its own shape. */
async function fitsOneScreen(page: Page) {
  const player = page.getByTestId("kids-player");
  expect(await player.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(0);
  expect(await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)).toBeLessThanOrEqual(0);
  const view = page.viewportSize()!;
  const cover = (await page.getByTestId("player-cover").boundingBox())!;
  expect(cover.y).toBeGreaterThanOrEqual(0);
  expect(cover.y + cover.height).toBeLessThanOrEqual(view.height);
  expect(Math.abs(cover.width / cover.height - 3 / 4)).toBeLessThan(0.02);
  const play = (await page.getByRole("button", { name: "Play" }).boundingBox())!;
  expect(play.y + play.height).toBeLessThanOrEqual(view.height);
}

test("the kids bookshelf shows ready stories first and keeps the rest for a grown-up", async ({ page }, info) => {
  await signIn(page, "adult:sara");
  await signIn(page, "child:maya");
  await page.goto("/kids");
  await expect(page.getByRole("heading", { name: "Hi Maya! Pick a story." })).toBeVisible();
  const mine = page.getByRole("region", { name: "Ready to listen" });
  await expect(mine.getByRole("link", { name: /The Lion and the Mouse/ })).toContainText("with Mom");
  await expect(page.getByTestId("kids-continue")).toHaveCount(0);
  await noOverflow(page);
  await page.screenshot({ path: `e2e/screenshots/kids-home-${info.project.name}.png`, fullPage: true });

  // Unprepared books wait behind one small Discover entry, never as playable stories.
  await page.getByTestId("kids-discover").click();
  await expect(page).toHaveURL(/\/kids\/discover$/);
  await expect(page.getByTestId("discover-aesops-fables-retold")).toContainText("Aesop's Fables");
  await expect(page.getByTestId("discover-books").getByRole("link")).toHaveCount(0);
  await noOverflow(page);
  await page.screenshot({ path: `e2e/screenshots/kids-discover-${info.project.name}.png`, fullPage: true });
  await page.getByTestId("back-link").click();
  await expect(page).toHaveURL(/\/kids$/);
});

test("Continue listening isn't repeated in Ready to listen, and a finished story leaves it", async ({ page, context, browser }) => {
  await signIn(page, "adult:sara");
  const parent = await context.cookies();
  await signIn(page, "child:maya");
  const save = (sentence: number) => page.request.put("/api/kids/maya/progress", { data: { bookSlug: "the-lion-and-the-mouse", sentence, voiceId: "voice-sara" } });
  expect((await save(2)).status()).toBe(200);
  await page.goto("/kids");
  await expect(page.getByTestId("kids-continue")).toContainText("The Lion and the Mouse");
  await expect(page.getByRole("link", { name: /The Lion and the Mouse/ })).toHaveCount(1);
  // Each child's shelf is their own: Maya's place doesn't show on Leo's.
  const tablet = await browser.newContext();
  await tablet.addCookies(parent);
  const leo = await tablet.newPage();
  await signIn(leo, "child:leo");
  await leo.goto("/kids");
  await expect(leo.getByRole("heading", { name: "Hi Leo! Pick a story." })).toBeVisible();
  await expect(leo.getByTestId("kids-continue")).toHaveCount(0);
  await tablet.close();
  expect((await save(500)).status()).toBe(200);
  await page.goto("/kids");
  await expect(page.getByTestId("kids-continue")).toHaveCount(0);
  await expect(page.getByTestId("kids-ready").getByRole("link", { name: /The Lion and the Mouse/ })).toBeVisible();
});

test("a child asks a grown-up for a story, and it waits on Family Home with a way to prepare it", async ({ page, context, browser }, info) => {
  await signIn(page, "adult:sara");
  const parent = await context.cookies();
  await signIn(page, "child:maya");
  await page.goto("/kids/discover");
  await page.getByTestId("ask-thumbelina").click();
  await expect(page.getByTestId("asked-thumbelina")).toBeVisible();
  // Asking only sends the request: the book still isn't playable and nothing here prepares it.
  await expect(page.getByTestId("discover-books").getByRole("link")).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("asked-thumbelina")).toBeVisible();
  await noOverflow(page);
  await page.screenshot({ path: `e2e/screenshots/kids-asked-${info.project.name}.png`, fullPage: true });
  // The family Home is out of reach in Kids Mode.
  expect((await page.request.delete("/api/family/requests/anything")).status()).toBeGreaterThanOrEqual(400);

  const grownUp = await browser.newContext({ viewport: page.viewportSize() ?? undefined });
  await grownUp.addCookies(parent);
  const home = await grownUp.newPage();
  await home.goto("/family");
  const request = home.getByTestId("request-thumbelina");
  await expect(request).toContainText("Maya would like Thumbelina");
  await expect(home.getByTestId("prepare-thumbelina")).toHaveAttribute("href", "/family/books/thumbelina");
  await noOverflow(home);
  await home.screenshot({ path: `e2e/screenshots/home-requests-${info.project.name}.png`, fullPage: true });
  await request.getByRole("button", { name: /Dismiss Maya's request/ }).click();
  await expect(request).toHaveCount(0);
  await home.reload();
  await expect(home.getByTestId("story-requests")).toHaveCount(0);
  await grownUp.close();
});

test("the player opens in Listen mode, switches to Read-along at the same place, and remembers it", async ({ page }, info) => {
  await signIn(page, "adult:sara");
  await signIn(page, "child:maya");
  await page.goto("/kids/listen/the-lion-and-the-mouse");
  const player = page.getByTestId("kids-player");
  await expect(player).toHaveAttribute("data-mode", "listen");
  await expect(page.getByRole("heading", { name: "The Lion and the Mouse" })).toBeVisible();
  await expect(player).toContainText("Mom is reading");
  await expect(page.getByTestId("player-page")).toHaveText(/Page 1 of \d+/);
  await expect(page.getByRole("slider", { name: "Story time" })).toHaveAttribute("aria-valuetext", /^0:00 of \d+:\d\d, page 1 of \d+$/);
  await noOverflow(page);
  await fitsOneScreen(page);
  await page.screenshot({ path: `e2e/screenshots/player-listen-${info.project.name}.png` });

  await page.getByRole("button", { name: "Next" }).click();
  const saved = page.waitForResponse((r) => r.url().includes("/api/kids/maya/progress") && r.request().method() === "PUT");
  await page.getByRole("button", { name: "Next" }).click();
  await saved;
  await page.getByRole("button", { name: "Read along" }).click();
  await expect(player).toHaveAttribute("data-mode", "read");
  await expect(page.getByTestId("sentence-position")).toHaveText(/Sentence 3 of/);
  await expect(player.locator("[data-current]")).toBeVisible();
  await expect(page.getByTestId("current-narrator")).toHaveText("Mom");
  await noOverflow(page);
  await fitsOneScreen(page);
  await page.screenshot({ path: `e2e/screenshots/player-read-${info.project.name}.png` });

  // The sleep timer cycles off, 15, 30, 45 and off again.
  const sleep = page.getByRole("button", { name: /Sleep timer/ });
  await expect(sleep).toHaveAccessibleName("Sleep timer: Off");
  await sleep.click();
  await expect(sleep).toHaveAccessibleName("Sleep timer: 15m");

  // Read-along is remembered on this device, at the same place.
  await page.reload();
  await expect(player).toHaveAttribute("data-mode", "read");
  await expect(page.getByTestId("sentence-position")).toHaveText(/Sentence 3 of/);
  await page.getByRole("button", { name: "Just listen" }).first().click();
  await expect(player).toHaveAttribute("data-mode", "listen");

  // Dragging the time bar jumps to the sentence under it; End and Home do the same from the keyboard.
  const bar = page.getByRole("slider", { name: "Story time" });
  await bar.focus();
  await page.keyboard.press("End");
  await expect(page.getByTestId("sentence-position")).toHaveText(/Sentence (\d+) of \1$/);
  await page.keyboard.press("Home");
  await expect(page.getByTestId("sentence-position")).toHaveText(/Sentence 1 of/);
  await expect(page.getByTestId("player-page")).toHaveText(/Page 1 of/);
  // Only a story with some listening in it waits in Continue listening.
  const moved = page.waitForResponse((r) => r.url().includes("/api/kids/maya/progress") && r.request().method() === "PUT" && r.request().postDataJSON().sentence === 1);
  await page.getByRole("button", { name: "Next" }).click();
  await moved;

  // Back on the bookshelf, the story waits in Continue listening.
  await page.getByRole("link", { name: "My stories" }).click();
  const resume = page.getByTestId("kids-continue");
  await expect(resume).toContainText("The Lion and the Mouse");
  await expect(resume).toContainText(/Mom is reading · page 1 of \d+/);
});

test("a prepared chapter plays as one track, follows the voice sentence by sentence, and switches storyteller in place", async ({ page }) => {
  await signIn(page, "adult:sara");
  await signIn(page, "child:maya");
  await page.goto("/kids/listen/the-lion-and-the-mouse");
  const player = page.getByTestId("kids-player");
  await page.getByRole("button", { name: "Read along" }).click();
  const sentences: unknown[] = [];
  page.on("request", (r) => {
    if (r.url().endsWith("/api/kids/narrations") && r.method() === "POST") sentences.push(r.postDataJSON());
  });
  const first = page.waitForResponse((r) => r.url().endsWith("/api/kids/narrations/track"));
  await page.getByRole("button", { name: "Play" }).click();
  const track = await first;
  expect(track.status()).toBe(200);
  expect(track.request().postDataJSON()).toMatchObject({ childId: "maya", voiceId: "voice-sara", chapter: 1 });
  const timing = (await track.json()) as { sentences: { index: number; startMs: number }[] };
  expect(timing.sentences[0]).toMatchObject({ index: 0, startMs: 0 });
  // The highlight moves on with the recording; nothing is asked for sentence by sentence.
  await expect(page.getByTestId("sentence-position")).toHaveText(/Sentence 2 of/, { timeout: 15_000 });
  await expect(player.locator("[data-current]")).toBeVisible();
  expect(sentences).toEqual([]);

  // Switching storyteller loads Grandma June's track at the same sentence.
  const at = (await page.getByTestId("sentence-position").textContent())!;
  const june = page.waitForResponse((r) => r.url().endsWith("/api/kids/narrations/track") && r.request().postDataJSON().voiceId === "voice-june");
  await page.getByRole("button", { name: /Change storyteller/ }).click();
  await page.getByRole("group", { name: "Choose a storyteller" }).getByRole("button", { name: /Grandma June/ }).click();
  expect((await june).status()).toBe(200);
  await expect(page.getByTestId("current-narrator")).toHaveText("Grandma June");
  expect(Number(/Sentence (\d+)/.exec((await page.getByTestId("sentence-position").textContent())!)![1])).toBeGreaterThanOrEqual(Number(/Sentence (\d+)/.exec(at)![1]));
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
});

test("a place that couldn't be saved is kept on the device and sent when the player opens again", async ({ page }) => {
  await signIn(page, "adult:sara");
  await signIn(page, "child:maya");
  await page.goto("/kids/listen/the-lion-and-the-mouse");
  await page.waitForLoadState("networkidle");
  // The connection drops: saves don't get through.
  await page.route("**/api/kids/maya/progress", (route) => route.abort());
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByTestId("sentence-position")).toHaveText(/Sentence 4 of/);
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("readli-place:maya:the-lion-and-the-mouse"))).toContain('"sentence":3');

  // Back online: opening the book sends the kept place first, and the story picks up there.
  await page.unroute("**/api/kids/maya/progress");
  const sent = page.waitForResponse((r) => r.url().endsWith("/api/kids/maya/progress") && r.request().postDataJSON().sentence === 3);
  await page.reload();
  expect(await (await sent).json()).toMatchObject({ saved: true });
  await expect(page.getByTestId("sentence-position")).toHaveText(/Sentence 4 of/);
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("readli-place:maya:the-lion-and-the-mouse"))).toBeNull();
});

/** Keeps every audio element and lock-screen button handler the page makes, so a test can act as the phone. */
async function watchAudio(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __audio: HTMLAudioElement[]; __media: Record<string, ((d: object) => void) | null> };
    w.__audio = [];
    w.__media = {};
    const Real = window.Audio;
    window.Audio = function (src?: string) {
      const a = new Real(src);
      w.__audio.push(a);
      return a;
    } as unknown as typeof Audio;
    const set = navigator.mediaSession.setActionHandler.bind(navigator.mediaSession);
    navigator.mediaSession.setActionHandler = (action, handler) => {
      w.__media[action] = handler as ((d: object) => void) | null;
      set(action, handler);
    };
  });
}

test("the lock screen shows the story and works it, and a phone call pauses it until Play", async ({ page }) => {
  await watchAudio(page);
  await signIn(page, "adult:sara");
  await signIn(page, "child:maya");
  await page.goto("/kids/listen/the-lion-and-the-mouse");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Play" }).click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  const session = () => page.evaluate(() => ({ title: navigator.mediaSession.metadata?.title, artist: navigator.mediaSession.metadata?.artist, state: navigator.mediaSession.playbackState }));
  await expect.poll(session).toEqual({ title: "The Lion and the Mouse", artist: "Read by Mom", state: "playing" });

  // A call comes in: the phone pauses the audio, and the screen says so instead of showing Pause.
  await page.waitForTimeout(1200);
  await page.evaluate(() => (window as unknown as { __audio: HTMLAudioElement[] }).__audio.filter((a) => !a.paused).forEach((a) => a.pause()));
  await expect(page.getByText("Story time paused. Press Play to keep listening.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
  await expect.poll(session).toMatchObject({ state: "paused" });
  const at = (await page.getByTestId("sentence-position").textContent())!;

  // Play on the lock screen picks up at the same sentence; next goes on a sentence.
  await page.evaluate(() => (window as unknown as { __media: Record<string, (d: object) => void> }).__media.play!({ action: "play" }));
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  await expect(page.getByTestId("sentence-position")).toHaveText(at);
  const n = Number(/Sentence (\d+)/.exec(at)![1]);
  await page.evaluate(() => (window as unknown as { __media: Record<string, (d: object) => void> }).__media.nexttrack!({ action: "nexttrack" }));
  await expect(page.getByTestId("sentence-position")).toHaveText(new RegExp(`Sentence (${n + 1}|${n + 2}) of`));
  await page.evaluate(() => (window as unknown as { __media: Record<string, (d: object) => void> }).__media.pause!({ action: "pause" }));
  await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
});

test("the sleep timer is a deadline kept across a reload, and stops the story when it passes", async ({ page }) => {
  await signIn(page, "adult:sara");
  await signIn(page, "child:maya");
  await page.goto("/kids/listen/the-lion-and-the-mouse");
  await page.waitForLoadState("networkidle");
  const sleep = page.getByRole("button", { name: /Sleep timer/ });
  await sleep.click();
  await expect(sleep).toHaveAccessibleName("Sleep timer: 15m");
  await page.reload();
  await expect(sleep).toHaveAccessibleName("Sleep timer: 15m");

  // The deadline comes due two seconds from now, while the story plays.
  await page.evaluate(() => window.localStorage.setItem("readli-sleep:maya", JSON.stringify({ minutes: 15, until: Date.now() + 2000 })));
  await page.reload();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Play" }).click();
  await expect(page.getByText("The sleep timer paused the story. Night night!")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
  await expect(sleep).toHaveAccessibleName("Sleep timer: Off");
  expect(await page.evaluate(() => window.localStorage.getItem("readli-sleep:maya"))).toBeNull();
});

test("every read-along page fits its card without scrolling", async ({ page }, info) => {
  await signIn(page, "adult:sara");
  await signIn(page, "child:maya");
  await page.goto("/kids/listen/the-tale-of-peter-rabbit");
  await page.getByRole("button", { name: "Read along" }).click();
  const card = page.getByTestId("read-page");
  const next = page.getByRole("button", { name: "Next" });
  for (let step = 0; step < 40 && (await next.isEnabled()); step++) {
    await expect(page.locator("[data-current]")).toBeVisible();
    await expect.poll(() => card.evaluate((el) => el.scrollHeight - el.clientHeight), { message: `sentence ${step + 1}` }).toBeLessThanOrEqual(0);
    await next.click();
  }
  await noOverflow(page);
  await page.screenshot({ path: `e2e/screenshots/player-read-fit-${info.project.name}.png` });
});
