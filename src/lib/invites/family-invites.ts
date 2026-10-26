/**
 * Invite Family (PRD F-04, J3; Kevin 2026-10-10).
 * An invitation brings someone into the family circle so they can record their own voice.
 * It never shares a voice and never starts a paid subscription: voice use still needs the
 * voice owner's authorization AND a parent's approval for each child (the permission engine
 * in src/lib/family owns that check).
 */

/** PRD F-04 card statuses, plus expiry for invites nobody opened. */
export type InviteStatus =
  | "invited"
  | "joined_no_voice"
  | "recording"
  | "pending_verification"
  | "ready_shared"
  | "revoked"
  | "expired"
  | "withdrawn"
  | "declined";

export const INVITE_TTL_DAYS = 14;

export const RELATIONSHIPS = [
  "Grandma",
  "Grandpa",
  "Mom",
  "Dad",
  "Aunt",
  "Uncle",
  "Big brother",
  "Big sister",
  "Cousin",
  "Godparent",
  "Caregiver",
  "Family friend",
] as const;

export const RELATIONSHIP_MAX = 40;

/**
 * A family's own words for someone ("Grandma", "Nanny Pat", or nothing at all). Any short text is fine:
 * the list above is only a set of suggestions, so no family shape is assumed. Display only; a label never
 * grants voice access, a narrator slot or a child approval. Empty means no label.
 */
export function cleanRelationship(value: unknown): string | null {
  const text = (typeof value === "string" ? value : "")
    .replace(/[\u0000-\u001f\u007f<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text ? text.slice(0, RELATIONSHIP_MAX).trim() : null;
}

export interface FamilyInvite {
  id: string;
  name: string;
  relationship: string;
  /** Email is optional: an invite can go out as a shared link instead. */
  email: string | null;
  status: InviteStatus;
  createdAt: Date;
  expiresAt?: string;
  /** The invitation went out by email at least once. */
  emailed?: boolean;
  /** It can be emailed again now: email is on here, the address is on file and resends remain. */
  canResend?: boolean;
}

export const INVITE_STATUS: Record<InviteStatus, { label: string; next: string }> = {
  invited: { label: "Invitation sent", next: "Waiting for them to join your family circle." },
  joined_no_voice: { label: "Joined", next: "They're in your circle. Their voice isn't recorded yet." },
  recording: { label: "Recording", next: "They're reading their script now." },
  pending_verification: { label: "Checking their voice", next: "Their recording is being checked." },
  ready_shared: {
    label: "Voice shared with you",
    next: "They said yes. Choose which of your children can hear them.",
  },
  revoked: { label: "Voice not shared", next: "They've chosen not to share their voice right now." },
  expired: { label: "Invitation expired", next: "Send a fresh link whenever you're ready." },
  withdrawn: { label: "Invitation withdrawn", next: "That link no longer works." },
  declined: { label: "Declined", next: "They said no thanks. We won't email them again for your family." },
};

export function isExpired(invite: FamilyInvite, now: Date): boolean {
  return invite.status === "invited" && now.getTime() - invite.createdAt.getTime() > INVITE_TTL_DAYS * 86_400_000;
}

/**
 * Accepting an invitation adds a circle membership and nothing else.
 * No voice grant, no child approval, no subscription: those each need their own explicit step.
 */
export function acceptInvite(invite: FamilyInvite, now: Date) {
  if (invite.status !== "invited" || isExpired(invite, now)) {
    return { ok: false as const, reason: isExpired(invite, now) ? ("expired" as const) : ("not_pending" as const) };
  }
  return {
    ok: true as const,
    invite: { ...invite, status: "joined_no_voice" as const },
    membership: { role: "member" as const, acceptedAt: now },
    voiceGrants: [] as const,
    childApprovals: [] as const,
    subscription: null,
  };
}

/** The message that goes with the link. Plain, warm and clear that nothing is shared yet. */
export function inviteMessage({ from, to, relationship }: { from: string; to: string; relationship: string }): string {
  const greeting = to.trim() || relationship;
  return [
    `Hi ${greeting}! ${from.trim() || "Your family"} would love you to join our family circle on Readli.`,
    "You can record your voice reading a short story, and the kids could hear you read their favourite books.",
    "Your voice stays yours: it's private until you choose to share it, and you can change your mind any time.",
  ].join(" ");
}
