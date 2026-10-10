import type { ChildProfile, ChildVoiceApproval, FamilyState, VoiceProfile, VoiceShare } from "./model";

/**
 * Pure permission checks. Everything that generates, returns or plays a family voice for a child
 * goes through childVoiceAccess; the UI only ever renders what these functions allow.
 */

export type AccessReason =
  | "ok"
  | "no_child"
  | "voice_unavailable"
  | "not_shared_by_owner"
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

/**
 * Key 2: a live approval by a current guardian, made after the current share began. An approval
 * from before the owner last revoked never comes back to life when the owner shares again.
 */
export function activeApproval(state: FamilyState, voiceId: string, childId: string): ChildVoiceApproval | null {
  const child = activeChild(state, childId);
  if (!child) return null;
  const share = activeShare(state, voiceId, child.householdId);
  if (!share) return null;
  return (
    state.approvals.find(
      (a) =>
        a.voiceId === voiceId &&
        a.childId === childId &&
        live(a) &&
        a.approvedAt >= share.grantedAt &&
        isGuardianOf(state, a.approvedBy, childId),
    ) ?? null
  );
}

export function childVoiceAccess(state: FamilyState, childId: string, voiceId: string): Access {
  const child = activeChild(state, childId);
  if (!child) return { allowed: false, reason: "no_child" };
  if (!readyVoice(state, voiceId)) return { allowed: false, reason: "voice_unavailable" };
  if (!activeShare(state, voiceId, child.householdId)) return { allowed: false, reason: "not_shared_by_owner" };
  if (!activeApproval(state, voiceId, childId)) return { allowed: false, reason: "not_approved_for_child" };
  return { allowed: true, reason: "ok" };
}

/** Voice ids this child may hear right now. */
export function approvedVoiceIds(state: FamilyState, childId: string): string[] {
  return state.voices.filter((v) => childVoiceAccess(state, childId, v.id).allowed).map((v) => v.id);
}

/** Parent portal states, in the amendment's suggested language. */
export type StorytellerStatus = "approved" | "available" | "waiting_for_owner" | "processing";

export const STORYTELLER_LABELS: Record<StorytellerStatus, string> = {
  approved: "Approved for",
  available: "Available to your family",
  waiting_for_owner: "Waiting for permission",
  processing: "Voice still being made",
};

export function storytellerStatus(state: FamilyState, childId: string, voiceId: string): StorytellerStatus | null {
  const child = activeChild(state, childId);
  const voice = state.voices.find((v) => v.id === voiceId && v.deletedAt === null);
  if (!child || !voice || !isActiveMember(state, voice.ownerId, child.householdId)) return null;
  if (voice.status === "processing") return "processing";
  if (!activeShare(state, voiceId, child.householdId)) return "waiting_for_owner";
  return activeApproval(state, voiceId, childId) ? "approved" : "available";
}
