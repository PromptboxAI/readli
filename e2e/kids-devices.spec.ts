import { expect, test, type BrowserContext, type Page } from "@playwright/test";

/**
 * Readli Kids devices against the preview family: a parent sets up a device for chosen kids, the
 * device holds no grown-up sign-in, kids pick who's listening, and a revoked device or the PIN ends it.
 */

const PIN = "4821";

async function parentSetsUpDevice(page: Page, context: BrowserContext) {
  expect((await page.request.post("/api/family/session", { data: { as: "adult:sara" } })).status()).toBe(200);
  expect((await page.request.put("/api/family/kids-pin", { data: { pin: PIN } })).status()).toBe(200);
  // The parent's own sign-in, as it would stay on their phone.
  const parentCookies = await context.cookies();
  const res = await page.request.post("/api/family/devices", { data: { childIds: ["maya", "leo"], label: "Family iPad" } });
  expect(res.status()).toBe(200);
  const { deviceId } = (await res.json()) as { deviceId: string };
  return { deviceId, parentCookies };
}

test("a set-up device holds no grown-up sign-in and kids pick who's listening", async ({ page, context }) => {
  await parentSetsUpDevice(page, context);
  const names = (await context.cookies()).map((c) => c.name);
  expect(names).toContain("readli_kids_profile");
  expect(names).not.toContain("readli_family_demo");

  await page.goto("/kids");
  await expect(page.getByRole("heading", { name: "Who's listening?" })).toBeVisible();
  // The header has no account menu, sign-in or sign-up on a kids device.
  await expect(page.getByRole("link", { name: "Try It Free" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Log in" })).toHaveCount(0);
  // Nobody is listening yet, so no bookshelf answers.
  expect((await page.request.get("/api/kids/maya/narrators")).status()).toBe(403);
  await page.getByTestId("listener-picker").getByRole("button", { name: "Maya" }).click();
  await expect(page.getByRole("heading", { name: "Hi Maya! Pick a story." })).toBeVisible();
  expect((await page.request.get("/api/kids/maya/narrators")).status()).toBe(200);
  expect((await page.request.get("/api/kids/leo/narrators")).status()).toBe(403);

  // Only kids the parent put on this device.
  const outsider = await page.request.post("/api/kids/device/listener", { data: { childId: "someone-else" } });
  expect(outsider.status()).toBe(403);

  await page.getByRole("button", { name: "Switch listener" }).click();
  await page.getByTestId("listener-picker").getByRole("button", { name: "Leo" }).click();
  await expect(page.getByRole("heading", { name: "Hi Leo! Pick a story." })).toBeVisible();
});

test("a kids device can't reach the grown-up side or leave without the PIN", async ({ page, context }) => {
  await parentSetsUpDevice(page, context);
  const grownUp: [string, string][] = [
    ["GET", "/api/family/devices"],
    ["PUT", "/api/family/kids-pin"],
    ["DELETE", "/api/family/devices/anything"],
    ["GET", "/api/family/children"],
  ];
  for (const [method, path] of grownUp) {
    const res = await page.request.fetch(path, { method, data: { pin: "0000" } });
    expect(res.status(), `${method} ${path}`).toBe(403);
  }
  const signOut = await page.request.delete("/api/family/session");
  expect(signOut.status()).toBe(403);
  expect((await signOut.json()).error.code).toBe("pin_required");
  expect((await page.request.post("/api/family/session", { data: { as: "child:leo" } })).status()).toBe(403);
  await page.goto("/family/settings/kids-mode");
  await expect(page).toHaveURL(/\/kids$/);

  const wrong = await page.request.post("/api/kids/device/exit", { data: { pin: "0000" } });
  expect(wrong.status()).toBe(403);
  expect((await wrong.json()).error.code).toBe("wrong_pin");
  await page.goto("/kids");
  await expect(page.getByRole("heading", { name: "Who's listening?" })).toBeVisible();
});

test("five wrong PINs lock the device, even against the right PIN", async ({ page, context }) => {
  await parentSetsUpDevice(page, context);
  for (let i = 0; i < 4; i++) expect((await page.request.post("/api/kids/device/exit", { data: { pin: "1111" } })).status()).toBe(403);
  const locked = await page.request.post("/api/kids/device/exit", { data: { pin: "1111" } });
  expect(locked.status()).toBe(429);
  const right = await page.request.post("/api/kids/device/exit", { data: { pin: PIN } });
  expect(right.status()).toBe(429);
  expect((await right.json()).error.code).toBe("pin_locked");
});

test("the right PIN ends Readli Kids on the device, and its old key stops working", async ({ page, context }) => {
  await parentSetsUpDevice(page, context);
  await page.request.post("/api/kids/device/listener", { data: { childId: "maya" } });
  const oldKey = (await context.cookies()).find((c) => c.name === "readli_kids_profile")!;
  await page.goto("/kids");
  await page.getByRole("button", { name: "Grown-ups" }).click();
  await page.getByTestId("grown-up-pin").getByLabel("PIN").fill(PIN);
  await page.getByRole("button", { name: "Leave Readli Kids" }).click();
  await expect(page).toHaveURL(/\/login/);
  expect((await context.cookies()).map((c) => c.name)).not.toContain("readli_kids_profile");

  await context.addCookies([oldKey]);
  expect((await page.request.get("/api/kids/maya/narrators")).status()).toBe(401);
});

test("a parent sees and revokes a device, and it loses access on its next request", async ({ page, context, browser }) => {
  const { deviceId, parentCookies } = await parentSetsUpDevice(page, context);
  await page.request.post("/api/kids/device/listener", { data: { childId: "maya" } });
  expect((await page.request.get("/api/kids/maya/narrators")).status()).toBe(200);

  const phone = await browser.newContext();
  await phone.addCookies(parentCookies);
  const parent = await phone.newPage();
  await parent.goto("/family/settings/kids-mode");
  const card = parent.getByTestId(`device-${deviceId}`);
  await expect(card).toContainText("Family iPad");
  await expect(card).toContainText("Maya, Leo");
  await expect(card).toContainText("Active");
  parent.once("dialog", (d) => d.accept());
  await card.getByRole("button", { name: "End device" }).click();
  await expect(card).toContainText("Ended");

  expect((await page.request.get("/api/kids/maya/narrators")).status()).toBe(401);
  await page.goto("/kids");
  await expect(page.getByText("Readli Kids has ended on this browser.")).toBeVisible();
  await phone.close();
});

test("Readli Kids saves to the home screen as an app that opens on the bookshelf", async ({ page, context }) => {
  await parentSetsUpDevice(page, context);
  await page.goto("/");
  await expect(page).toHaveURL(/\/kids$/);
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(href).toBe("/kids/app.webmanifest");
  const manifest = await (await page.request.get(href!)).json();
  expect(manifest).toMatchObject({ name: "Readli Kids", start_url: "/kids", scope: "/kids", display: "standalone" });
});

test("Back on a kids profile stays on the kids bookshelf instead of returning to parent pages", async ({ page }) => {
  expect((await page.request.post("/api/family/session", { data: { as: "adult:sara" } })).status()).toBe(200);
  await page.goto("/family/kids");
  await page.goto("/family");
  await page.getByRole("button", { name: "Open Maya's Readli Kids" }).click();
  await expect(page.getByRole("heading", { name: "Hi Maya! Pick a story." })).toBeVisible();
  // Opening the profile replaced /family in history; Back reaches the earlier parent page, which sends the device to its bookshelf.
  await page.goBack();
  await expect(page).toHaveURL(/\/kids$/);
  await expect(page.getByRole("heading", { name: "Hi Maya! Pick a story." })).toBeVisible();
});

test("opening a child's Readli Kids is temporary Kids Mode on this browser, not a kids device", async ({ page, context, browser }) => {
  expect((await page.request.post("/api/family/session", { data: { as: "adult:sara" } })).status()).toBe(200);
  // The same grown-up on their phone, signed in with the same family.
  const phone = await browser.newContext();
  await phone.addCookies(await context.cookies());
  await page.goto("/family");
  await page.getByRole("button", { name: "Open Maya's Readli Kids" }).click();
  await expect(page.getByRole("heading", { name: "Hi Maya! Pick a story." })).toBeVisible();
  const pass = (await context.cookies()).find((c) => c.name === "readli_kids_profile");
  expect(pass?.value.startsWith("t1~")).toBe(true);
  expect((await context.cookies()).map((c) => c.name)).not.toContain("readli_family_demo");

  // Restricted to this child on the server: other kids and grown-up pages and APIs are out of reach.
  expect((await page.request.get("/api/kids/maya/narrators")).status()).toBe(200);
  expect((await page.request.get("/api/kids/leo/narrators")).status()).toBe(403);
  expect((await page.request.get("/api/family/devices")).status()).toBe(403);
  for (const as of ["adult:sara", "adult:ben", "child:leo"]) {
    expect((await page.request.post("/api/family/session", { data: { as } })).status(), as).toBe(403);
  }
  expect((await context.cookies()).find((c) => c.name === "readli_kids_profile")?.value).toBe(pass?.value);

  // Direct URLs, refresh and Back all stay on Maya's bookshelf.
  await page.goto("/family/billing");
  await expect(page).toHaveURL(/\/kids$/);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Hi Maya! Pick a story." })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/kids$/);
  await expect(page.getByRole("heading", { name: "Hi Maya! Pick a story." })).toBeVisible();

  // The phone is still signed in, and nothing was registered as a kids device.
  const devices = await phone.request.get("/api/family/devices");
  expect(devices.status()).toBe(200);
  expect(((await devices.json()) as { devices: { label: string }[] }).devices.map((d) => d.label)).not.toContain("This device");
  await phone.close();

  // A clearly labelled way out for a grown-up. The preview has no sign-in, so it starts a fresh preview.
  await page.getByRole("button", { name: "Grown-ups", exact: true }).click();
  await page.getByTestId("temporary-kids-exit").getByRole("button", { name: "Grown-ups: start the preview over" }).click();
  await expect(page).toHaveURL(/\/family$/);
  expect((await context.cookies()).map((c) => c.name)).not.toContain("readli_kids_profile");
});

test("a grown-up leaves temporary Kids Mode with the family PIN and is back in the same family", async ({ page, context }) => {
  expect((await page.request.post("/api/family/session", { data: { as: "adult:sara" } })).status()).toBe(200);
  // Something the family changed before Kids Mode, to show the same family comes back.
  expect((await page.request.post("/api/family/children", { data: { nickname: "Ava" } })).status()).toBe(200);
  // The preview's device registry is shared by every test, so another test may have set the PIN
  // already. When it hasn't, the family home asks for one right above the kids.
  await page.goto("/family");
  const setPin = page.getByTestId("set-kids-pin");
  if (await setPin.isVisible()) {
    await setPin.getByLabel("New PIN").fill(PIN);
    await setPin.getByRole("button", { name: "Save PIN" }).click();
    await expect(setPin).toContainText("PIN saved");
  } else {
    expect((await page.request.put("/api/family/kids-pin", { data: { pin: PIN } })).status()).toBe(200);
  }
  await page.getByRole("button", { name: "Open Maya's Readli Kids" }).click();
  await expect(page.getByRole("heading", { name: "Hi Maya! Pick a story." })).toBeVisible();
  // The grown-up's sign-in is set aside in a cookie the page can't read.
  const stash = (await context.cookies()).find((c) => c.name === "readli_grownup");
  expect(stash?.httpOnly).toBe(true);

  await page.getByRole("button", { name: "Grown-ups", exact: true }).click();
  const exit = page.getByTestId("temporary-kids-exit");
  await exit.getByLabel("Family PIN").fill("1111");
  await exit.getByRole("button", { name: "Back to Readli Family" }).click();
  await expect(exit.getByRole("alert")).toHaveText("That PIN isn't right.");
  await expect(page).toHaveURL(/\/kids$/);

  await exit.getByLabel("Family PIN").fill(PIN);
  await exit.getByRole("button", { name: "Back to Readli Family" }).click();
  await expect(page).toHaveURL(/\/family$/);
  expect((await context.cookies()).map((c) => c.name)).not.toContain("readli_kids_profile");
  expect((await context.cookies()).map((c) => c.name)).not.toContain("readli_grownup");
  await page.goto("/family/kids");
  await expect(page.getByTestId("profiles-count")).toHaveText("3 of 6 profiles");
});

test("a Kids Mode page left open after Kids Mode ended takes the grown-up home instead of a dead end", async ({ page, context }) => {
  expect((await page.request.post("/api/family/session", { data: { as: "adult:sara" } })).status()).toBe(200);
  expect((await page.request.put("/api/family/kids-pin", { data: { pin: PIN } })).status()).toBe(200);
  await page.goto("/family");
  await page.getByRole("button", { name: "Open Maya's Readli Kids" }).click();
  await expect(page.getByRole("heading", { name: "Hi Maya! Pick a story." })).toBeVisible();
  await page.getByRole("button", { name: "Grown-ups", exact: true }).click();
  // Kids Mode ends while this page stays open (left with the PIN in another tab, or a grown-up signed in).
  await context.clearCookies({ name: "readli_kids_profile" });
  const exit = page.getByTestId("temporary-kids-exit");
  await exit.getByLabel("Family PIN").fill(PIN);
  await exit.getByRole("button", { name: "Back to Readli Family" }).click();
  await expect(page).not.toHaveURL(/\/kids$/);
  await expect(page.getByText("This browser isn't in temporary Kids Mode.")).toHaveCount(0);
});

test("the Kids Mode PIN locks after five wrong tries, and nothing else gets a grown-up back", async ({ page, context }) => {
  expect((await page.request.post("/api/family/session", { data: { as: "adult:sara" } })).status()).toBe(200);
  expect((await page.request.put("/api/family/kids-pin", { data: { pin: PIN } })).status()).toBe(200);
  expect((await page.request.post("/api/family/session", { data: { as: "child:maya" } })).status()).toBe(200);
  const exit = (pin: string) => page.request.post("/api/kids/temporary/exit", { data: { pin } });
  for (let i = 0; i < 4; i++) expect((await exit("0000")).status()).toBe(403);
  expect((await exit("0000")).status()).toBe(429);
  // Locked: even the right PIN waits.
  expect((await exit(PIN)).status()).toBe(429);
  expect((await page.request.get("/api/family/devices")).status()).toBe(403);

  // Without the set-aside sign-in there is nothing to bring back: a grown-up signs in instead.
  await context.clearCookies({ name: "readli_grownup" });
  const res = await exit(PIN);
  expect(res.status()).toBe(409);
  expect((await res.json()).error.code).toBe("sign_in_required");
});

test("signing out from a kids browser doesn't leave Kids Mode", async ({ page, context }) => {
  await parentSetsUpDevice(page, context);
  const key = (await context.cookies()).find((c) => c.name === "readli_kids_profile")!.value;
  const res = await page.request.post("/auth/signout", { maxRedirects: 0 });
  expect(res.status()).toBe(303);
  expect(res.headers()["location"]).toMatch(/\/kids$/);
  expect((await context.cookies()).find((c) => c.name === "readli_kids_profile")?.value).toBe(key);
});

test("a kids device can't switch to a grown-up through the session route", async ({ page, context }) => {
  await parentSetsUpDevice(page, context);
  const res = await page.request.post("/api/family/session", { data: { as: "adult:sara" } });
  expect(res.status()).toBe(403);
  expect((await res.json()).error.code).toBe("kids_mode");
  await page.goto("/family");
  await expect(page).toHaveURL(/\/kids$/);
  // A story link with nobody picked goes to "Who's listening?", never to a grown-up page.
  await page.goto("/kids/listen/the-lion-and-the-mouse");
  await expect(page).toHaveURL(/\/kids$/);
  await expect(page.getByRole("heading", { name: "Who's listening?" })).toBeVisible();
});
