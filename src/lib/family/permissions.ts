import type { ChildProfile, ChildVoiceApproval, FamilyState, HouseholdEntitlement, NarratorSlotAssignment, VoiceProfile, VoiceShare } from "./model";
import { DEFAULT_PLAN, type PlanConfig } from "./plan";

/**
 * Pure permission checks. Everything that generates, returns or plays a family voice for a child
 * goes through childVoiceAccess; the UI only ever renders what these functions allow.
 */

export type AccessReason =
  | "ok"
  | "no_child"
  | "voice_unavailable"
  | "not_shared_by_owner"
  | "no_family_plan"
  | "not_activated_by_household"
  | "not_approved_for_child";

export interface Access {
  allowed: boolean;
  reason: AccessReason;
}

const live = <T extends { revokedAt: string | null }>(row: T) => row.revokedAt === null;

export function activeChild(state: FamilyState, childId: string): ChildProfile | null {
  return state.children.find((c) => c.id === childId && c.deletedAt === null) ?? null;
}

export function readyVoice(state: FamilyState, voiceId: string): VoiceProfile | null {
  return state.voices.find((v) => v.id === voiceId && v.status === "ready" && v.deletedAt === null) ?? null;
}

export function isActiveMember(state: FamilyState, adultId: string, householdId: string): boolean {
  return state.members.some((m) => m.adultId === adultId && m.householdId === householdId && m.removedAt === null);
}

export function isGuardianOf(state: FamilyState, adultId: string, childId: string): boolean {
  const child = activeChild(state, childId);
  if (!child || !child.guardianIds.includes(adultId)) return false;
  return state.members.some(
    (m) => m.adultId === adultId && m.householdId === child.householdId && m.role === "guardian" && m.removedAt === null,
  );
}

/** Key 1: a live share, granted by the voice's own owner, who is still in the household. */
export function activeShare(state: FamilyState, voiceId: string, householdId: string): VoiceShare | null {
  const voice = readyVoice(state, voiceId);
  if (!voice || !isActiveMember(state, voice.ownerId, householdId)) return null;
  return (
    state.shares.find((s) => s.voiceId === voiceId && s.householdId === householdId && s.grantedBy === voice.ownerId && live(s)) ??
    null
  );
}

/** The household's live Readli Family entitlement (subscription, gift or donated membership). */
export function activeEntitlement(state: FamilyState, householdId: string, at = new Date().toISOString()): HouseholdEntitlement | null {
  return (
    state.entitlements.find(
      (e) => e.householdId === householdId && e.status === "active" && e.startsAt <= at && (e.endsAt === null || e.endsAt > at),
    ) ?? null
  );
}

/** The plan's limits for this entitlement. A sponsored plan carries its own; every other plan uses the settings. */
export function planLimits(e: HouseholdEntitlement, plan: PlanConfig = DEFAULT_PLAN) {
  return {
    narratorSlots: e.includedNarratorSlots ?? plan.includedNarratorSlots,
    streams: e.includedStreams ?? plan.includedConcurrentStreams,
    childProfiles: e.maxChildProfiles ?? plan.maxChildProfiles,
  };
}

/** Child profiles this household may have now (0 without a plan). */
export function childProfileLimit(state: FamilyState, householdId: string, plan: PlanConfig = DEFAULT_PLAN): number {
  const e = activeEntitlement(state, householdId);
  return e ? planLimits(e, plan).childProfiles : 0;
}

/** Slots the household can fill with storytellers of its choosing. A sponsor's own voice is on top of these. */
export function narratorSlotCount(state: FamilyState, householdId: string, plan: PlanConfig = DEFAULT_PLAN): number {
  const e = activeEntitlement(state, householdId);
  return e ? planLimits(e, plan).narratorSlots + e.extraNarratorSlots : 0;
}

/**
 * While a household's plan is sponsored, the sponsor's own voice comes with it and doesn't use a slot.
 * It still needs the sponsor's share (gate 1) and a guardian's approval for each child (gate 3).
 */
export function sponsorVoiceIncluded(state: FamilyState, voiceId: string, householdId: string): boolean {
  const e = activeEntitlement(state, householdId);
  if (!e || e.source !== "sponsored" || !e.sponsorUserId) return false;
  return state.voices.some((v) => v.id === voiceId && v.ownerId === e.sponsorUserId);
}

/**
 * Slots in use that still count. If the household's slots shrink (an extra slot is cancelled),
 * the earliest activations keep their places and the rest stop working until a slot is free.
 */
export function liveSlots(state: FamilyState, householdId: string, plan: PlanConfig = DEFAULT_PLAN): NarratorSlotAssignment[] {
  const live = state.slots
    .filter((a) => a.householdId === householdId && a.releasedAt === null && activeShare(state, a.voiceId, householdId))
    .sort((a, b) => a.activatedAt.localeCompare(b.activatedAt));
  const included = live.filter((a) => sponsorVoiceIncluded(state, a.voiceId, householdId));
  const counted = live.filter((a) => !included.includes(a)).slice(0, narratorSlotCount(state, householdId, plan));
  return live.filter((a) => included.includes(a) || counted.includes(a));
}

/** Live slots that use up one of the household's own slots (everything but an included sponsor voice). */
export function countedSlots(state: FamilyState, householdId: string, plan: PlanConfig = DEFAULT_PLAN): NarratorSlotAssignment[] {
  return liveSlots(state, householdId, plan).filter((a) => !sponsorVoiceIncluded(state, a.voiceId, householdId));
}

/** Gate 2: the household activated this voice into a narrator slot it is entitled to. */
export function activeSlot(state: FamilyState, voiceId: string, householdId: string, plan: PlanConfig = DEFAULT_PLAN): NarratorSlotAssignment | null {
  return liveSlots(state, householdId, plan).find((a) => a.voiceId === voiceId) ?? null;
}

/**
 * Gate 3: a live approval by a current guardian, made after the current share and slot began. An
 * approval from before the owner last revoked, or before the slot was last released, never comes
 * back to life.
 */
export function activeApproval(state: FamilyState, voiceId: string, childId: string, plan: PlanConfig = DEFAULT_PLAN): ChildVoiceApproval | null {
  const child = activeChild(state, childId);
  if (!child) return null;
  const share = activeShare(state, voiceId, child.householdId);
  const slot = activeSlot(state, voiceId, child.householdId, plan);
  if (!share || !slot) return null;
  return (
    state.approvals.find(
      (a) =>
        a.voiceId === voiceId &&
        a.childId === childId &&
        live(a) &&
        a.approvedAt >= share.grantedAt &&
        a.approvedAt >= slot.activatedAt &&
        isGuardianOf(state, a.approvedBy, childId),
    ) ?? null
  );
}

export function childVoiceAccess(state: FamilyState, childId: string, voiceId: string, plan: PlanConfig = DEFAULT_PLAN): Access {
  const child = activeChild(state, childId);
  if (!child) return { allowed: false, reason: "no_child" };
  if (!readyVoice(state, voiceId)) return { allowed: false, reason: "voice_unavailable" };
  if (!activeShare(state, voiceId, child.householdId)) return { allowed: false, reason: "not_shared_by_owner" };
  if (!activeEntitlement(state, child.householdId)) return { allowed: false, reason: "no_family_plan" };
  if (!activeSlot(state, voiceId, child.householdId, plan)) return { allowed: false, reason: "not_activated_by_household" };
  if (!activeApproval(state, voiceId, childId, plan)) return { allowed: false, reason: "not_approved_for_child" };
  return { allowed: true, reason: "ok" };
}

/** Voice ids this child may hear right now. */
export function approvedVoiceIds(state: FamilyState, childId: string, plan: PlanConfig = DEFAULT_PLAN): string[] {
  return state.voices.filter((v) => childVoiceAccess(state, childId, v.id, plan).allowed).map((v) => v.id);
}

/** Parent portal states, in the amendment's suggested language. */
export type StorytellerStatus = "approved" | "available" | "needs_slot" | "waiting_for_owner" | "processing";

export function storytellerStatus(state: FamilyState, childId: string, voiceId: string, plan: PlanConfig = DEFAULT_PLAN): StorytellerStatus | null {
  const child = activeChild(state, childId);
  const voice = state.voices.find((v) => v.id === voiceId && v.deletedAt === null);
  if (!child || !voice || !isActiveMember(state, voice.ownerId, child.householdId)) return null;
  if (voice.status === "processing") return "processing";
  if (!activeShare(state, voiceId, child.householdId)) return "waiting_for_owner";
  if (!activeSlot(state, voiceId, child.householdId, plan)) return "needs_slot";
  return activeApproval(state, voiceId, childId, plan) ? "approved" : "available";
}
