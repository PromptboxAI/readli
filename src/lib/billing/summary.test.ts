import { describe, expect, it } from "vitest";
import type { FamilyState, HouseholdEntitlement } from "@/lib/family/model";
import { DEFAULT_PLAN } from "@/lib/family/plan";
import { billingSummary } from "./summary";

const at = "2026-10-11T00:00:00.000Z";
const state = (entitlements: Partial<HouseholdEntitlement>[]) =>
  ({
    entitlements: entitlements.map((e, i) => ({ id: `e${i}`, householdId: "h1", source: "subscription", status: "active", extraNarratorSlots: 0, extraStreams: 0, startsAt: "2026-10-01T00:00:00.000Z", endsAt: null, ...e })),
  }) as unknown as FamilyState;

describe("billingSummary", () => {
  it("offers Readli Family to a family without a plan", () => {
    expect(billingSummary(state([]), DEFAULT_PLAN, "h1", at)).toMatchObject({ plan: "none", narratorSlots: 0, canStartPlan: true });
  });

  it("counts extra slots and their monthly cost on a paid plan", () => {
    expect(billingSummary(state([{ extraNarratorSlots: 2 }]), DEFAULT_PLAN, "h1", at)).toMatchObject({
      plan: "subscription",
      narratorSlots: DEFAULT_PLAN.includedNarratorSlots + 2,
      extraSlotsMonthlyCents: 2 * DEFAULT_PLAN.extraSlotPriceCents,
      canStartPlan: false,
    });
  });

  it("lets a trial or tester family start paying, but never charges a gift for slots", () => {
    expect(billingSummary(state([{ source: "trial", endsAt: "2026-10-20T00:00:00.000Z" }]), DEFAULT_PLAN, "h1", at)).toMatchObject({ plan: "trial", canStartPlan: true, endsAt: "2026-10-20T00:00:00.000Z" });
    expect(billingSummary(state([{ source: "tester" }]), DEFAULT_PLAN, "h1", at).canStartPlan).toBe(true);
    expect(billingSummary(state([{ source: "gift", extraNarratorSlots: 1 }]), DEFAULT_PLAN, "h1", at)).toMatchObject({ canStartPlan: false, extraSlotsMonthlyCents: 0 });
  });

  it("shows the paid plan once a tester or trial family pays, even while the free plan hasn't run out", () => {
    const paid = billingSummary(state([{ source: "tester", endsAt: "2026-11-12T00:00:00.000Z" }, { source: "subscription", extraNarratorSlots: 1 }]), DEFAULT_PLAN, "h1", at);
    expect(paid).toMatchObject({ plan: "subscription", canStartPlan: false, extraNarratorSlots: 1 });
    expect(billingSummary(state([{ source: "trial", endsAt: "2026-10-20T00:00:00.000Z" }, { source: "gift" }]), DEFAULT_PLAN, "h1", at).plan).toBe("gift");
  });

  it("ignores an ended plan", () => {
    expect(billingSummary(state([{ endsAt: "2026-10-05T00:00:00.000Z" }]), DEFAULT_PLAN, "h1", at).plan).toBe("none");
  });

  it("lets a family line up its own plan once its gift has an end date", () => {
    expect(billingSummary(state([{ source: "sponsored", includedNarratorSlots: 1 }]), DEFAULT_PLAN, "h1", at)).toMatchObject({ plan: "sponsored", narratorSlots: 1, canStartPlan: false });
    expect(billingSummary(state([{ source: "sponsored", endsAt: "2026-11-01T00:00:00.000Z" }]), DEFAULT_PLAN, "h1", at)).toMatchObject({ canStartPlan: true });
  });
});
