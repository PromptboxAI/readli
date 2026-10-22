import { randomUUID } from "node:crypto";
import type { Actor, AuditAction, FamilyState, ListeningSession } from "./model";
import {
  activeChild,
  activeEntitlement,
  activeShare,
  activeSlot,
  approvedVoiceIds,
  isActiveMember,
  isGuardianOf,
  liveSlots,
  narratorSlotCount,
  readyVoice,
  storytellerStatus,
  type StorytellerStatus,
} from "./permissions";
import { DEFAULT_PLAN, type PlanConfig } from "./plan";
import { MemoryNarrationStorage, type NarrationStorage } from "@/lib/narration/storage";

/**
 * Server-side family voice service. Route handlers resolve the signed-in actor and call these;
 * nothing here trusts the browser about who may hear what.
 */

export class PermissionError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    /** Safe to show in the app. */
    readonly userMessage: string,
    /** Extra facts for the app (for example, how many more credits are needed). */
    readonly details?: Record<string, unknown>,
  ) {
    super(code);
  }
}

const SIGN_IN = new PermissionError(401, "sign_in_required", "Please sign in as a grown-up to continue.");
const ADULTS_ONLY = new PermissionError(403, "adults_only", "Only a parent or guardian can change storytellers.");
const NOT_GUARDIAN = new PermissionError(403, "not_guardian", "Only this child's parent or guardian can manage their storytellers.");
const NOT_OWNER = new PermissionError(403, "not_owner", "Only the person whose voice it is can share it.");
export const NOT_AVAILABLE = new PermissionError(403, "voice_not_available", "That storyteller isn't available right now.");

export interface FamilyStore {
  /** Admin-configured plan settings for this store's households. */
  readonly plan: PlanConfig;
  /** Private narration audio. */
  readonly audio: NarrationStorage;
  read(): Promise<FamilyState>;
  write(mutate: (state: FamilyState) => void): Promise<void>;
  /** Takes a narration job for one worker until the lease ends; false while another worker holds it. */
  claimJob?(jobId: string, leaseMs: number): Promise<boolean>;
  releaseJob?(jobId: string): Promise<void>;
}

export class MemoryFamilyStore implements FamilyStore {
  constructor(
    private state: FamilyState,
    readonly plan: PlanConfig = DEFAULT_PLAN,
    readonly audio: NarrationStorage = new MemoryNarrationStorage(),
  ) {}
  async read() {
    return this.state;
  }
  async write(mutate: (state: FamilyState) => void) {
    mutate(this.state);
  }
  private leases = new Map<string, number>();
  async claimJob(jobId: string, leaseMs: number) {
    if ((this.leases.get(jobId) ?? 0) > Date.now()) return false;
    this.leases.set(jobId, Date.now() + leaseMs);
    return true;
  }
  async releaseJob(jobId: string) {
    this.leases.delete(jobId);
  }
}

type Clock = () => Date;
const now: Clock = () => new Date();

export function audit(state: FamilyState, actor: string, action: AuditAction, at: string, rest: { voiceId?: string; childId?: string; householdId?: string; detail?: string }) {
  state.audit.push({
    id: randomUUID(),
    at,
    actor,
    action,
    voiceId: rest.voiceId ?? null,
    childId: rest.childId ?? null,
    householdId: rest.householdId ?? null,
    detail: rest.detail ?? null,
  });
}

function requireAdult(actor: Actor | null): string {
  if (!actor) throw SIGN_IN;
  if (actor.kind !== "adult") throw ADULTS_ONLY;
  return actor.adultId;
}

// ---------------------------------------------------------------------------
// Voice owner: key 1
// ---------------------------------------------------------------------------

export interface MyVoiceView {
  voiceId: string;
  status: string;
  households: { id: string; name: string; shared: boolean }[];
}

export async function myVoices(store: FamilyStore, actor: Actor | null): Promise<MyVoiceView[]> {
  const adultId = requireAdult(actor);
  const state = await store.read();
  const homes = state.members.filter((m) => m.adultId === adultId && m.removedAt === null);
  return state.voices
    .filter((v) => v.ownerId === adultId && v.deletedAt === null)
    .map((v) => ({
      voiceId: v.id,
      status: v.status,
      households: homes.map((m) => ({
        id: m.householdId,
        name: state.households.find((h) => h.id === m.householdId)?.name ?? "Family",
        shared: activeShare(state, v.id, m.householdId) !== null,
      })),
    }));
}

/**
 * Turns the owner's household share on or off. Turning it off also revokes every child approval
 * for that household, so sharing again starts disabled for every child.
 */
export async function setHouseholdShare(
  store: FamilyStore,
  actor: Actor | null,
  input: { voiceId: string; householdId: string; shared: boolean; policyVersion: string },
  clock: Clock = now,
): Promise<void> {
  const adultId = requireAdult(actor);
  const state = await store.read();
  const voice = state.voices.find((v) => v.id === input.voiceId && v.deletedAt === null);
  if (!voice || voice.ownerId !== adultId) throw NOT_OWNER;
  if (!isActiveMember(state, adultId, input.householdId)) throw new PermissionError(403, "not_member", "You aren't part of that family.");
  if (input.shared && voice.status !== "ready") throw new PermissionError(409, "voice_not_ready", "Your voice is still being made.");

  const at = clock().toISOString();
  await store.write((s) => {
    const current = s.shares.find((x) => x.voiceId === voice.id && x.householdId === input.householdId && x.revokedAt === null);
    if (input.shared) {
      if (current) return;
      s.shares.push({
        id: randomUUID(),
        voiceId: voice.id,
        householdId: input.householdId,
        grantedBy: adultId,
        policyVersion: input.policyVersion,
        grantedAt: at,
        revokedAt: null,
        revokedBy: null,
      });
      audit(s, adultId, "voice_shared", at, { voiceId: voice.id, householdId: input.householdId });
      return;
    }
    if (!current) return;
    current.revokedAt = at;
    current.revokedBy = adultId;
    for (const slot of s.slots) {
      if (slot.voiceId === voice.id && slot.householdId === input.householdId && slot.releasedAt === null) {
        slot.releasedAt = at;
        slot.releasedBy = adultId;
      }
    }
    const kids = new Set(s.children.filter((c) => c.householdId === input.householdId).map((c) => c.id));
    for (const a of s.approvals) {
      if (a.voiceId === voice.id && kids.has(a.childId) && a.revokedAt === null) {
        a.revokedAt = at;
        a.revokedBy = adultId;
        a.revokeReason = "owner_revoked";
      }
    }
    audit(s, adultId, "voice_unshared", at, { voiceId: voice.id, householdId: input.householdId });
  });
}

// ---------------------------------------------------------------------------
// Guardian: key 2 (Manage Storytellers)
// ---------------------------------------------------------------------------

export interface StorytellerView {
  voiceId: string;
  ownerName: string;
  relationship: string;
  avatarUrl: string | null;
  tint: string;
  status: StorytellerStatus;
}

export interface ManageStorytellersView {
  child: { id: string; nickname: string; tint: string };
  children: { id: string; nickname: string }[];
  storytellers: StorytellerView[];
}

export async function manageStorytellers(store: FamilyStore, actor: Actor | null, childId: string): Promise<ManageStorytellersView> {
  const adultId = requireAdult(actor);
  const state = await store.read();
  if (!isGuardianOf(state, adultId, childId)) throw NOT_GUARDIAN;
  const child = activeChild(state, childId)!;
  const storytellers: StorytellerView[] = [];
  for (const voice of state.voices) {
    const status = storytellerStatus(state, childId, voice.id, store.plan);
    if (!status) continue;
    const owner = state.adults.find((a) => a.id === voice.ownerId)!;
    storytellers.push({
      voiceId: voice.id,
      ownerName: owner.displayName,
      relationship: owner.relationship,
      avatarUrl: owner.avatarUrl,
      tint: owner.tint,
      status,
    });
  }
  const order: StorytellerStatus[] = ["approved", "available", "needs_slot", "waiting_for_owner", "processing"];
  storytellers.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status) || a.ownerName.localeCompare(b.ownerName));
  return {
    child: { id: child.id, nickname: child.nickname, tint: child.tint },
    children: state.children
      .filter((c) => c.deletedAt === null && isGuardianOf(state, adultId, c.id))
      .map((c) => ({ id: c.id, nickname: c.nickname })),
    storytellers,
  };
}

/** Approves or removes voices for one child. Approval needs the owner's live share and an active narrator slot. */
export async function setChildApprovals(
  store: FamilyStore,
  actor: Actor | null,
  childId: string,
  changes: { voiceId: string; approved: boolean }[],
  clock: Clock = now,
): Promise<void> {
  const adultId = requireAdult(actor);
  const state = await store.read();
  if (!isGuardianOf(state, adultId, childId)) throw NOT_GUARDIAN;
  const child = activeChild(state, childId)!;
  for (const c of changes) {
    if (c.approved && !activeShare(state, c.voiceId, child.householdId)) {
      throw new PermissionError(409, "waiting_for_owner", "This storyteller hasn't shared their voice with your family yet.");
    }
    if (c.approved && !activeSlot(state, c.voiceId, child.householdId, store.plan)) {
      throw new PermissionError(409, "needs_slot", "Add this storyteller to one of your family's narrator slots first.");
    }
  }
  const at = clock().toISOString();
  await store.write((s) => {
    for (const c of changes) {
      const current = s.approvals.find((a) => a.voiceId === c.voiceId && a.childId === childId && a.revokedAt === null);
      if (c.approved && !current) {
        s.approvals.push({
          id: randomUUID(),
          voiceId: c.voiceId,
          childId,
          approvedBy: adultId,
          approvedAt: at,
          revokedAt: null,
          revokedBy: null,
          revokeReason: null,
        });
        audit(s, adultId, "child_voice_approved", at, { voiceId: c.voiceId, childId });
      } else if (!c.approved && current) {
        current.revokedAt = at;
        current.revokedBy = adultId;
        current.revokeReason = "guardian_removed";
        audit(s, adultId, "child_voice_removed", at, { voiceId: c.voiceId, childId });
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Readli Kids: only approved narrators, checked on every request
// ---------------------------------------------------------------------------

export interface NarratorView {
  voiceId: string;
  name: string;
  avatarUrl: string | null;
  tint: string;
}

/** A child may read their own narrators; a guardian may read them for a child they manage. */
export function requireChildAccess(state: FamilyState, actor: Actor | null, childId: string) {
  if (!actor) throw SIGN_IN;
  if (actor.kind === "child" ? actor.childId !== childId : !isGuardianOf(state, actor.adultId, childId)) {
    throw new PermissionError(403, "not_this_child", "This isn't your bookshelf.");
  }
  if (!activeChild(state, childId)) throw new PermissionError(404, "no_child", "We couldn't find that profile.");
}

export async function narratorsFor(store: FamilyStore, actor: Actor | null, childId: string): Promise<NarratorView[]> {
  const state = await store.read();
  requireChildAccess(state, actor, childId);
  return approvedVoiceIds(state, childId, store.plan).map((voiceId) => {
    const owner = state.adults.find((a) => a.id === readyVoice(state, voiceId)!.ownerId)!;
    return { voiceId, name: owner.displayName, avatarUrl: owner.avatarUrl, tint: owner.tint };
  });
}

export function actorLabel(actor: Actor): string {
  return actor.kind === "adult" ? actor.adultId : `child:${actor.childId}`;
}

// ---------------------------------------------------------------------------
// Household plan: narrator slots, child profiles, concurrent listening
// ---------------------------------------------------------------------------

export function requireHouseholdGuardian(state: FamilyState, actor: Actor | null, householdId: string): string {
  const adultId = requireAdult(actor);
  const ok = state.members.some((m) => m.adultId === adultId && m.householdId === householdId && m.role === "guardian" && m.removedAt === null);
  if (!ok) throw new PermissionError(403, "not_guardian", "Only a parent or guardian in this family can do that.");
  return adultId;
}

/** The first household where this adult is a guardian, for the signed-in dashboard. */
export async function guardianHousehold(store: FamilyStore, actor: Actor | null): Promise<string | null> {
  if (actor?.kind !== "adult") return null;
  const state = await store.read();
  return state.members.find((m) => m.adultId === actor.adultId && m.role === "guardian" && m.removedAt === null)?.householdId ?? null;
}

/**
 * Hides Home's narration notice for this adult, up to the newest notice they saw. Kept per adult, so
 * each parent dismisses it for themselves. It only hides the notice; nothing prepared is touched.
 */
export async function dismissNotices(store: FamilyStore, actor: Actor | null, through: string, clock: Clock = now): Promise<void> {
  const householdId = await guardianHousehold(store, actor);
  if (!householdId || actor?.kind !== "adult") throw new PermissionError(403, "not_allowed", "Only a parent or guardian can do that.");
  const at = clock().toISOString();
  const parsed = Date.parse(through);
  // Never past now, so a notice that arrives later still shows.
  const upTo = Number.isFinite(parsed) && new Date(parsed).toISOString() < at ? new Date(parsed).toISOString() : at;
  await store.write((s) => {
    const m = s.members.find((x) => x.householdId === householdId && x.adultId === actor.adultId && x.removedAt === null);
    if (m && (!m.noticesSeenThrough || m.noticesSeenThrough < upTo)) m.noticesSeenThrough = upTo;
  });
}

/** Starts a family with this grown-up as its first parent or guardian. One family per grown-up for now. */
export async function createHousehold(store: FamilyStore, actor: Actor | null, name: string, clock: Clock = now): Promise<string> {
  const adultId = requireAdult(actor);
  const state = await store.read();
  const existing = state.members.find((m) => m.adultId === adultId && m.role === "guardian" && m.removedAt === null);
  if (existing) return existing.householdId;
  const familyName = name.trim().slice(0, 60);
  if (!familyName) throw new PermissionError(400, "bad_name", "Give your family a name.");
  const id = randomUUID();
  const at = clock().toISOString();
  await store.write((s) => {
    s.households.push({ id, name: familyName });
    s.members.push({ householdId: id, adultId, role: "guardian", joinedAt: at, removedAt: null });
  });
  return id;
}

const DAY = 24 * 60 * 60 * 1000;

/** Releases a household chose itself (not owner revocations) in the last 30 days, from the audit log. */
function releasesLeft(state: FamilyState, householdId: string, plan: PlanConfig, at: string): number {
  const since = new Date(Date.parse(at) - 30 * DAY).toISOString();
  const used = state.audit.filter((e) => e.action === "narrator_released" && e.householdId === householdId && e.at >= since).length;
  return Math.max(0, plan.slotReleasesPer30Days - used);
}

function voiceOwner(state: FamilyState, voiceId: string): string | null {
  return state.voices.find((v) => v.id === voiceId)?.ownerId ?? null;
}

export interface NarratorCard {
  voiceId: string;
  name: string;
  relationship: string;
  avatarUrl: string | null;
  tint: string;
  /** The signed-in adult's own voice, which only they can share. */
  yours?: boolean;
  /** Why a voice isn't in "shared" yet; only set on waiting cards. */
  status?: "processing" | "not_shared" | "stopped_sharing";
}

/** A household member with no voice yet, such as someone who just accepted an invitation. */
export interface JoinedCard {
  adultId: string;
  name: string;
  relationship: string;
  avatarUrl: string | null;
  tint: string;
  yours?: boolean;
}

export interface NarratorSlotsView {
  householdId: string;
  hasPlan: boolean;
  total: number;
  included: number;
  extra: number;
  active: NarratorCard[];
  /** Shared with this family by their owners, not yet in a slot. */
  shared: NarratorCard[];
  /** Household members whose voices aren't shared with this family, the viewer's own included. */
  waiting: NarratorCard[];
  /** Household members who haven't made a voice yet. */
  joined: JoinedCard[];
  releasesLeft: number;
  extraSlotPriceCents: number;
  extraSlotPriceApproved: boolean;
}

function card(state: FamilyState, voiceId: string): NarratorCard {
  const owner = state.adults.find((a) => a.id === voiceOwner(state, voiceId))!;
  return { voiceId, name: owner.displayName, relationship: owner.relationship, avatarUrl: owner.avatarUrl, tint: owner.tint };
}

export async function narratorSlots(store: FamilyStore, actor: Actor | null, householdId: string, clock: Clock = now): Promise<NarratorSlotsView> {
  const state = await store.read();
  const viewerId = requireHouseholdGuardian(state, actor, householdId);
  const plan = store.plan;
  const entitlement = activeEntitlement(state, householdId);
  const live = liveSlots(state, householdId, plan);
  const activeIds = new Set(live.map((a) => a.voiceId));
  const memberVoices = state.voices.filter((v) => v.deletedAt === null && isActiveMember(state, v.ownerId, householdId));
  return {
    householdId,
    hasPlan: entitlement !== null,
    total: narratorSlotCount(state, householdId, plan),
    included: entitlement ? plan.includedNarratorSlots : 0,
    extra: entitlement?.extraNarratorSlots ?? 0,
    active: live.map((a) => card(state, a.voiceId)),
    shared: memberVoices.filter((v) => !activeIds.has(v.id) && activeShare(state, v.id, householdId)).map((v) => card(state, v.id)),
    waiting: memberVoices
      .filter((v) => !activeShare(state, v.id, householdId))
      .map((v) => ({
        ...card(state, v.id),
        ...(v.ownerId === viewerId ? { yours: true } : {}),
        status:
          v.status !== "ready"
            ? ("processing" as const)
            : state.shares.some((x) => x.voiceId === v.id && x.householdId === householdId)
              ? ("stopped_sharing" as const)
              : ("not_shared" as const),
      })),
    joined: state.members
      .filter((m) => m.householdId === householdId && m.removedAt === null && !state.voices.some((v) => v.ownerId === m.adultId && v.deletedAt === null))
      .flatMap((m) => {
        const a = state.adults.find((x) => x.id === m.adultId);
        if (!a) return [];
        return [{ adultId: a.id, name: a.displayName, relationship: a.relationship, avatarUrl: a.avatarUrl, tint: a.tint, ...(a.id === viewerId ? { yours: true } : {}) }];
      }),
    releasesLeft: releasesLeft(state, householdId, plan, clock().toISOString()),
    extraSlotPriceCents: plan.extraSlotPriceCents,
    extraSlotPriceApproved: plan.extraSlotPriceApproved,
  };
}

/**
 * Puts a shared voice into a free narrator slot. Consent alone never activates a voice: the
 * household chooses it here, and each child still needs a guardian's approval afterwards.
 */
export async function activateNarrator(store: FamilyStore, actor: Actor | null, householdId: string, voiceId: string, clock: Clock = now): Promise<void> {
  const state = await store.read();
  const adultId = requireHouseholdGuardian(state, actor, householdId);
  if (!activeEntitlement(state, householdId)) throw new PermissionError(402, "no_family_plan", "Narrators need an active Readli Family plan.");
  if (!activeShare(state, voiceId, householdId)) throw new PermissionError(409, "waiting_for_owner", "This storyteller hasn't shared their voice with your family yet.");
  if (activeSlot(state, voiceId, householdId, store.plan)) return;
  if (liveSlots(state, householdId, store.plan).length >= narratorSlotCount(state, householdId, store.plan)) {
    throw new PermissionError(409, "no_free_slot", "All your narrator slots are in use. Free one up or add a slot.");
  }
  const at = clock().toISOString();
  await store.write((s) => {
    // Drop any stale, over-capacity assignment for this voice before adding the live one.
    for (const a of s.slots) if (a.voiceId === voiceId && a.householdId === householdId && a.releasedAt === null) a.releasedAt = at;
    s.slots.push({ id: randomUUID(), householdId, voiceId, activatedBy: adultId, activatedAt: at, releasedAt: null, releasedBy: null });
    audit(s, adultId, "narrator_activated", at, { voiceId, householdId });
  });
}

/** Frees a slot. Every child's approval for that voice ends, so re-adding it starts off again. */
export async function releaseNarrator(store: FamilyStore, actor: Actor | null, householdId: string, voiceId: string, clock: Clock = now): Promise<void> {
  const state = await store.read();
  const adultId = requireHouseholdGuardian(state, actor, householdId);
  const at = clock().toISOString();
  if (!state.slots.some((a) => a.voiceId === voiceId && a.householdId === householdId && a.releasedAt === null)) return;
  if (releasesLeft(state, householdId, store.plan, at) === 0) {
    throw new PermissionError(429, "too_many_changes", "You've changed narrators a lot this month. Please try again later.");
  }
  await store.write((s) => {
    for (const a of s.slots) {
      if (a.voiceId === voiceId && a.householdId === householdId && a.releasedAt === null) {
        a.releasedAt = at;
        a.releasedBy = adultId;
      }
    }
    const kids = new Set(s.children.filter((c) => c.householdId === householdId).map((c) => c.id));
    for (const a of s.approvals) {
      if (a.voiceId === voiceId && kids.has(a.childId) && a.revokedAt === null) {
        a.revokedAt = at;
        a.revokedBy = adultId;
        a.revokeReason = "slot_released";
      }
    }
    audit(s, adultId, "narrator_released", at, { voiceId, householdId });
  });
}

/**
 * Adds one narrator slot to the household's plan. Payments aren't connected yet, so this records
 * the entitlement directly; checkout will call it once the charge succeeds.
 */
export async function addNarratorSlot(store: FamilyStore, actor: Actor | null, householdId: string, clock: Clock = now): Promise<void> {
  const state = await store.read();
  const adultId = requireHouseholdGuardian(state, actor, householdId);
  if (!activeEntitlement(state, householdId)) throw new PermissionError(402, "no_family_plan", "Extra slots need an active Readli Family plan.");
  const at = clock().toISOString();
  await store.write((s) => {
    const e = activeEntitlement(s, householdId)!;
    e.extraNarratorSlots += 1;
    audit(s, adultId, "narrator_slot_added", at, { householdId, detail: `extra=${e.extraNarratorSlots}` });
  });
}

/**
 * Starts a household's Readli Family entitlement from a subscription, gift or donated membership.
 * Server-only (checkout, gift redemption); never exposed to the browser directly.
 */
export async function grantEntitlement(
  store: FamilyStore,
  householdId: string,
  input: { source: "subscription" | "gift" | "donated" | "trial"; months: number | null; days?: number },
  clock: Clock = now,
): Promise<void> {
  const start = clock();
  const endsAt =
    input.days !== undefined ? new Date(start.getTime() + input.days * DAY).toISOString() : input.months === null ? null : new Date(start.getTime() + input.months * 30 * DAY).toISOString();
  await store.write((s) => {
    const current = activeEntitlement(s, householdId, start.toISOString());
    if (current) {
      // Extend rather than stack; extra slots carry over.
      if (current.endsAt !== null) current.endsAt = endsAt === null ? null : new Date(Date.parse(current.endsAt) + input.months! * 30 * DAY).toISOString();
    } else {
      const firstTime = !s.entitlements.some((e) => e.householdId === householdId);
      s.entitlements.push({ id: randomUUID(), householdId, source: input.source, status: "active", extraNarratorSlots: 0, extraStreams: 0, startsAt: start.toISOString(), endsAt });
      // Welcome credits so a new family can hear a few short stories in their own voices right away.
      if (firstTime && store.plan.welcomePromoCredits > 0) {
        s.creditLots.push({
          id: randomUUID(),
          householdId,
          source: "promotional",
          credits: store.plan.welcomePromoCredits * store.plan.charactersPerCredit,
          grantedAt: start.toISOString(),
          expiresAt: store.plan.welcomePromoDays > 0 ? new Date(start.getTime() + store.plan.welcomePromoDays * DAY).toISOString() : null,
          note: "Welcome credits for your first stories",
        });
      }
    }
    audit(s, "system", "entitlement_granted", start.toISOString(), { householdId, detail: input.source });
  });
}

// Child profiles ------------------------------------------------------------

export interface ChildProfilesView {
  householdId: string;
  max: number;
  children: { id: string; nickname: string; tint: string }[];
}

export async function childProfiles(store: FamilyStore, actor: Actor | null, householdId: string): Promise<ChildProfilesView> {
  const state = await store.read();
  requireHouseholdGuardian(state, actor, householdId);
  return {
    householdId,
    max: store.plan.maxChildProfiles,
    children: state.children.filter((c) => c.householdId === householdId && c.deletedAt === null).map((c) => ({ id: c.id, nickname: c.nickname, tint: c.tint })),
  };
}

const TINTS = ["bg-coral", "bg-sunshine", "bg-mint", "bg-sky", "bg-lavender"];

/** Adds a child profile. Up to the plan's maximum, with no per-child charge. New children have no storytellers. */
export async function createChildProfile(store: FamilyStore, actor: Actor | null, householdId: string, nickname: string, clock: Clock = now): Promise<string> {
  const state = await store.read();
  const adultId = requireHouseholdGuardian(state, actor, householdId);
  const name = nickname.trim().slice(0, 30);
  if (!name) throw new PermissionError(400, "bad_name", "Give the profile a name.");
  // Readli Voice (free contributor) households have no kids profiles.
  if (!activeEntitlement(state, householdId)) throw new PermissionError(402, "no_family_plan", "Kids profiles come with Readli Family.");
  const count = state.children.filter((c) => c.householdId === householdId && c.deletedAt === null).length;
  if (count >= store.plan.maxChildProfiles) {
    throw new PermissionError(409, "child_limit", `Readli Family includes up to ${store.plan.maxChildProfiles} child profiles.`);
  }
  const id = randomUUID();
  const at = clock().toISOString();
  const guardians = state.members.filter((m) => m.householdId === householdId && m.role === "guardian" && m.removedAt === null).map((m) => m.adultId);
  await store.write((s) => {
    s.children.push({ id, householdId, nickname: name, tint: TINTS[count % TINTS.length]!, guardianIds: guardians, deletedAt: null });
    audit(s, adultId, "child_profile_created", at, { childId: id, householdId });
  });
  return id;
}

export async function removeChildProfile(store: FamilyStore, actor: Actor | null, childId: string, clock: Clock = now): Promise<void> {
  const state = await store.read();
  const adultId = requireAdult(actor);
  if (!isGuardianOf(state, adultId, childId)) throw NOT_GUARDIAN;
  const at = clock().toISOString();
  await store.write((s) => {
    const child = s.children.find((c) => c.id === childId)!;
    child.deletedAt = at;
    for (const x of s.sessions) if (x.childId === childId && x.endedAt === null) x.endedAt = at;
    audit(s, adultId, "child_profile_removed", at, { childId, householdId: child.householdId });
  });
}

// Concurrent listening --------------------------------------------------------

export function liveSession(state: FamilyState, childId: string, plan: PlanConfig, at: string): ListeningSession | null {
  return state.sessions.find((x) => x.childId === childId && x.endedAt === null && Date.parse(at) - Date.parse(x.lastSeenAt) < plan.sessionStaleMs) ?? null;
}

export function streamLimit(state: FamilyState, householdId: string, plan: PlanConfig): number {
  const e = activeEntitlement(state, householdId);
  if (!e) return 0;
  return plan.includedConcurrentStreams + (plan.extraStreamsUpgradeEnabled ? e.extraStreams : 0);
}

/**
 * Starts (or refreshes) this child's listening session. Each child has one session; the household
 * can have at most its stream limit playing at once.
 */
export async function startListening(store: FamilyStore, actor: Actor | null, childId: string, clock: Clock = now): Promise<ListeningSession> {
  const state = await store.read();
  requireChildAccess(state, actor, childId);
  const child = activeChild(state, childId)!;
  const at = clock().toISOString();
  const mine = liveSession(state, childId, store.plan, at);
  if (mine) {
    await store.write(() => {
      mine.lastSeenAt = at;
    });
    return mine;
  }
  const playing = state.children
    .filter((c) => c.householdId === child.householdId && c.id !== childId)
    .filter((c) => liveSession(state, c.id, store.plan, at)).length;
  const limit = streamLimit(state, child.householdId, store.plan);
  if (limit === 0) throw new PermissionError(402, "no_family_plan", "Story time needs an active Readli Family plan.");
  if (playing >= limit) {
    throw new PermissionError(
      429,
      "too_many_listeners",
      `Readli Family plays up to ${limit} stories at once, and ${playing} are playing right now. Try again when one finishes.`,
    );
  }
  const session: ListeningSession = { id: randomUUID(), householdId: child.householdId, childId, startedAt: at, lastSeenAt: at, endedAt: null };
  await store.write((s) => {
    for (const x of s.sessions) if (x.childId === childId && x.endedAt === null) x.endedAt = at;
    s.sessions.push(session);
  });
  return session;
}

export async function stopListening(store: FamilyStore, actor: Actor | null, childId: string, clock: Clock = now): Promise<void> {
  const state = await store.read();
  requireChildAccess(state, actor, childId);
  const at = clock().toISOString();
  await store.write((s) => {
    for (const x of s.sessions) if (x.childId === childId && x.endedAt === null) x.endedAt = at;
  });
}

// Each child's own place, narrator and favourites ------------------------------

export async function childBookState(store: FamilyStore, actor: Actor | null, childId: string, bookSlug: string) {
  const state = await store.read();
  requireChildAccess(state, actor, childId);
  const p = state.progress.find((x) => x.childId === childId && x.bookSlug === bookSlug);
  return { sentence: p?.sentence ?? 0, voiceId: p?.voiceId ?? null };
}

export async function saveChildProgress(
  store: FamilyStore,
  actor: Actor | null,
  input: { childId: string; bookSlug: string; sentence: number; voiceId: string | null },
  clock: Clock = now,
): Promise<void> {
  const state = await store.read();
  requireChildAccess(state, actor, input.childId);
  const at = clock().toISOString();
  await store.write((s) => {
    const p = s.progress.find((x) => x.childId === input.childId && x.bookSlug === input.bookSlug);
    if (p) Object.assign(p, { sentence: input.sentence, voiceId: input.voiceId, updatedAt: at });
    else s.progress.push({ ...input, updatedAt: at });
  });
}

export async function childFavorites(store: FamilyStore, actor: Actor | null, childId: string): Promise<string[]> {
  const state = await store.read();
  requireChildAccess(state, actor, childId);
  return state.favorites.filter((f) => f.childId === childId).map((f) => f.bookSlug);
}

export async function setFavorite(store: FamilyStore, actor: Actor | null, childId: string, bookSlug: string, on: boolean): Promise<string[]> {
  const state = await store.read();
  requireChildAccess(state, actor, childId);
  await store.write((s) => {
    s.favorites = s.favorites.filter((f) => !(f.childId === childId && f.bookSlug === bookSlug));
    if (on) s.favorites.push({ childId, bookSlug });
  });
  return childFavorites(store, actor, childId);
}

// Story requests: a child asks, a grown-up decides --------------------------

/** Open requests per child, so a curious child can't flood the grown-ups. */
export const MAX_OPEN_REQUESTS = 10;

/** The books this child has asked for that nobody has dealt with yet. */
export async function childRequests(store: FamilyStore, actor: Actor | null, childId: string): Promise<string[]> {
  const state = await store.read();
  requireChildAccess(state, actor, childId);
  return (state.requests ?? []).filter((r) => r.childId === childId && r.resolvedAt === null).map((r) => r.bookSlug);
}

/**
 * A child asks a grown-up for a book. It only records the wish for the family's grown-ups to see on
 * Family Home; nothing is prepared and no credits are spent until a grown-up chooses to.
 */
export async function requestStory(store: FamilyStore, actor: Actor | null, childId: string, bookSlug: string, clock: Clock = now): Promise<string[]> {
  const state = await store.read();
  requireChildAccess(state, actor, childId);
  const child = activeChild(state, childId);
  if (!child) throw new PermissionError(404, "no_child", "That profile isn't here.");
  const open = (state.requests ?? []).filter((r) => r.childId === childId && r.resolvedAt === null);
  if (!open.some((r) => r.bookSlug === bookSlug)) {
    if (open.length >= MAX_OPEN_REQUESTS) throw new PermissionError(429, "too_many_requests", "You've asked for lots of stories. A grown-up will look at them soon.");
    const at = clock().toISOString();
    await store.write((s) => {
      s.requests = [...(s.requests ?? []), { id: randomUUID(), householdId: child.householdId, childId, bookSlug, at, resolvedAt: null }];
    });
  }
  return childRequests(store, actor, childId);
}

/** A parent or guardian of the family clears a request from Family Home. */
export async function dismissStoryRequest(store: FamilyStore, actor: Actor | null, requestId: string, clock: Clock = now): Promise<void> {
  const state = await store.read();
  const request = (state.requests ?? []).find((r) => r.id === requestId);
  if (!request) throw new PermissionError(404, "no_request", "That request isn't here any more.");
  requireHouseholdGuardian(state, actor, request.householdId);
  const at = clock().toISOString();
  await store.write((s) => {
    const r = (s.requests ?? []).find((x) => x.id === requestId);
    if (r && r.resolvedAt === null) r.resolvedAt = at;
  });
}
