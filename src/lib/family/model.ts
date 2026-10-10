/**
 * Family voice permission model (Amendment 002, Family Voice Permissions & Parent Approval).
 *
 * Three things must all be valid before a child can hear a family voice:
 *   1. the voice owner shares it with the child's household (VoiceShare),
 *   2. the household, on an active Readli Family plan, activates it into a narrator slot
 *      (NarratorSlotAssignment; Signup & Pricing amendment), and
 *   3. a guardian of that child approves it for that child's profile (ChildVoiceApproval).
 * Owner consent and parent approval stay independent; payment and invitations grant nothing.
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
  /** Bumps when the owner replaces their voice; narrations are per version. */
  version: number;
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
  revokeReason: "guardian_removed" | "owner_revoked" | "slot_released" | "voice_deleted" | null;
}

export type AuditAction =
  | "voice_shared"
  | "voice_unshared"
  | "child_voice_approved"
  | "child_voice_removed"
  | "narration_authorized"
  | "narration_denied"
  | "narration_requested"
  | "narration_canceled"
  | "narrator_activated"
  | "narrator_released"
  | "narrator_slot_added"
  | "child_profile_created"
  | "child_profile_removed"
  | "entitlement_granted";

export interface AuditEvent {
  id: string;
  at: string;
  actor: string;
  action: AuditAction;
  voiceId: string | null;
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
  audit: AuditEvent[];
  entitlements: HouseholdEntitlement[];
  slots: NarratorSlotAssignment[];
  sessions: ListeningSession[];
  progress: ChildBookProgress[];
  favorites: { childId: string; bookSlug: string }[];
  libraries: NarrationLibrary[];
  segments: NarrationSegment[];
  jobs: NarrationJob[];
  ledger: CreditEntry[];
  usage: ProviderUsage[];
  notifications: FamilyNotification[];
  /** Playback URL issues and cache hits, for the admin dashboard. */
  plays: { libraryKey: string; sentenceId: string; householdId: string; childId: string; at: string }[];
}

export type Actor = { kind: "adult"; adultId: string } | { kind: "child"; childId: string };

/** What a Readli Family household has paid for, or been given (gift and donated memberships use the same row). */
export interface HouseholdEntitlement {
  id: string;
  householdId: string;
  source: "subscription" | "gift" | "donated";
  status: "active" | "canceled";
  /** Narrator slots bought on top of the plan's included slots. */
  extraNarratorSlots: number;
  /** Future paid upgrade; stays 0 until approved (plan.extraStreamsUpgradeEnabled). */
  extraStreams: number;
  startsAt: string;
  endsAt: string | null;
}

/** The household activating one shared voice into one of its narrator slots. */
export interface NarratorSlotAssignment {
  id: string;
  householdId: string;
  voiceId: string;
  activatedBy: string;
  activatedAt: string;
  releasedAt: string | null;
  releasedBy: string | null;
}

/** One child's listening session; counted against the household's concurrent streams. */
export interface ListeningSession {
  id: string;
  householdId: string;
  childId: string;
  startedAt: string;
  lastSeenAt: string;
  endedAt: string | null;
}

/** Each child's own place, narrator and favourites. */
export interface ChildBookProgress {
  childId: string;
  bookSlug: string;
  sentence: number;
  voiceId: string | null;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Narration libraries (Voice Narration Libraries & Pre-Generation amendment)
// ---------------------------------------------------------------------------

/**
 * One voice's narration of one book text under one generation config. Identified by its key, so
 * every household authorized for the same voice/book/config shares one copy (when licensing allows).
 */
export interface NarrationLibrary {
  key: string;
  voiceId: string;
  voiceVersion: number;
  bookSlug: string;
  edition: string;
  textRevision: string;
  modelId: string;
  configHash: string;
  /** "shared" when cross-household reuse is licensed; otherwise the one household it belongs to. */
  scope: string;
  createdAt: string;
}

export type SegmentStatus = "pending" | "generating" | "ready" | "failed";

/** One stable sentence of narration. Ready only once its audio is stored and readable. */
export interface NarrationSegment {
  libraryKey: string;
  sentenceId: string;
  ordinal: number;
  status: SegmentStatus;
  /** The job that claimed this segment; another household's request never claims it twice. */
  jobId: string | null;
  storageKey: string | null;
  characters: number;
  durationMs: number | null;
  providerCredits: number | null;
  attempts: number;
  error: string | null;
  readyAt: string | null;
}

export type JobScope = "book" | "chapter" | "passage";
export type JobStatus = "queued" | "running" | "done" | "failed" | "canceled";

export interface NarrationJob {
  id: string;
  libraryKey: string;
  householdId: string;
  requestedBy: string;
  scope: JobScope;
  /** Segments this job pays for, in generation order (priority passages first). */
  sentenceIds: string[];
  /** Household narration seconds reserved per segment when the job was confirmed. */
  reservations: Record<string, number>;
  status: JobStatus;
  createdAt: string;
  finishedAt: string | null;
}

export type LedgerKind = "allowance" | "purchase" | "reserve" | "commit" | "refund";

/** Household narration credit ledger, in seconds of new narration. Replays never write here. */
export interface CreditEntry {
  id: string;
  householdId: string;
  period: string;
  kind: LedgerKind;
  seconds: number;
  jobId: string | null;
  sentenceId: string | null;
  at: string;
}

/** Provider usage for every generated segment, for the cost model and benchmarks. */
export interface ProviderUsage {
  id: string;
  libraryKey: string;
  sentenceId: string;
  modelId: string;
  characters: number;
  providerCredits: number;
  durationMs: number;
  bytes: number;
  at: string;
}

export interface FamilyNotification {
  id: string;
  householdId: string;
  text: string;
  href: string;
  at: string;
  readAt: string | null;
}
