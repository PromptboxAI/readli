import { describe, expect, it } from "vitest";
import { bannerFromRow, bannerLive, dayStart, messageParts, parseBannerForm, plainMessage, readliDay, safeBannerLink, type SiteBanner } from "./site-banner";

const form = (fields: Record<string, string>) => ({ get: (k: string) => fields[k] ?? null });
const banner = (over: Partial<SiteBanner> = {}): SiteBanner => ({ enabled: true, message: "Hello", linkText: "", linkUrl: "", style: "festive", startsAt: null, endsAt: null, updatedAt: null, ...over });

describe("site banner", () => {
  it("only accepts Readli paths and https links", () => {
    expect(safeBannerLink("/gifts")).toBe("/gifts");
    expect(safeBannerLink("https://example.com/x")).toBe("https://example.com/x");
    expect(safeBannerLink("//evil.com")).toBeNull();
    expect(safeBannerLink("javascript:alert(1)")).toBeNull();
    expect(safeBannerLink("http://example.com")).toBeNull();
  });

  it("is live only when on, with a message, inside its dates", () => {
    const now = new Date("2026-12-01T12:00:00Z");
    expect(bannerLive(banner(), now)).toBe(true);
    expect(bannerLive(banner({ enabled: false }), now)).toBe(false);
    expect(bannerLive(banner({ message: "  " }), now)).toBe(false);
    expect(bannerLive(banner({ startsAt: "2026-12-02T05:00:00Z" }), now)).toBe(false);
    expect(bannerLive(banner({ endsAt: "2026-12-01T05:00:00Z" }), now)).toBe(false);
    expect(bannerLive(banner({ startsAt: "2026-11-01T04:00:00Z", endsAt: "2026-12-26T05:00:00Z" }), now)).toBe(true);
  });

  it("reads days in New York time, across daylight saving", () => {
    expect(dayStart("2026-12-25")).toBe("2026-12-25T05:00:00.000Z");
    expect(dayStart("2026-07-04")).toBe("2026-07-04T04:00:00.000Z");
    expect(dayStart("nope")).toBeNull();
    expect(readliDay("2026-12-25T05:00:00.000Z")).toBe("2026-12-25");
    expect(readliDay(null)).toBe("");
  });

  it("saves the last day as running through to the next midnight", () => {
    const r = parseBannerForm(form({ enabled: "on", message: "Giving Readli  this Christmas?", link_text: "See Readli gifts", link_url: "/gifts", starts_on: "2026-11-15", ends_on: "2026-12-25" }));
    expect(r).toEqual({
      ok: true,
      row: { id: true, enabled: true, message: "Giving Readli this Christmas?", link_text: "See Readli gifts", link_url: "/gifts", style: "festive", starts_at: "2026-11-15T05:00:00.000Z", ends_at: "2026-12-26T05:00:00.000Z" },
    });
  });

  it("explains what's wrong with a bad form", () => {
    expect(parseBannerForm(form({ enabled: "on" }))).toMatchObject({ ok: false });
    expect(parseBannerForm(form({ message: "Hi", link_text: "Go" }))).toMatchObject({ ok: false });
    expect(parseBannerForm(form({ message: "Hi", link_text: "Go", link_url: "javascript:x" }))).toMatchObject({ ok: false });
    expect(parseBannerForm(form({ message: "Hi", starts_on: "2026-12-10", ends_on: "2026-12-01" }))).toMatchObject({ ok: false });
    expect(parseBannerForm(form({ message: "Hi" }))).toMatchObject({ ok: true, row: { enabled: false, starts_at: null, ends_at: null } });
  });

  it("treats a missing row as off", () => {
    expect(bannerFromRow(null).enabled).toBe(false);
    expect(bannerFromRow({ enabled: true, message: "x", link_text: null, ends_at: "2026-12-26T05:00:00Z" })).toMatchObject({ enabled: true, linkText: "", endsAt: "2026-12-26T05:00:00Z" });
  });

  it("highlights words wrapped in asterisks", () => {
    expect(messageParts("Save *20% off* now")).toEqual([
      { text: "Save ", highlight: false },
      { text: "20% off", highlight: true },
      { text: " now", highlight: false },
    ]);
    expect(messageParts("5 * 3 = 15")).toEqual([{ text: "5 * 3 = 15", highlight: false }]);
    expect(plainMessage("A *b* c **")).toBe("A b c **");
  });

  it("reads and saves the look, falling back to festive", () => {
    expect(bannerFromRow({ enabled: true, message: "Hi" }).style).toBe("festive");
    expect(bannerFromRow({ style: "starry" }).style).toBe("starry");
    expect(bannerFromRow({ style: "neon" }).style).toBe("festive");
    const ok = parseBannerForm(form({ message: "Hi", style: "evergreen" }));
    expect(ok.ok && ok.row.style).toBe("evergreen");
    const bad = parseBannerForm(form({ message: "Hi", style: "neon" }));
    expect(bad.ok && bad.row.style).toBe("festive");
  });
});
