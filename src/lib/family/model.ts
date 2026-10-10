/**
 * Family voice permission model (Amendment 002, Family Voice Permissions & Parent Approval).
 *
 * Two independent keys must both be valid before a child can hear a family voice:
 *   1. the voice owner shares it with the child's household (VoiceShare), and
 *   2. a guardian of that child approves it for that child's profile (ChildVoiceApproval).
 * A family-tree connection, household membership or relationship label grants nothing.
 * Every record keeps its revocation timestamp instead of being deleted, so access is auditable.
 */

export type MemberRole = "guardian" | "member";
export type VoiceStatus = "processing" | "ready" | "deleted";

export interface Household {
  id: string;
  name: string;
}

export interface Adult {
  id: string;
  displayName: string;
  /** Display-only relationship label from the family tree (Amendment 001 F-8). Grants nothing. */
  relationship: string;
  avatarUrl: string | null;
  /** Tailwind background class for the initials avatar when there is no selfie. */
  tint: string;
}

export interface HouseholdMember {
  householdId: string;
  adultId: string;
  role: MemberRole;
  joinedAt: string;
  removedAt: string | null;
}

export interface ChildProfile {
  id: string;
  householdId: string;
  nickname: string;
  tint: string;
  /** Adults who manage this child's profile. Must be household guardians. */
  guardianIds: string[];
  deletedAt: string | null;
}

/** Voice ownership and identity. */
export interface VoiceProfile {
  id: string;
  ownerId: string;
  status: VoiceStatus;
  createdAt: string;
  deletedAt: string | null;
}

/** Key 1: the voice owner's consent to share with one household. */
export interface VoiceShare {
  id: string;
  voiceId: string;
  householdId: string;
  grantedBy: string;
  policyVersion: string;
  grantedAt: string;
  revokedAt: string | null;
  revokedBy: string | null;
}

/** Key 2: a guardian's approval of one voice for one child. */
export interface ChildVoiceApproval {
  id: string;
  voiceId: string;
  childId: string;
  approvedBy: string;
  approvedAt: string;
  revokedAt: string | null;
  revokedBy: string | null;
  revokeReason: "guardian_removed" | "owner_revoked" | "voice_deleted" | null;
}

/** Generated narration audio, re-authorized on every fetch. */
export interface NarrationAsset {
  id: string;
  voiceId: string;
  childId: string;
  bookSlug: string;
  sentence: number;
  createdAt: string;
}

export type AuditAction =
  | "voice_shared"
  | "voice_unshared"
  | "child_voice_approved"
  | "child_voice_removed"
  | "narration_authorized"
  | "narration_denied";

export interface AuditEvent {
  id: string;
  at: string;
  actor: string;
  action: AuditAction;
  voiceId: string;
  childId: string | null;
  householdId: string | null;
  detail: string | null;
}

export interface FamilyState {
  households: Household[];
  adults: Adult[];
  members: HouseholdMember[];
  children: ChildProfile[];
  voices: VoiceProfile[];
  shares: VoiceShare[];
  approvals: ChildVoiceApproval[];
  assets: NarrationAsset[];
  audit: AuditEvent[];
}

export type Actor = { kind: "adult"; adultId: string } | { kind: "child"; childId: string };
