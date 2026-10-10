import { describe, expect, it } from "vitest";
import { signupPath, signupStart, upgradeToFamily, canCreateVoice, type OwnedVoice } from "@/lib/accounts/accounts";
import { DEFAULT_PLAN } from "./config";
import {
  acquireStream,
  activateNarrator,
  canAddChildProfile,
  entitlementsFor,
  extraSlotsForSale,
  monthlyChargeCents,
  narratorPlayable,
  narratorsOverLimit,
  reassignSlot,
  type HouseholdSubscription,
  type NarratorActivation,
  type StreamLease,
} from "./entitlements";

const NOW = new Date("2026-10-10T12:00:00Z");
const sub = (over: Partial<HouseholdSubscription> = {}): HouseholdSubscription => ({
  householdId: "h1",
  source: "paid",
  status: "active",
  paidThrough: "2026-11-10T12:00:00Z",
  extraNarratorSlots: 0,
  ...over,
});
const family = entitlementsFor(sub(), NOW);

function activate(acts: NarratorActivation[], voiceId: string, opts: { shares?: boolean; householdId?: string; ent?: typeof family } = {}) {
  return activateNarrator(acts, {
    householdId: opts.householdId ?? "h1",
    voiceId,
    ownerSharesWithHousehold: opts.shares ?? true,
    ent: opts.ent ?? family,
    now: NOW,
    adultId: "parent",
  });
}

describe("Readli Family plan", () => {
  it("costs $14.99 a month with two narrator slots, six children and three streams", () => {
    expect(DEFAULT_PLAN.familyMonthlyPriceCents).toBe(1499);
    expect(family).toEqual({ family: true, narratorSlots: 2, maxChildProfiles: 6, concurrentStreams: 3 });
  });

  it("gives gifted and donated memberships the same household entitlements", () => {
    expect(entitlementsFor(sub({ source: "gift" }), NOW)).toEqual(family);
    expect(entitlementsFor(sub({ source: "donated" }), NOW)).toEqual(family);
    expect(entitlementsFor(sub({ paidThrough: "2026-10-01T00:00:00Z" }), NOW).family).toBe(false);
  });

  it("keeps extra narrator slots off sale until their price is approved", () => {
    expect(DEFAULT_PLAN.extraNarratorSlotPriceStatus).toBe("proposed");
    expect(extraSlotsForSale()).toBe(false);
    expect(extraSlotsForSale({ ...DEFAULT_PLAN, extraNarratorSlotPriceStatus: "approved" })).toBe(true);
    expect(DEFAULT_PLAN.extraStreamsForSale).toBe(false);
  });
});

describe("free contributors", () => {
  it("can share without subscribing: no entitlements, no charge, and being in more households costs nothing", () => {
    expect(entitlementsFor(null, NOW).family).toBe(false);
    // Grandma's voice active in three paying households: only the households hold activations.
    let acts: NarratorActivation[] = [];
    for (const h of ["h1", "h2", "h3"]) {
      const r = activate(acts, "grandma-voice", { householdId: h });
      expect(r.ok).toBe(true);
      if (r.ok) acts = r.activations;
    }
    expect(acts.map((a) => a.householdId)).toEqual(["h1", "h2", "h3"]);
    expect(new Set(acts.map((a) => a.voiceId))).toEqual(new Set(["grandma-voice"]));
  });

  it("get one verified voice each, shared by reference rather than cloned per household", () => {
    const grandma = { id: "g", email: "g@x", displayName: "Grandma", verifiedAt: NOW.toISOString() };
    const voices: OwnedVoice[] = [];
    expect(canCreateVoice({ ...grandma, verifiedAt: null }, voices).ok).toBe(false);
    expect(canCreateVoice(grandma, voices).ok).toBe(true);
    voices.push({ id: "v", ownerId: "g", deletedAt: null });
    expect(canCreateVoice(grandma, voices).ok).toBe(false);
    // Grandpa in the same contributor household has his own allowance.
    expect(canCreateVoice({ ...grandma, id: "p" }, voices).ok).toBe(true);
  });

  it("keep identity, voice and shares when they upgrade to Readli Family", () => {
    const before = { id: "home-g", kind: "contributor" as const };
    const after = upgradeToFamily(before);
    expect(after).toEqual({ id: "home-g", kind: "family" });
  });
});

describe("narrator slots", () => {
  it("includes two; a third needs an extra-slot entitlement", () => {
    let acts: NarratorActivation[] = [];
    for (const v of ["mom", "grandpa"]) {
      const r = activate(acts, v);
      if (!r.ok) throw new Error(r.message);
      acts = r.activations;
    }
    const third = activate(acts, "aunt");
    expect(third.ok === false && third.reason).toBe("no_free_slot");
    const withExtra = entitlementsFor(sub({ extraNarratorSlots: 1 }), NOW);
    expect(activate(acts, "aunt", { ent: withExtra }).ok).toBe(true);
    expect(monthlyChargeCents(sub({ extraNarratorSlots: 1 }))).toBe(1499 + 299);
  });

  it("needs the owner's consent first; a slot or payment never substitutes for it", () => {
    const r = activate([], "uncle", { shares: false });
    expect(r.ok === false && r.reason).toBe("no_owner_consent");
    expect(activate([], "uncle", { ent: entitlementsFor(null, NOW) }).ok).toBe(false);
  });

  it("reassigns a slot, with a monthly limit on swaps", () => {
    let acts: NarratorActivation[] = [];
    for (const v of ["a", "b"]) {
      const r = activate(acts, v);
      if (r.ok) acts = r.activations;
    }
    for (const [from, to] of [
      ["a", "c"],
      ["c", "d"],
    ]) {
      const r = reassignSlot(acts, { householdId: "h1", voiceId: to!, fromVoiceId: from!, ownerSharesWithHousehold: true, ent: family, now: NOW, adultId: "p" });
      if (!r.ok) throw new Error(r.message);
      acts = r.activations;
    }
    const tooMany = reassignSlot(acts, { householdId: "h1", voiceId: "e", fromVoiceId: "d", ownerSharesWithHousehold: true, ent: family, now: NOW, adultId: "p" });
    expect(tooMany.ok === false && tooMany.reason).toBe("swap_limit");
  });

  it("pauses the newest narrators when a household drops below its slots", () => {
    const acts: NarratorActivation[] = ["x", "y", "z"].map((v, i) => ({
      householdId: "h1",
      voiceId: v,
      activatedBy: "p",
      activatedAt: `2026-10-0${i + 1}T00:00:00Z`,
      deactivatedAt: null,
    }));
    expect(narratorsOverLimit(acts, "h1", family).map((a) => a.voiceId)).toEqual(["z"]);
  });

  it("keeps owner consent, slot activation and parent approval independent", () => {
    const all = { ownerShares: true, activeInHousehold: true, withinSlotLimit: true, parentApprovedForChild: true };
    expect(narratorPlayable(all)).toBe(true);
    for (const key of Object.keys(all) as (keyof typeof all)[]) expect(narratorPlayable({ ...all, [key]: false })).toBe(false);
  });
});

describe("child profiles and listening sessions", () => {
  it("allows six children with no per-child charge", () => {
    for (let n = 0; n < 6; n++) expect(canAddChildProfile(n, family).ok).toBe(true);
    expect(canAddChildProfile(6, family).ok).toBe(false);
    expect(canAddChildProfile(0, entitlementsFor(null, NOW)).ok).toBe(false);
    // The charge has no child count in it at all.
    expect(monthlyChargeCents(sub())).toBe(1499);
  });

  it("lets three children listen at once on the base plan, and frees stale players", () => {
    let leases: StreamLease[] = [];
    for (const c of ["maya", "leo", "ava"]) {
      const r = acquireStream(leases, { householdId: "h1", childId: c, deviceId: `${c}-ipad`, ent: family, now: NOW });
      if (!r.ok) throw new Error(r.message);
      leases = r.leases;
    }
    const fourth = acquireStream(leases, { householdId: "h1", childId: "june", deviceId: "j", ent: family, now: NOW });
    expect(fourth.ok === false && fourth.reason).toBe("stream_limit");
    // Same child on a second device moves the session instead of using a stream.
    const moved = acquireStream(leases, { householdId: "h1", childId: "maya", deviceId: "maya-phone", ent: family, now: NOW });
    expect(moved.ok && moved.leases.filter((l) => l.childId === "maya")).toEqual([expect.objectContaining({ deviceId: "maya-phone" })]);
    // Two minutes later with no heartbeats, the streams are free again.
    const later = new Date(NOW.getTime() + 120_000);
    expect(acquireStream(leases, { householdId: "h1", childId: "june", deviceId: "j", ent: family, now: later }).ok).toBe(true);
  });
});

describe("signup routing", () => {
  it("has two entry points and sends invitations to Readli Voice", () => {
    expect(signupPath(signupStart({ signedIn: false }))).toBe("/signup");
    expect(signupPath(signupStart({ signedIn: false, choice: "family" }))).toBe("/signup/family");
    expect(signupPath(signupStart({ signedIn: false, invitation: "tok" }))).toBe("/signup/voice?invite=tok");
    expect(signupPath(signupStart({ signedIn: true, invitation: "tok" }))).toBe("/voice?invite=tok");
  });
});
