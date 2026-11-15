import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GA_MEASUREMENT_ID, stopGa, trackGaPageView } from "./google-analytics";

const fakeWindow = (path: string, gpc = false) => {
  const doc = document.implementation.createHTMLDocument();
  doc.title = "Readli";
  return {
    location: { pathname: path, origin: "https://readli.ai", search: "" },
    document: doc,
    navigator: { globalPrivacyControl: gpc },
    localStorage: { getItem: () => null },
  } as unknown as Window & { dataLayer?: IArguments[] } & Record<string, unknown>;
};
const calls = (w: { dataLayer?: IArguments[] }) => (w.dataLayer ?? []).map((a) => Array.from(a));
const disabled = `ga-disable-${GA_MEASUREMENT_ID}`;

describe("Google Analytics", () => {
  beforeEach(() => vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", "production"));
  afterEach(() => vi.unstubAllEnvs());

  it("loads gtag.js once on a public page, with signals off and one page view per page", () => {
    const w = fakeWindow("/pricing");
    expect(trackGaPageView(w as never)).toBe(true);
    (w.location as { pathname: string }).pathname = "/books";
    trackGaPageView(w as never);
    expect(w.document.querySelectorAll(`script[src="https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}"]`)).toHaveLength(1);
    const c = calls(w);
    expect(c[1]).toEqual(["config", GA_MEASUREMENT_ID, { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false }]);
    expect(c.filter((a) => a[1] === "page_view").map((a) => (a[2] as { page_location: string }).page_location)).toEqual(["https://readli.ai/pricing", "https://readli.ai/books"]);
    expect(w[disabled]).toBe(false);
  });

  it("switches itself off on moving into Readli Kids or the parent portal", () => {
    const w = fakeWindow("/");
    trackGaPageView(w as never);
    (w.location as { pathname: string }).pathname = "/kids";
    expect(trackGaPageView(w as never)).toBe(false);
    expect(w[disabled]).toBe(true);
    expect(calls(w).filter((a) => a[1] === "page_view")).toHaveLength(1);
  });

  it("never loads on private pages, previews, or with Global Privacy Control", () => {
    for (const w of [fakeWindow("/family"), fakeWindow("/invite/abc"), fakeWindow("/try", true)]) {
      expect(trackGaPageView(w as never)).toBe(false);
      expect(w.dataLayer).toBeUndefined();
    }
    vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", "preview");
    expect(trackGaPageView(fakeWindow("/") as never)).toBe(false);
  });

  it("stops at once on opt-out", () => {
    const w = fakeWindow("/");
    stopGa(w as never);
    expect(w[disabled]).toBe(true);
  });
});
