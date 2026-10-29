import { describe, expect, it } from "vitest";
import { demoFamilyState, DEMO_HOUSEHOLD_ID } from "./demo-family";
import type { Actor, FamilyState } from "./model";
import { childVoiceAccess } from "./permissions";
import { familyParents, householdOwner, isPlanOwner, MemoryFamilyStore, PermissionError, removeCoParent, requireHouseholdGuardian } from "./service";

/** Sara started the demo family and pays for it; Ben is the co-parent. */
const sara: Actor = { kind: "adult", adultId: "sara" };
const ben: Actor = { kind: "adult", adultId: "ben" };
const june: Actor = { kind: "adult", adultId: "june" };
const H = DEMO_HOUSEHOLD_ID;
const clock = () => new Date("2026-10-29T12:00:00Z");

function family() {
  const state: FamilyState = demoFamilyState();
  // Ben approved Grandma June for Leo himself.
  state.approvals.push({ id: "approval-leo-june", voiceId: "voice-june", childId: "leo", approvedBy: "ben", approvedAt: "2026-10-03T00:00:00.000Z", revokedAt: null, revokedBy: null, revokeReason: null });
  return { state, store: new MemoryFamilyStore(state) };
}

async function rejects(p: Promise<unknown>, status: number, code?: string) {
  const err = await p.then(() => null, (e: unknown) => e);
  expect(err).toBeInstanceOf(PermissionError);
  expect((err as PermissionError).status).toBe(status);
  if (code) expect((err as PermissionError).code).toBe(code);
}

describe("co-parents", () => {
  it("share every parent's controls, while only the family's owner pays", async () => {
    const { state, store } = family();
    expect(householdOwner(state, H)).toBe("sara");
    expect(isPlanOwner(state, "ben", H)).toBe(false);
    expect(requireHouseholdGuardian(state, ben, H)).toBe("ben");
    const view = await familyParents(store, ben, H);
    expect(view.parents.map((p) => [p.adultId, p.owner, p.you])).toEqual([
      ["sara", true, false],
      ["ben", false, true],
    ]);
    expect(view.youOwn).toBe(false);
    expect((await familyParents(store, sara, H)).youOwn).toBe(true);
    await rejects(familyParents(store, june, H), 403);
  });

  it("fall back to the first parent to join when the owner isn't a parent any more", () => {
    const { state } = family();
    state.households[0]!.ownerId = "someone-gone";
    state.members.find((m) => m.adultId === "ben")!.joinedAt = "2026-09-01T00:00:00.000Z";
    expect(householdOwner(state, H)).toBe("ben");
    delete state.households[0]!.ownerId;
    expect(householdOwner(state, H)).toBe("ben");
  });

  it("can be removed by the owner, and the children keep every storyteller they approved", async () => {
    const { state, store } = family();
    expect(childVoiceAccess(state, "leo", "voice-june").allowed).toBe(true);
    await removeCoParent(store, sara, H, "ben", clock);
    expect(state.members.find((m) => m.adultId === "ben")?.removedAt).toBe("2026-10-29T12:00:00.000Z");
    expect(state.children.every((c) => !c.guardianIds.includes("ben"))).toBe(true);
    // Ben's approval of June for Leo now stands under Sara.
    const live = state.approvals.filter((a) => a.voiceId === "voice-june" && a.childId === "leo" && a.revokedAt === null);
    expect(live.map((a) => a.approvedBy)).toEqual(["sara"]);
    expect(childVoiceAccess(state, "leo", "voice-june").allowed).toBe(true);
    // Ben's own voice leaves the family's slot and the children's approvals.
    expect(state.slots.find((s) => s.voiceId === "voice-ben")?.releasedAt).not.toBeNull();
    expect(state.approvals.some((a) => a.voiceId === "voice-ben" && a.revokedAt === null)).toBe(false);
    await rejects(familyParents(store, ben, H), 403);
  });

  it("can leave on their own, but can't remove the owner or another parent", async () => {
    const { state, store } = family();
    await rejects(removeCoParent(store, ben, H, "sara", clock), 403, "not_owner");
    await rejects(removeCoParent(store, sara, H, "sara", clock), 409, "is_owner");
    await rejects(removeCoParent(store, sara, H, "june", clock), 404, "not_parent");
    await rejects(removeCoParent(store, june, H, "ben", clock), 403);
    await removeCoParent(store, ben, H, "ben", clock);
    expect(state.members.find((m) => m.adultId === "ben")?.removedAt).not.toBeNull();
  });
});
