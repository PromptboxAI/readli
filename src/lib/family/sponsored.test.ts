import { describe, expect, it } from "vitest";
import { demoFamilyState, DEMO_HOUSEHOLD_ID } from "./demo-family";
import type { Actor, FamilyState, HouseholdEntitlement } from "./model";
import { childVoiceAccess, liveSlots, narratorSlotCount, sponsorVoiceIncluded } from "./permissions";
import { DEFAULT_PLAN } from "./plan";
import { activateNarrator, createChildProfile, MemoryFamilyStore, narratorSlots, PermissionError, setChildApprovals, setHouseholdShare, startListening } from "./service";
import { creditBalance } from "@/lib/narration/credits";

/** Grandparent-sponsored Readli Family (Kevin, 2026-10-26): per-household limits and the sponsor's included voice. */
const mom: Actor = { kind: "adult", adultId: "sara" };
const H = DEMO_HOUSEHOLD_ID;
const START = "2026-09-25T07:00:00.000Z";

let tick = Date.parse("2026-10-20T00:00:00Z");
const clock = () => new Date((tick += 1000));

function sponsored(extra: Partial<HouseholdEntitlement> = {}): HouseholdEntitlement {
  return {
    id: "plan-gift",
    householdId: H,
    source: "sponsored",
    status: "active",
    extraNarratorSlots: 0,
    extraStreams: 0,
    startsAt: START,
    endsAt: null,
    sponsorshipId: "sp-1",
    sponsorUserId: "june",
    monthlyCredits: 20,
    includedNarratorSlots: 1,
    includedStreams: 2,
    maxChildProfiles: 6,
    ...extra,
  };
}

/** The preview family, covered by Grandma June's gift, with nothing activated or approved. */
function giftedFamily(extra: Partial<HouseholdEntitlement> = {}) {
  const state: FamilyState = demoFamilyState();
  state.entitlements = [sponsored(extra)];
  state.slots = [];
  state.approvals = [];
  state.sessions = [];
  return { state, store: new MemoryFamilyStore(state, DEFAULT_PLAN) };
}

async function rejects(p: Promise<unknown>, status: number, code: string) {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(PermissionError);
  expect((err as PermissionError).status).toBe(status);
  expect((err as PermissionError).code).toBe(code);
}

async function shareAll(store: MemoryFamilyStore, ...owners: string[]) {
  for (const o of owners) {
    await setHouseholdShare(store, { kind: "adult", adultId: o }, { voiceId: `voice-${o}`, householdId: H, shared: true, policyVersion: "p" }, clock);
  }
}

describe("sponsored Readli Family", () => {
  it("includes the sponsor's voice without using the household's one slot", async () => {
    const { state, store } = giftedFamily();
    await shareAll(store, "june", "lou", "rose");
    expect(narratorSlotCount(state, H, DEFAULT_PLAN)).toBe(1);
    expect(sponsorVoiceIncluded(state, "voice-june", H)).toBe(true);
    expect(sponsorVoiceIncluded(state, "voice-lou", H)).toBe(false);

    await activateNarrator(store, mom, H, "voice-june", clock);
    await activateNarrator(store, mom, H, "voice-lou", clock);
    await rejects(activateNarrator(store, mom, H, "voice-rose", clock), 409, "no_free_slot");
    expect(liveSlots(state, H, DEFAULT_PLAN).map((a) => a.voiceId).sort()).toEqual(["voice-june", "voice-lou"]);
    const view = await narratorSlots(store, mom, H, clock);
    expect({ total: view.total, included: view.included, used: view.active.length, gifted: view.giftedVoiceIds }).toEqual({ total: 2, included: 2, used: 2, gifted: ["voice-june"] });
  });

  it("never lets payment approve the sponsor for a child", async () => {
    const { state, store } = giftedFamily();
    await shareAll(store, "june");
    await activateNarrator(store, mom, H, "voice-june", clock);
    expect(childVoiceAccess(state, "maya", "voice-june", DEFAULT_PLAN)).toEqual({ allowed: false, reason: "not_approved_for_child" });

    await setChildApprovals(store, mom, "maya", [{ voiceId: "voice-june", approved: true }], clock);
    expect(childVoiceAccess(state, "maya", "voice-june", DEFAULT_PLAN).allowed).toBe(true);
    expect(childVoiceAccess(state, "leo", "voice-june", DEFAULT_PLAN).allowed).toBe(false);
  });

  it("lets two children listen at once, not three", async () => {
    const { store } = giftedFamily();
    const third = await createChildProfile(store, mom, H, "Ada", clock);
    await startListening(store, mom, "maya", clock);
    await startListening(store, mom, "leo", clock);
    await rejects(startListening(store, mom, third, clock), 429, "too_many_listeners");
  });

  it("caps child profiles at the plan's own limit", async () => {
    const { store } = giftedFamily({ maxChildProfiles: 3 });
    await createChildProfile(store, mom, H, "Ada", clock);
    await rejects(createChildProfile(store, mom, H, "Bea", clock), 409, "child_limit");
  });

  it("gives the household its share of credits, and a new share only from the month it was set for", () => {
    const { state } = giftedFamily({ nextMonthlyCredits: 30, nextCreditsFrom: "2026-11-25T07:00:00.000Z" });
    expect(creditBalance(state, DEFAULT_PLAN, H, "2026-11-10T00:00:00.000Z").allowance).toBe(20 * DEFAULT_PLAN.charactersPerCredit);
    expect(creditBalance(state, DEFAULT_PLAN, H, "2026-11-26T00:00:00.000Z").allowance).toBe(30 * DEFAULT_PLAN.charactersPerCredit);
  });

  it("keeps every storyteller and approval when the family moves to its own plan", async () => {
    const { state, store } = giftedFamily();
    await shareAll(store, "june", "lou");
    await activateNarrator(store, mom, H, "voice-june", clock);
    await activateNarrator(store, mom, H, "voice-lou", clock);
    await setChildApprovals(store, mom, "maya", [{ voiceId: "voice-june", approved: true }, { voiceId: "voice-lou", approved: true }], clock);

    // The gift ends; nothing plays until a plan starts.
    state.entitlements[0]!.endsAt = new Date(clock().getTime() - 500).toISOString();
    expect(childVoiceAccess(state, "maya", "voice-june", DEFAULT_PLAN).reason).toBe("no_family_plan");

    // Their own Readli Family: Grandma now uses one of its two slots and nobody re-approves anything.
    state.entitlements.push({ id: "plan-own", householdId: H, source: "subscription", status: "active", extraNarratorSlots: 0, extraStreams: 0, startsAt: clock().toISOString(), endsAt: null });
    expect(sponsorVoiceIncluded(state, "voice-june", H)).toBe(false);
    expect(childVoiceAccess(state, "maya", "voice-june", DEFAULT_PLAN).allowed).toBe(true);
    expect(childVoiceAccess(state, "maya", "voice-lou", DEFAULT_PLAN).allowed).toBe(true);
  });

  it("leaves ordinary plans on the plan settings", () => {
    const state = demoFamilyState();
    expect(narratorSlotCount(state, H, DEFAULT_PLAN)).toBe(DEFAULT_PLAN.includedNarratorSlots + 2);
    expect(creditBalance(state, DEFAULT_PLAN, H).allowance).toBe(DEFAULT_PLAN.monthlyCredits * DEFAULT_PLAN.charactersPerCredit);
  });
});
