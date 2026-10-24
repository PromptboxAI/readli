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
  /** What this family calls the member, such as "Mommy". Display only, set by the family's parents. */
  nickname?: string | null;
  /**
   * How this family describes the member, such as "Grandma". Display only and per family (Amendment 001 F-8):
   * the same person can be "Grandma" in one household and "Mom" in another. Grants nothing.
   */
  relationship?: string | null;
  /** Home's narration notice is hidden for this adult up to here (they dismissed it). */
  noticesSeenThrough?: string | null;
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
  /**
   * The reading model this voice narrates with. Kept per voice so a new ElevenLabs model never
   * changes how an existing voice sounds; null means the plan's model.
   */
  modelId?: string | null;
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
  | "entitlement_granted"
  | "credits_purchased";

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
  /** Promotional and purchased credit grants. Monthly subscription credits are derived from the plan. */
  creditLots: CreditLot[];
  ledger: CreditEntry[];
  usage: ProviderUsage[];
  notifications: FamilyNotification[];
  /** Stories a child asked a grown-up to get ready. Optional so states saved before requests existed still load. */
  requests?: StoryRequest[];
  /** Playback URL issues and cache hits, for the admin dashboard. */
  plays: { libraryKey: string; sentenceId: string; householdId: string; childId: string; at: string }[];
}

export type Actor = { kind: "adult"; adultId: string } | { kind: "child"; childId: string };

/** What a Readli Family household has paid for, or been given (gift and donated memberships use the same row). */
export interface HouseholdEntitlement {
  id: string;
  householdId: string;
  /**
   * A trial gives Family access for its days, with the trial narration allowance instead of the monthly one.
   * "tester" is a free Family plan an admin gave a tester household before payments are on.
   */
  source: "subscription" | "gift" | "donated" | "trial" | "tester";
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
  /** The text `sentence` counts in; null for places saved before texts were versioned (resolved on read). */
  textRevision?: string | null;
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
  /** Readli credits reserved per segment when the job was confirmed, and which credit lots paid. */
  reservations: Record<string, CreditDraw[]>;
  status: JobStatus;
  createdAt: string;
  finishedAt: string | null;
}

/** "trial" lots are derived from a trial plan and never stored. */
export type CreditSource = "subscription" | "trial" | "promotional" | "purchased";

/**
 * A grant of Readli credits, in units (characters; see narration/credits.ts). Promotional and
 * purchased lots are stored; each billing month's included credits and a trial's credits are derived
 * lots, so changing the admin allowance applies at once.
 */
export interface CreditLot {
  id: string;
  householdId: string;
  source: CreditSource;
  credits: number;
  grantedAt: string;
  /** Null never expires. */
  expiresAt: string | null;
  note: string;
}

export interface CreditDraw {
  lotId: string;
  credits: number;
}

export type LedgerKind = "reserve" | "commit" | "refund";

/**
 * Household credit ledger, in units (characters). A reserve holds credits from one lot for one sentence
 * of a job; commit records what generation actually used; refund returns the rest to the same lot.
 * Replays and reuse of authorized cached narration never write here.
 */
export interface CreditEntry {
  id: string;
  householdId: string;
  lotId: string;
  kind: LedgerKind;
  credits: number;
  jobId: string | null;
  sentenceId: string | null;
  at: string;
}

/** Provider usage for every generated segment, for the cost model and benchmarks. */
export interface ProviderUsage {
  id: string;
  libraryKey: string;
  sentenceId: string;
  /** The household whose job generated it (new narration per household). */
  householdId: string;
  jobId: string;
  modelId: string;
  /** Exact input characters sent to the provider. */
  characters: number;
  providerCredits: number;
  /** Planning-rate provider cost in dollars (costs.ts); not an invoice price. */
  usd: number;
  /** Tries it took, counting failed ones. */
  attempts: number;
  durationMs: number;
  bytes: number;
  at: string;
}

/** A child asking a grown-up for a book that isn't ready for them. Only a grown-up can prepare it. */
export interface StoryRequest {
  id: string;
  householdId: string;
  childId: string;
  bookSlug: string;
  at: string;
  /** Set when a grown-up dismisses it. A request also stops showing once the book is ready for the child. */
  resolvedAt: string | null;
}

export interface FamilyNotification {
  id: string;
  householdId: string;
  text: string;
  href: string;
  at: string;
  readAt: string | null;
}
