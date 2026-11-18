import { describe, expect, it } from "vitest";
import { acquisitionRow, channelFor, decodeFirstTouch, encodeFirstTouch, firstTouchFrom } from "./first-touch";

const now = new Date("2026-11-05T12:00:00Z");

describe("firstTouchFrom", () => {
  it("keeps campaign tags and the kind of click ID, never its value", () => {
    const t = firstTouchFrom(new URL("https://readli.ai/pricing?utm_source=Facebook&utm_medium=paid_social&utm_campaign=Grandparents%20Day&fbclid=SECRET123"), null, now);
    expect(t).toEqual({ source: "facebook", medium: "paid_social", campaign: "grandparents day", clickId: "fbclid", referrerHost: null, landingPath: "/pricing", at: now.toISOString() });
    expect(JSON.stringify(t)).not.toContain("SECRET");
  });

  it("keeps only the host of an outside referrer", () => {
    const t = firstTouchFrom(new URL("https://readli.ai/"), "https://www.google.com/search?q=bedtime+stories", now);
    expect(t?.referrerHost).toBe("google.com");
    expect(JSON.stringify(t)).not.toContain("bedtime");
  });

  it("ignores ordinary visits and clicks within the site", () => {
    expect(firstTouchFrom(new URL("https://readli.ai/books"), null, now)).toBeNull();
    expect(firstTouchFrom(new URL("https://readli.ai/books"), "https://readli.ai/", now)).toBeNull();
    expect(firstTouchFrom(new URL("https://www.readli.ai/books"), "https://www.readli.ai/pricing", now)).toBeNull();
  });
});

describe("cookie round trip", () => {
  it("decodes what it encodes", () => {
    const t = firstTouchFrom(new URL("https://readli.ai/try?utm_source=newsletter&gclid=x"), "https://news.example.com/a", now)!;
    expect(decodeFirstTouch(encodeFirstTouch(t))).toEqual(t);
  });

  it("re-cleans whatever the browser sends", () => {
    const raw = encodeURIComponent(JSON.stringify({ s: "<script>Evil</script>", k: "made_up", t: "not a date" }));
    expect(decodeFirstTouch(raw)).toMatchObject({ source: "scriptevil/script", clickId: null, at: null });
    expect(decodeFirstTouch("%%%")).toBeNull();
    expect(decodeFirstTouch(undefined)).toBeNull();
  });

  it("saves a family with no cookie as a direct visit", () => {
    expect(acquisitionRow("h1", null)).toEqual({ household_id: "h1", source: null, medium: null, campaign: null, click_id: null, referrer_host: null, landing_path: null, first_seen_at: null });
  });
});

describe("channelFor", () => {
  const base = { referred: false, invited: false, gifted: false };
  it("puts Readli's own records first", () => {
    expect(channelFor({ ...base, referred: true, acquisition: { click_id: "fbclid" } })).toBe("referral");
    expect(channelFor({ ...base, invited: true, acquisition: null })).toBe("storyteller_invite");
    expect(channelFor({ ...base, gifted: true, acquisition: null })).toBe("gift");
  });

  it("sorts the cookie into a channel", () => {
    expect(channelFor({ ...base, acquisition: { click_id: "gclid" } })).toBe("paid");
    expect(channelFor({ ...base, acquisition: { source: "facebook", medium: "cpc" } })).toBe("paid");
    expect(channelFor({ ...base, acquisition: { source: "newsletter" } })).toBe("campaign");
    expect(channelFor({ ...base, acquisition: { referrer_host: "google.com" } })).toBe("search");
    expect(channelFor({ ...base, acquisition: { referrer_host: "l.facebook.com" } })).toBe("social");
    expect(channelFor({ ...base, acquisition: { referrer_host: "t.co" } })).toBe("social");
    expect(channelFor({ ...base, acquisition: { referrer_host: "momblog.example" } })).toBe("other_site");
    expect(channelFor({ ...base, acquisition: {} })).toBe("direct");
    expect(channelFor({ ...base, acquisition: null })).toBe("unknown");
  });
});
