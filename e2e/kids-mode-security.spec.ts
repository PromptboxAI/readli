import { expect, test } from "@playwright/test";

/**
 * A device in Kids Mode (the kids-profile cookie is set) can reach only the child's side, whatever it
 * sends. The cookie value doesn't matter here: its presence alone takes access away.
 */
test.describe("Kids Mode on a device", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await context.addCookies([{ name: "readli_kids_profile", value: "user~kid.sig", url: baseURL! }]);
  });

  const blocked: [string, string][] = [
    ["POST", "/api/voice"],
    ["DELETE", "/api/voice"],
    ["GET", "/api/voice"],
    ["POST", "/api/voice/sample"],
    ["DELETE", "/api/account"],
    ["GET", "/api/account/export"],
    ["POST", "/api/billing/checkout"],
    ["POST", "/api/billing/portal"],
    ["POST", "/api/family/narration-credits"],
    ["POST", "/api/family/books/the-tale-of-peter-rabbit/narration"],
    ["PUT", "/api/family/voices/voice-1/share"],
    ["PUT", "/api/family/kids/maya/storytellers"],
    ["POST", "/api/family/children"],
    ["POST", "/api/family/narrators/slots"],
    ["POST", "/api/gifts/redeem"],
    ["POST", "/api/invites"],
    ["POST", "/api/invites/accept"],
    ["POST", "/api/guest/clone"],
  ];
  for (const [method, path] of blocked) {
    test(`refuses ${method} ${path}`, async ({ page }) => {
      const res = await page.request.fetch(path, { method, data: {} });
      expect(res.status()).toBe(403);
      expect((await res.json()).error.code).toBe("kids_mode");
    });
  }

  test("sends grown-up pages back to the bookshelf", async ({ page }) => {
    for (const path of ["/family/billing", "/family/my-voice", "/voice/record", "/admin", "/try"]) {
      await page.goto(path);
      await expect(page, path).toHaveURL(/\/kids$/);
    }
  });

  test("still reaches the child's own routes and the way out", async ({ page }) => {
    const kids = await page.request.get("/api/kids/maya/narrators");
    expect(kids.status()).not.toBe(403);
    const leave = await page.request.delete("/api/family/session");
    expect(leave.status()).toBe(200);
  });
});

test("deleting a voice is paused for everyone until finished stories are kept", async ({ request }) => {
  const res = await request.delete("/api/voice");
  expect(res.status()).toBe(409);
  expect((await res.json()).error.code).toBe("deletion_paused");
});
