import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { adsOptedOut, loadPixel, newMetaEventId, pixelAllowed, setAdsOptOut, syncAdsOptOut, trackMetaCustom, pixelEnabled, rememberCheckout, takeCheckout, trackMeta } from "./meta-pixel";

describe("Meta Pixel pages", () => {
  it("runs on the public grown-up pages", () => {
    for (const p of ["/", "/try", "/pricing", "/books", "/books/peter-rabbit", "/help/recording-tips", "/signup", "/signup/family", "/signup/voice", "/gift", "/grandparents", "/family/settings/plan"]) {
      expect(pixelAllowed(p), p).toBe(true);
    }
  });

  it("never runs in Readli Kids, the parent portal, admin, invitations, sign-in or legal pages", () => {
    for (const p of ["/kids", "/kids/listen/peter-rabbit", "/family", "/family/kids", "/family/settings/planx", "/admin", "/login", "/auth/callback", "/invite/abc", "/v/abc", "/voice/join", "/gift/open", "/privacy", "/terms", "/accessibility", "/trying"]) expect(pixelAllowed(p), p).toBe(false);
  });

  it("is production only", () => {
    expect(pixelEnabled({ VERCEL_ENV: "production" })).toBe(true);
    expect(pixelEnabled({ VERCEL_ENV: "preview" })).toBe(false);
    expect(pixelEnabled({ NODE_ENV: "production" })).toBe(false);
    expect(pixelEnabled({ VERCEL_ENV: "preview", META_TEST: "1" })).toBe(true);
  });
});

describe("trackMeta", () => {
  const fakeWindow = (path: string, gpc = false) => {
    const doc = document.implementation.createHTMLDocument();
    return { location: { pathname: path }, document: doc, navigator: { globalPrivacyControl: gpc } } as unknown as Window & { fbq?: { queue: unknown[][] } };
  };
  beforeEach(() => vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", "production"));
  afterEach(() => vi.unstubAllEnvs());

  it("loads Meta's script once, without history or automatic tracking, and queues the event", () => {
    const w = fakeWindow("/try");
    trackMeta("Lead", { content_name: "Voice demo" }, "lead-1234", w as never);
    trackMeta("PageView", undefined, undefined, w as never);
    trackMetaCustom("SignupStarted", { content_name: "Readli Family" }, w as never);
    expect(w.document.querySelectorAll('script[src="https://connect.facebook.net/en_US/fbevents.js"]')).toHaveLength(1);
    expect(w.fbq!.queue.map((a) => Array.from(a as ArrayLike<unknown>))).toEqual([
      ["set", "autoConfig", false, "28060840410257774"],
      ["init", "28060840410257774"],
      ["track", "Lead", { content_name: "Voice demo" }, { eventID: "lead-1234" }],
      ["track", "PageView"],
      ["trackCustom", "SignupStarted", { content_name: "Readli Family" }],
    ]);
    expect((w.fbq as unknown as { disablePushState: boolean }).disablePushState).toBe(true);
  });

  it("does nothing in Readli Kids or with Global Privacy Control", () => {
    for (const w of [fakeWindow("/kids"), fakeWindow("/family"), fakeWindow("/try", true)]) {
      trackMeta("PageView", undefined, undefined, w as never);
      expect(newMetaEventId(w as never)).toBeNull();
      expect(w.fbq).toBeUndefined();
      expect(w.document.querySelector("script")).toBeNull();
    }
  });

  it("does nothing on previews", () => {
    vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", "preview");
    const w = fakeWindow("/try");
    expect(loadPixel(w as never)).toBe(false);
    expect(w.fbq).toBeUndefined();
  });
});

describe("Do Not Sell or Share", () => {
  beforeEach(() => vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", "production"));
  afterEach(() => {
    vi.unstubAllEnvs();
    localStorage.clear();
  });

  it("stops the pixel on this browser, tells the server by cookie, and can be undone", () => {
    setAdsOptOut(true);
    expect(adsOptedOut()).toBe(true);
    expect(document.cookie).toContain("readli_ads_opt_out=1");
    expect(loadPixel()).toBe(false);
    setAdsOptOut(false);
    expect(adsOptedOut()).toBe(false);
    expect(document.cookie).not.toContain("readli_ads_opt_out=1");
  });

  it("gives an opt-out saved before the cookie existed its cookie", () => {
    localStorage.setItem("readli_ads_opt_out", "1");
    syncAdsOptOut();
    expect(document.cookie).toContain("readli_ads_opt_out=1");
    setAdsOptOut(false);
  });

  it("revokes consent on a pixel that already loaded", () => {
    const fbq = vi.fn();
    const w = { localStorage, navigator: {}, fbq } as never;
    setAdsOptOut(true, w);
    expect(fbq).toHaveBeenCalledWith("consent", "revoke");
  });
});

describe("checkout value", () => {
  it("is reported once per checkout", () => {
    rememberCheckout(1299);
    expect(takeCheckout()).toBe(1299);
    expect(takeCheckout()).toBeNull();
  });
});
