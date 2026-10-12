import type { ChildProfile, ChildVoiceApproval, FamilyState, HouseholdEntitlement, NarratorSlotAssignment, PlanTier, VoiceProfile, VoiceShare } from "./model";
import { DEFAULT_PLAN, type PlanConfig } from "./plan";

/**
 * Pure permission checks. Everything that makes new narration for a child goes through
 * childVoiceAccess; playing stories already prepared goes through storedNarrationAccess, which also
 * works for Archive households and for voices their owners have since deleted. The UI only ever
 * renders what these functions allow.
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

export const tierOf = (e: HouseholdEntitlement): PlanTier => e.tier ?? "family";

const liveAt = (e: HouseholdEntitlement, householdId: string, at: string) =>
  e.householdId === householdId && e.status === "active" && e.startsAt <= at && (e.endsAt === null || e.endsAt > at);

/**
 * The household's live plan of either tier: Readli Family, or the Family Archive (subscription,
 * gift, donated, trial or tester). Either one keeps the library, profiles and permissions playing.
 */
export function activeEntitlement(state: FamilyState, householdId: string, at = new Date().toISOString()): HouseholdEntitlement | null {
  return familyEntitlement(state, householdId, at) ?? state.entitlements.find((e) => liveAt(e, householdId, at)) ?? null;
}

/** The household's live Readli Family plan (not the Archive): new stories, credits and narrator slots. */
export function familyEntitlement(state: FamilyState, householdId: string, at = new Date().toISOString()): HouseholdEntitlement | null {
  return state.entitlements.find((e) => liveAt(e, householdId, at) && tierOf(e) === "family") ?? null;
}

/** Narrator slots only matter for making new stories, so the Archive has none. */
export function narratorSlotCount(state: FamilyState, householdId: string, plan: PlanConfig = DEFAULT_PLAN): number {
  const e = familyEntitlement(state, householdId);
  return e ? plan.includedNarratorSlots + e.extraNarratorSlots : 0;
}

/**
 * Slots in use that still count. If the household's slots shrink (an extra slot is cancelled),
 * the earliest activations keep their places and the rest stop working until a slot is free.
 */
export function liveSlots(state: FamilyState, householdId: string, plan: PlanConfig = DEFAULT_PLAN): NarratorSlotAssignment[] {
  return state.slots
    .filter((a) => a.householdId === householdId && a.releasedAt === null && activeShare(state, a.voiceId, householdId))
    .sort((a, b) => a.activatedAt.localeCompare(b.activatedAt))
    .slice(0, narratorSlotCount(state, householdId, plan));
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
  if (!familyEntitlement(state, child.householdId)) return { allowed: false, reason: "no_family_plan" };
  if (!activeSlot(state, voiceId, child.householdId, plan)) return { allowed: false, reason: "not_activated_by_household" };
  if (!activeApproval(state, voiceId, childId, plan)) return { allowed: false, reason: "not_approved_for_child" };
  return { allowed: true, reason: "ok" };
}

/** Voice ids this child may have new stories made in right now. */
export function approvedVoiceIds(state: FamilyState, childId: string, plan: PlanConfig = DEFAULT_PLAN): string[] {
  return state.voices.filter((v) => childVoiceAccess(state, childId, v.id, plan).allowed).map((v) => v.id);
}

/** A voice whose stories may still be played: ready, being re-recorded, or deleted by its owner (withdrawn). */
function keptVoice(state: FamilyState, voiceId: string): VoiceProfile | null {
  return state.voices.find((v) => v.id === voiceId && v.status !== "deleted" && v.deletedAt === null) ?? null;
}

/**
 * The owner's live share with a household, for playing stories already prepared. Deleting a voice
 * doesn't end its shares (the owner turning sharing off does), so a withdrawn voice still counts.
 */
export function storedShare(state: FamilyState, voiceId: string, householdId: string): VoiceShare | null {
  const voice = keptVoice(state, voiceId);
  if (!voice) return null;
  // A deleted account is no longer a member anywhere; its live shares still cover stored stories.
  if (!voice.ownerDeleted && !isActiveMember(state, voice.ownerId, householdId)) return null;
  return (
    state.shares.find((s) => s.voiceId === voiceId && s.householdId === householdId && s.grantedBy === voice.ownerId && live(s)) ??
    null
  );
}

/**
 * May this child play stories already prepared in this voice? Needs the owner's live share, a live
 * Readli Family or Family Archive plan, and a current guardian's approval made after the share began.
 * A ready voice on Readli Family also needs its narrator slot, as before. A withdrawn voice, or any
 * voice on the Archive, doesn't: no new narration can be made there, and playback never needs the
 * provider clone. Only a legally required removal (status "deleted") or the owner turning sharing off
 * stops these stories.
 */
export function storedNarrationAccess(state: FamilyState, childId: string, voiceId: string, plan: PlanConfig = DEFAULT_PLAN): Access {
  const child = activeChild(state, childId);
  if (!child) return { allowed: false, reason: "no_child" };
  const voice = keptVoice(state, voiceId);
  if (!voice) return { allowed: false, reason: "voice_unavailable" };
  const share = storedShare(state, voiceId, child.householdId);
  if (!share) return { allowed: false, reason: "not_shared_by_owner" };
  const membership = activeEntitlement(state, child.householdId);
  if (!membership) return { allowed: false, reason: "no_family_plan" };
  const needsSlot = voice.status === "ready" && tierOf(membership) === "family";
  const slot = needsSlot ? activeSlot(state, voiceId, child.householdId, plan) : null;
  if (needsSlot && !slot) return { allowed: false, reason: "not_activated_by_household" };
  const approved = state.approvals.some(
    (a) =>
      a.voiceId === voiceId &&
      a.childId === childId &&
      live(a) &&
      a.approvedAt >= share.grantedAt &&
      (!slot || a.approvedAt >= slot.activatedAt) &&
      isGuardianOf(state, a.approvedBy, childId),
  );
  return approved ? { allowed: true, reason: "ok" } : { allowed: false, reason: "not_approved_for_child" };
}

/** Voice ids whose prepared stories this child may play right now. */
export function listenableVoiceIds(state: FamilyState, childId: string, plan: PlanConfig = DEFAULT_PLAN): string[] {
  return state.voices.filter((v) => storedNarrationAccess(state, childId, v.id, plan).allowed).map((v) => v.id);
}

/**
 * Parent portal states, in the amendment's suggested language. "stories_only": the owner deleted their
 * voice, so this child keeps the stories already prepared in it but nothing new can be made.
 */
export type StorytellerStatus = "approved" | "available" | "stories_only" | "needs_slot" | "waiting_for_owner" | "processing";

export function storytellerStatus(state: FamilyState, childId: string, voiceId: string, plan: PlanConfig = DEFAULT_PLAN): StorytellerStatus | null {
  const child = activeChild(state, childId);
  const voice = state.voices.find((v) => v.id === voiceId && v.deletedAt === null && v.status !== "deleted");
  if (!child || !voice || !isActiveMember(state, voice.ownerId, child.householdId)) return null;
  if (voice.status === "withdrawn") return storedNarrationAccess(state, childId, voiceId, plan).allowed ? "stories_only" : null;
  if (voice.status === "processing") return "processing";
  if (!activeShare(state, voiceId, child.householdId)) return "waiting_for_owner";
  const archive = !familyEntitlement(state, child.householdId) && activeEntitlement(state, child.householdId) !== null;
  if (!archive && !activeSlot(state, voiceId, child.householdId, plan)) return "needs_slot";
  return storedNarrationAccess(state, childId, voiceId, plan).allowed ? "approved" : "available";
}
