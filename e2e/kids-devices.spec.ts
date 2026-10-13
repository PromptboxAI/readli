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
  await page.goto("/family/devices");
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
  await parent.goto("/family/devices");
  const card = parent.getByTestId(`device-${deviceId}`);
  await expect(card).toContainText("Family iPad");
  await expect(card).toContainText("Maya, Leo");
  await expect(card).toContainText("Active");
  parent.once("dialog", (d) => d.accept());
  await card.getByRole("button", { name: "End device" }).click();
  await expect(card).toContainText("Ended");

  expect((await page.request.get("/api/kids/maya/narrators")).status()).toBe(401);
  await page.goto("/kids");
  await expect(page.getByText("Readli Kids has ended on this device.")).toBeVisible();
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
