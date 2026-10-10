import { describe, expect, it } from "vitest";
import { demoFamilyState, DEMO_HOUSEHOLD_ID } from "./demo-family";
import type { Actor, FamilyState } from "./model";
import { childVoiceAccess } from "./permissions";
import { DEFAULT_PLAN, planConfig } from "./plan";
import {
  activateNarrator,
  addNarratorSlot,
  createChildProfile,
  grantEntitlement,
  MemoryFamilyStore,
  narratorsFor,
  narratorSlots,
  PermissionError,
  releaseNarrator,
  setChildApprovals,
  setHouseholdShare,
  startListening,
  stopListening,
} from "./service";
import { authorizePlayback } from "@/lib/narration/narration";

/** Final Signup Architecture and Subscription Pricing amendment: required tests. */
const mom: Actor = { kind: "adult", adultId: "sara" };
const H = DEMO_HOUSEHOLD_ID;
const H2 = "home-two";

let tick = Date.parse("2026-10-10T00:00:00Z");
const clock = () => new Date((tick += 1000));

/** The preview family on a base plan: two included slots, nothing activated or approved yet. */
function basePlanFamily() {
  const state: FamilyState = demoFamilyState();
  state.entitlements[0]!.extraNarratorSlots = 0;
  state.slots = [];
  state.approvals = [];
  return { state, store: new MemoryFamilyStore(state, DEFAULT_PLAN) };
}

/** A second, separately paying household: Kim (guardian) with child Ivy. Grandma June belongs to both. */
function addSecondHousehold(state: FamilyState) {
  state.households.push({ id: H2, name: "Kim's family" });
  state.adults.push({ id: "kim", displayName: "Kim", relationship: "June's daughter-in-law", avatarUrl: null, tint: "bg-mint" });
  state.members.push(
    { householdId: H2, adultId: "kim", role: "guardian", joinedAt: "2026-10-01T00:00:00Z", removedAt: null },
    { householdId: H2, adultId: "june", role: "member", joinedAt: "2026-10-01T00:00:00Z", removedAt: null },
  );
  state.children.push({ id: "ivy", householdId: H2, nickname: "Ivy", tint: "bg-sky", guardianIds: ["kim"], deletedAt: null });
}

async function rejects(p: Promise<unknown>, status: number, code?: string) {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(PermissionError);
  expect((err as PermissionError).status).toBe(status);
  if (code) expect((err as PermissionError).code).toBe(code);
}

describe("signup and pricing amendment", () => {
  it("free contributors share without subscribing", async () => {
    const { state, store } = basePlanFamily();
    // Grandpa Lou has no plan of his own; sharing needs only his consent.
    expect(state.entitlements.some((e) => e.householdId !== H)).toBe(false);
    await setHouseholdShare(store, { kind: "adult", adultId: "lou" }, { voiceId: "voice-lou", householdId: H, shared: true, policyVersion: "p" }, clock);
    expect((await narratorSlots(store, mom, H, clock)).shared.map((n) => n.voiceId)).toContain("voice-lou");
  });

  it("one voice is shared with several paying households without a second voice record", async () => {
    const { state, store } = basePlanFamily();
    addSecondHousehold(state);
    await grantEntitlement(store, H2, { source: "subscription", months: null }, clock);
    const kim: Actor = { kind: "adult", adultId: "kim" };
    await setHouseholdShare(store, { kind: "adult", adultId: "june" }, { voiceId: "voice-june", householdId: H2, shared: true, policyVersion: "p" }, clock);
    for (const [actor, home, child] of [[mom, H, "maya"], [kim, H2, "ivy"]] as const) {
      await activateNarrator(store, actor, home, "voice-june", clock);
      await setChildApprovals(store, actor, child, [{ voiceId: "voice-june", approved: true }], clock);
    }
    expect(state.voices.filter((v) => v.ownerId === "june")).toHaveLength(1);
    expect(childVoiceAccess(state, "maya", "voice-june").allowed).toBe(true);
    expect(childVoiceAccess(state, "ivy", "voice-june").allowed).toBe(true);
    // Stopping sharing with one family leaves the other untouched.
    await setHouseholdShare(store, { kind: "adult", adultId: "june" }, { voiceId: "voice-june", householdId: H2, shared: false, policyVersion: "p" }, clock);
    expect(childVoiceAccess(state, "ivy", "voice-june").allowed).toBe(false);
    expect(childVoiceAccess(state, "maya", "voice-june").allowed).toBe(true);
  });

  it("Readli Family includes two narrator slots; a third needs an extra-slot entitlement", async () => {
    const { store } = basePlanFamily();
    const view = await narratorSlots(store, mom, H, clock);
    expect(view.total).toBe(2);
    await activateNarrator(store, mom, H, "voice-sara", clock);
    await activateNarrator(store, mom, H, "voice-june", clock);
    await rejects(activateNarrator(store, mom, H, "voice-rose", clock), 409, "no_free_slot");
    await addNarratorSlot(store, mom, H, clock);
    await activateNarrator(store, mom, H, "voice-rose", clock);
    expect((await narratorSlots(store, mom, H, clock)).active.map((n) => n.voiceId)).toEqual(["voice-sara", "voice-june", "voice-rose"]);
  });

  it("consent never activates a voice, and a lapsed plan or a shrunk slot count stops access", async () => {
    const { state, store } = basePlanFamily();
    await activateNarrator(store, mom, H, "voice-sara", clock);
    await setChildApprovals(store, mom, "maya", [{ voiceId: "voice-sara", approved: true }], clock);
    await activateNarrator(store, mom, H, "voice-june", clock);
    await setChildApprovals(store, mom, "maya", [{ voiceId: "voice-june", approved: true }], clock);
    // Rose shared long ago, but nobody put her in a slot.
    expect(childVoiceAccess(state, "maya", "voice-rose").reason).toBe("not_activated_by_household");
    // If the plan ends, nobody plays, but approvals are kept for when it comes back.
    state.entitlements[0]!.status = "canceled";
    expect(childVoiceAccess(state, "maya", "voice-sara").reason).toBe("no_family_plan");
    state.entitlements[0]!.status = "active";
    expect(childVoiceAccess(state, "maya", "voice-sara").allowed).toBe(true);
  });

  it("freeing a slot ends that voice's approvals, and reassignments are rate-limited", async () => {
    const { state, store } = basePlanFamily();
    await activateNarrator(store, mom, H, "voice-sara", clock);
    await setChildApprovals(store, mom, "maya", [{ voiceId: "voice-sara", approved: true }], clock);
    await releaseNarrator(store, mom, H, "voice-sara", clock);
    await activateNarrator(store, mom, H, "voice-sara", clock);
    expect(childVoiceAccess(state, "maya", "voice-sara").reason).toBe("not_approved_for_child");
    for (let i = 1; i < DEFAULT_PLAN.slotReleasesPer30Days; i++) {
      await releaseNarrator(store, mom, H, "voice-sara", clock);
      await activateNarrator(store, mom, H, "voice-sara", clock);
    }
    await rejects(releaseNarrator(store, mom, H, "voice-sara", clock), 429, "too_many_changes");
  });

  it("six child profiles can exist without per-child billing", async () => {
    const { state, store } = basePlanFamily();
    const before = JSON.stringify(state.entitlements);
    for (const name of ["Ava", "Ben", "Cleo", "Dev"]) await createChildProfile(store, mom, H, name, clock);
    expect(state.children.filter((c) => c.householdId === H && !c.deletedAt)).toHaveLength(6);
    expect(JSON.stringify(state.entitlements)).toBe(before);
    await rejects(createChildProfile(store, mom, H, "Eli", clock), 409, "child_limit");
    // A new child starts with no storytellers.
    const ava = state.children.find((c) => c.nickname === "Ava")!;
    expect(await narratorsFor(store, mom, ava.id)).toEqual([]);
  });

  it("only three children can listen at once on the base plan, each in their own session", async () => {
    const { state, store } = basePlanFamily();
    const ids = ["maya", "leo"];
    for (const name of ["Ava", "Ben"]) ids.push(await createChildProfile(store, mom, H, name, clock));
    const kid = (id: string): Actor => ({ kind: "child", childId: id });
    for (const id of ids.slice(0, 3)) await startListening(store, kid(id), id, clock);
    await rejects(startListening(store, kid(ids[3]!), ids[3]!, clock), 429, "too_many_listeners");
    // The same child on a new play refreshes their own session rather than taking another.
    await startListening(store, kid("maya"), "maya", clock);
    await stopListening(store, kid("leo"), "leo", clock);
    await startListening(store, kid(ids[3]!), ids[3]!, clock);
    // Narration needs a live session for that child.
    await activateNarrator(store, mom, H, "voice-sara", clock);
    await setChildApprovals(store, mom, "leo", [{ voiceId: "voice-sara", approved: true }], clock);
    await rejects(authorizePlayback(store, kid("leo"), { childId: "leo", voiceId: "voice-sara", bookSlug: "winnie-the-pooh", sentence: 0 }, "k", clock), 409, "no_listening_session");
    // Sessions that stop sending heartbeats stop counting.
    tick += DEFAULT_PLAN.sessionStaleMs + 1000;
    await startListening(store, kid("leo"), "leo", clock);
    expect(state.sessions.filter((s) => s.endedAt === null).length).toBeGreaterThan(3);
  });

  it("voice-owner consent and parent authorization stay independent", async () => {
    const { state, store } = basePlanFamily();
    await activateNarrator(store, mom, H, "voice-rose", clock);
    await setChildApprovals(store, mom, "leo", [{ voiceId: "voice-rose", approved: true }], clock);
    // The parent can't share for the owner, and the owner can't approve for the child.
    await rejects(setHouseholdShare(store, mom, { voiceId: "voice-rose", householdId: H, shared: false, policyVersion: "p" }), 403, "not_owner");
    await rejects(setChildApprovals(store, { kind: "adult", adultId: "rose" }, "maya", [{ voiceId: "voice-rose", approved: true }], clock), 403, "not_guardian");
    expect(childVoiceAccess(state, "leo", "voice-rose").allowed).toBe(true);
    expect(childVoiceAccess(state, "maya", "voice-rose").allowed).toBe(false);
  });

  it("a contributor who starts their own Readli Family keeps their identity, voice and sharing", async () => {
    const { state, store } = basePlanFamily();
    const priya: Actor = { kind: "adult", adultId: "priya" };
    const voicesBefore = state.voices.filter((v) => v.ownerId === "priya").map((v) => v.id);
    // Priya upgrades: a new household with her as guardian, paid by her plan.
    state.households.push({ id: "home-priya", name: "Priya's family" });
    state.members.push({ householdId: "home-priya", adultId: "priya", role: "guardian", joinedAt: clock().toISOString(), removedAt: null });
    await grantEntitlement(store, "home-priya", { source: "subscription", months: null }, clock);
    expect(state.voices.filter((v) => v.ownerId === "priya").map((v) => v.id)).toEqual(voicesBefore);
    expect((await narratorSlots(store, mom, H, clock)).shared.map((n) => n.voiceId)).toContain("voice-priya");
    await setHouseholdShare(store, priya, { voiceId: "voice-priya", householdId: "home-priya", shared: true, policyVersion: "p" }, clock);
    await activateNarrator(store, priya, "home-priya", "voice-priya", clock);
    expect((await narratorSlots(store, priya, "home-priya", clock)).active.map((n) => n.voiceId)).toEqual(["voice-priya"]);
  });

  it("free contributor households get no kids profiles", async () => {
    const { state, store } = basePlanFamily();
    addSecondHousehold(state);
    await rejects(createChildProfile(store, { kind: "adult", adultId: "kim" }, H2, "Ivy two", clock), 402, "no_family_plan");
  });

  it("gift and donated memberships use the same household entitlement", async () => {
    const { state, store } = basePlanFamily();
    addSecondHousehold(state);
    const kim: Actor = { kind: "adult", adultId: "kim" };
    await rejects(activateNarrator(store, kim, H2, "voice-june", clock), 402, "no_family_plan");
    await grantEntitlement(store, H2, { source: "gift", months: 12 }, clock);
    expect((await narratorSlots(store, kim, H2, clock)).total).toBe(2);
  });

  it("plan settings are admin-configurable", () => {
    expect(planConfig({} as NodeJS.ProcessEnv)).toEqual(DEFAULT_PLAN);
    const custom = planConfig({ PLAN_INCLUDED_SLOTS: "3", PLAN_MAX_CHILD_PROFILES: "8", PLAN_FAMILY_PRICE_CENTS: "1299" } as unknown as NodeJS.ProcessEnv);
    expect(custom).toMatchObject({ includedNarratorSlots: 3, maxChildProfiles: 8, familyMonthlyPriceCents: 1299, includedConcurrentStreams: 3 });
  });
});
