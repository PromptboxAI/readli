/**
 * Readli Voice family invitations (Kevin, 2026-10-12): a free contributor with a verified voice
 * invites adult family members by email to hear an approved preview of their voice and start a
 * Readli Family trial. These are separate from the parent-to-storyteller invitations in
 * src/lib/invites. Client-safe: no secrets, no database.
 */

export type InvitationStatus = "pending" | "opened" | "accepted" | "expired" | "declined" | "revoked";

export const INVITATION_STATUS_LABELS: Record<InvitationStatus, string> = {
  pending: "Invitation sent",
  opened: "Opened",
  accepted: "Accepted",
  expired: "Expired",
  declined: "Declined",
  revoked: "Withdrawn",
};

export interface InvitationTimes {
  expires_at: string;
  opened_at?: string | null;
  accepted_at?: string | null;
  declined_at?: string | null;
  revoked_at?: string | null;
  reported_at?: string | null;
}

/** A report reads as a decline to the contributor. "Opened" means the page was visited, never an email pixel. */
export function invitationStatus(row: InvitationTimes, now = new Date()): InvitationStatus {
  if (row.revoked_at) return "revoked";
  if (row.declined_at || row.reported_at) return "declined";
  if (row.accepted_at) return "accepted";
  if (new Date(row.expires_at).getTime() <= now.getTime()) return "expired";
  return row.opened_at ? "opened" : "pending";
}

export interface InvitationSettings {
  sendingEnabled: boolean;
  maxRecipientsPerSend: number;
  maxRecipientsPerDay: number;
  maxResends: number;
  linkDays: number;
}

export const DEFAULT_INVITATION_SETTINGS: InvitationSettings = {
  sendingEnabled: false,
  maxRecipientsPerSend: 10,
  maxRecipientsPerDay: 30,
  maxResends: 3,
  linkDays: 14,
};

export const SETTING_BOUNDS: Record<Exclude<keyof InvitationSettings, "sendingEnabled">, [number, number]> = {
  maxRecipientsPerSend: [1, 50],
  maxRecipientsPerDay: [1, 500],
  maxResends: [0, 10],
  linkDays: [1, 60],
};

export const NAME_MAX = 80;

/** What the contributor says when they don't write their own message (Kevin, 2026-10-21). */
export const DEFAULT_CONTRIBUTOR_MESSAGE = "I've recorded my voice on Readli so I can read stories to your family. Connect my voice to your Readli Family!";
export const RELATIONSHIP_MAX = 40;
export const MESSAGE_MAX = 500;

const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[a-z]{2,}$/i;

export function normalizeEmail(value: unknown): string | null {
  const v = typeof value === "string" ? value.trim().toLowerCase() : "";
  return v.length <= 254 && EMAIL.test(v) ? v : null;
}

const clean = (value: unknown, max: number) =>
  (typeof value === "string" ? value : "")
    .replace(/[\u0000-\u001f\u007f<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

export function cleanMessage(value: unknown): string {
  return (typeof value === "string" ? value : "")
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f<>]/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MESSAGE_MAX);
}

export interface Recipient {
  email: string;
  name: string;
  relationship: string;
}

export type RecipientProblem = { row: number; problem: "email" };

/** Cleans the composer's rows: blank rows are skipped, a bad email is reported, repeats are dropped. */
export function parseRecipients(raw: unknown): { recipients: Recipient[]; problems: RecipientProblem[]; duplicates: number } {
  const rows = Array.isArray(raw) ? raw : [];
  const recipients: Recipient[] = [];
  const problems: RecipientProblem[] = [];
  let duplicates = 0;
  rows.forEach((r, row) => {
    const o = (r ?? {}) as Record<string, unknown>;
    const name = clean(o.name, NAME_MAX);
    const relationship = clean(o.relationship, RELATIONSHIP_MAX);
    const typed = typeof o.email === "string" ? o.email.trim() : "";
    if (!typed && !name && !relationship) return;
    const email = normalizeEmail(typed);
    if (!email) return void problems.push({ row, problem: "email" });
    if (recipients.some((x) => x.email === email)) return void duplicates++;
    recipients.push({ email, name, relationship });
  });
  return { recipients, problems, duplicates };
}

export type SendResult = "created" | "duplicate" | "suppressed" | "already_invited" | "daily_limit";

export const SEND_RESULT_MESSAGES: Record<Exclude<SendResult, "created">, string> = {
  duplicate: "listed twice, so we sent one invitation",
  suppressed: "asked not to get Readli invitations",
  already_invited: "already has an invitation from you",
  daily_limit: "over today's limit. Try again tomorrow",
};

export type ReportReason = "spam" | "dont_know" | "inappropriate" | "other";

export const REPORT_REASONS: Record<ReportReason, string> = {
  dont_know: "I don't know this person",
  spam: "This looks like spam",
  inappropriate: "Something in it is inappropriate",
  other: "Something else",
};
