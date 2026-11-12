import { describe, expect, it } from "vitest";
import { emptyFamilyState } from "./account-store";
import { demoFamilyState, DEMO_HOUSEHOLD_ID } from "./demo-family";
import { unstartedFamily } from "./unstarted";

const at = "2026-11-11T00:00:00.000Z";

function started() {
  const state = emptyFamilyState();
  state.adults.push({ id: "kev", displayName: "Kevin", avatarUrl: null, tint: "bg-sky" });
  state.households.push({ id: "h-new", name: "The Smiths", ownerId: "kev" });
  state.members.push({ householdId: "h-new", adultId: "kev", role: "guardian", joinedAt: at, removedAt: null });
  return state;
}

describe("a family started only for checkout", () => {
  it("is the family a grown-up made and backed out of paying for", () => {
    expect(unstartedFamily(started(), "kev")).toBe("h-new");
  });

  it("isn't a family that has had a plan, kids, or anyone else in it", () => {
    const paid = started();
    paid.entitlements.push({ id: "plan-old", householdId: "h-new", source: "subscription", status: "canceled", extraNarratorSlots: 0, extraStreams: 0, startsAt: at, endsAt: at });
    expect(unstartedFamily(paid, "kev")).toBeNull();

    const kids = started();
    kids.children.push({ id: "ivy", householdId: "h-new", nickname: "Ivy", tint: "bg-sky", guardianIds: ["kev"], deletedAt: null });
    expect(unstartedFamily(kids, "kev")).toBeNull();

    const shared = started();
    shared.members.push({ householdId: "h-new", adultId: "gran", role: "member", joinedAt: at, removedAt: null });
    expect(unstartedFamily(shared, "kev")).toBeNull();
  });

  it("is nothing for someone without a family, or for an established one", () => {
    expect(unstartedFamily(emptyFamilyState(), "kev")).toBeNull();
    expect(unstartedFamily(null, "kev")).toBeNull();
    const demo = demoFamilyState();
    const parent = demo.members.find((m) => m.householdId === DEMO_HOUSEHOLD_ID && m.role === "guardian")!.adultId;
    expect(unstartedFamily(demo, parent)).toBeNull();
  });
});
