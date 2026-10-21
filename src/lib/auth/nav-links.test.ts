import { describe, expect, it } from "vitest";
import { accountBadge, accountLinks, familyAccess, primaryAction, type FamilyAccess, type NavState } from "./nav-links";

const AT = "2026-10-13T12:00:00.000Z";
const plan = (source: "subscription" | "gift" | "trial", over: Partial<{ status: "active" | "canceled"; startsAt: string; endsAt: string | null }> = {}) => ({
  source,
  status: "active" as const,
  startsAt: "2026-10-01T00:00:00.000Z",
  endsAt: null,
  ...over,
});
const adult = (family: FamilyAccess, trialOffered = false): Extract<NavState, { kind: "adult" }> => ({
  kind: "adult",
  name: "Sara Rivera",
  email: "sara@example.com",
  hasVoice: true,
  family,
  trialOffered,
});
const labels = (nav: Extract<NavState, { kind: "adult" }>) => accountLinks(nav).map((l) => l.label);

describe("familyAccess", () => {
  it("is none without a live plan, remembering whether there ever was one", () => {
    expect(familyAccess([], AT)).toEqual({ plan: "none", hadFamily: false });
    expect(familyAccess([plan("subscription", { endsAt: "2026-10-05T00:00:00.000Z" })], AT)).toEqual({ plan: "none", hadFamily: true });
    expect(familyAccess([plan("subscription", { status: "canceled" })], AT)).toEqual({ plan: "none", hadFamily: true });
  });

  it("prefers a paid plan over a trial", () => {
    expect(familyAccess([plan("trial", { endsAt: "2026-10-27T00:00:00.000Z" }), plan("gift")], AT)).toEqual({ plan: "paid", endsAt: null });
    expect(familyAccess([plan("trial", { endsAt: "2026-10-27T00:00:00.000Z" })], AT)).toEqual({ plan: "trial", endsAt: "2026-10-27T00:00:00.000Z" });
  });
});

describe("header for each account", () => {
  it("sends visitors to Try It Free and a kids device back to Readli Kids", () => {
    expect(primaryAction({ kind: "visitor" })).toEqual({ href: "/try", label: "Try It Free" });
    expect(primaryAction({ kind: "kids" })).toEqual({ href: "/kids", label: "Readli Kids" });
  });

  it("never offers My Family just for being signed in", () => {
    const voice = adult({ plan: "none", hadFamily: false }, true);
    expect(primaryAction(voice)).toEqual({ href: "/family/my-voice", label: "My Voice" });
    expect(labels(voice)).toEqual(["My Voice", "Account settings", "Help", "Start a free Family trial"]);
    expect(labels(adult({ plan: "none", hadFamily: true }))).not.toContain("Start a free Family trial");
  });

  it("gives a trial My Family in the menu, its end date and a way to choose a plan", () => {
    const trial = adult({ plan: "trial", endsAt: "2026-10-27T00:00:00.000Z" });
    expect(primaryAction(trial)).toBeNull();
    expect(labels(trial)).toEqual(["My Family", "My Voice", "Account settings", "Help", "Choose a plan"]);
    expect(accountBadge(trial)).toBe("Family trial · ends Oct 27");
  });

  it("gives a paid family My Family in the menu with no offers", () => {
    const paid = adult({ plan: "paid", endsAt: null });
    expect(primaryAction(paid)).toBeNull();
    expect(labels(paid)).toEqual(["My Family", "My Voice", "Account settings", "Help"]);
    expect(accountBadge(paid)).toBeNull();
  });
});
