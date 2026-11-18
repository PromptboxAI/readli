import { describe, expect, it } from "vitest";
import { publicPages } from "@/lib/seo/pages";
import { COMPARISON_NAMES, COMPARISON_SLUGS, OTHER_OPTIONS, comparisonHref, comparisons, readliStrengths, type ReadliFacts } from "./comparisons";

const FACTS: ReadliFacts = { readyBooks: 77, monthly: "$19.99", annual: "$179.99", maxChildProfiles: 6, giftHouseholds: 2 };
const all = comparisons(FACTS);

describe("comparison pages", () => {
  it("has one page per listed slug, with matching names", () => {
    expect(all.map((c) => c.slug)).toEqual([...COMPARISON_SLUGS]);
    for (const c of all) expect(c.name).toBe(COMPARISON_NAMES[c.slug as keyof typeof COMPARISON_NAMES]);
  });

  it("answers pricing, voices and parent approval in every FAQ", () => {
    for (const c of all) {
      const text = c.faqs.map((f) => `${f.q} ${f.a}`).join(" ");
      expect(text).toContain("$19.99");
      expect(text).toMatch(/AI/);
      expect(text).toMatch(/parent or guardian approves/);
    }
  });

  it("never quotes another product's price, which can go stale; it links to their pricing instead", () => {
    for (const c of all) {
      for (const r of c.rows) expect(r.them).not.toMatch(/\$\d/);
      for (const f of c.faqs) expect(f.a.replace(/\$19\.99|\$179\.99/g, "")).not.toMatch(/\$\d/);
    }
    for (const o of OTHER_OPTIONS) expect(o.body).not.toMatch(/\$\d/);
  });

  it("says who the other product suits and cites sources", () => {
    for (const c of all) {
      expect(c.theyFit.length).toBeGreaterThan(0);
      expect(c.sources.length).toBeGreaterThan(0);
      for (const s of c.sources) expect(s.href).toMatch(/^https:\/\//);
    }
  });

  it("doesn't promise in-app voice deletion or encryption at rest", () => {
    const text = JSON.stringify([all, readliStrengths(FACTS), OTHER_OPTIONS]).toLowerCase();
    expect(text).not.toMatch(/at rest|delete your voice in the app|delete it yourself/);
  });

  it("doesn't offer Readli a free trial, which production doesn't run yet", () => {
    for (const c of all) {
      for (const r of c.rows) expect(r.readli.toLowerCase()).not.toContain("trial");
      for (const f of c.faqs) expect(f.a.toLowerCase()).not.toMatch(/readli[^.]*trial/);
    }
    for (const s of readliStrengths(FACTS)) expect(s.body.toLowerCase()).not.toContain("trial");
  });

  it("puts the hub and every comparison in the sitemap", () => {
    const paths = publicPages().map((p) => p.path);
    expect(paths).toContain("/vs");
    for (const slug of COMPARISON_SLUGS) expect(paths).toContain(comparisonHref(slug));
  });
});
