import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cleanRelationship, INVITE_TTL_DAYS, type FamilyInvite, type InviteRole, type InviteStatus } from "./family-invites";

/**
 * Family invitations for real accounts (household_invitations, migration 000500). The link carries a
 * random token; only its hash is stored. Accepting runs accept_household_invitation, which adds one
 * 'member' row and nothing else: no voice share, no child approval, no plan. A co-parent invitation
 * (role 'guardian', migration 20261029000100) adds a parent instead, guardian of every child.
 */
export class InviteError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const hashInviteToken = (token: string) => createHash("sha256").update(token).digest("hex");

export function newInviteToken(): string {
  return randomBytes(24).toString("base64url");
}

/** The invitee's join page; it keeps the invitation through sign-in. */
export function inviteLink(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}/voice/join?invite=${encodeURIComponent(token)}`;
}

type Row = Record<string, unknown>;

async function q<T = Row[]>(p: PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>, what: string): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return (data ?? []) as T;
}

export function statusOf(row: Row, now = new Date()): InviteStatus {
  if (row.revoked_at) return "withdrawn";
  if (row.accepted_at) return "joined_no_voice";
  if (row.declined_at || row.reported_at) return "declined";
  if (new Date(row.expires_at as string) <= now) return "expired";
  return "invited";
}

/** maxResends: how many times an emailed invitation may be sent again, or null when email is off here. */
function toInvite(row: Row, now = new Date(), maxResends: number | null = null): FamilyInvite {
  const status = statusOf(row, now);
  const sentCount = Number(row.sent_count ?? 0);
  return {
    id: row.id as string,
    role: row.invitee_role === "guardian" ? "guardian" : "member",
    name: row.invitee_name as string,
    relationship: (row.relationship_label as string | null) ?? "",
    email: null,
    status,
    createdAt: new Date(row.created_at as string),
    expiresAt: row.expires_at as string,
    emailed: sentCount > 0,
    canResend: maxResends !== null && Boolean(row.recipient_email_encrypted) && (status === "invited" || status === "expired") && sentCount <= maxResends,
  };
}

/** A family's invitations of one kind: storytellers by default, or co-parents. */
export async function listInvites(
  db: SupabaseClient,
  householdId: string,
  opts: { maxResends?: number | null; now?: Date; role?: InviteRole } = {},
): Promise<FamilyInvite[]> {
  const rows = await q(
    db.from("household_invitations").select("*").eq("household_id", householdId).order("created_at", { ascending: false }).limit(50),
    "read invitations",
  );
  const role = opts.role ?? "member";
  return rows.map((r) => toInvite(r, opts.now, opts.maxResends ?? null)).filter((i) => (i.role ?? "member") === role);
}

export async function createInvite(
  db: SupabaseClient,
  input: {
    householdId: string;
    inviterId: string;
    name: string;
    relationship: string;
    email?: string;
    emailHash?: string | null;
    emailEncrypted?: string | null;
    role?: InviteRole;
  },
  now = new Date(),
): Promise<{ invite: FamilyInvite; token: string }> {
  const email = input.email?.trim() ?? "";
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new InviteError(400, "bad_email", "Check the email address.");
  // The name is optional when there's an email: the part before the @ stands in until it's set.
  const name = (input.name.trim() || email.split("@")[0] || "").slice(0, 120);
  if (!name) throw new InviteError(400, "name_required", "Add their email or their name.");
  const relationship = cleanRelationship(input.relationship);
  const token = newInviteToken();
  const row = {
    household_id: input.householdId,
    inviter_id: input.inviterId,
    token_hash: hashInviteToken(token),
    invitee_name: name,
    relationship_label: relationship,
    // Only a co-parent invitation sends the column, so storyteller invitations work before its migration.
    ...(input.role === "guardian" ? { invitee_role: "guardian" } : {}),
    recipient_email_hash: email ? (input.emailHash ?? null) : null,
    // Kept (encrypted) only where invitation email is on, so the invitation can be sent and resent.
    ...(email && input.emailEncrypted ? { recipient_email_encrypted: input.emailEncrypted } : {}),
    expires_at: new Date(now.getTime() + INVITE_TTL_DAYS * 86_400_000).toISOString(),
  };
  const [saved] = await q(db.from("household_invitations").insert(row).select("*"), "save invitation");
  return { invite: toInvite(saved!, now), token };
}

/**
 * Changes how the family describes someone they've invited. Only an invitation nobody has accepted yet:
 * after that the label lives on their family membership. Display only; it grants nothing.
 */
export async function setInviteRelationship(db: SupabaseClient, householdId: string, id: string, relationship: unknown): Promise<FamilyInvite> {
  const rows = await q(
    db
      .from("household_invitations")
      .update({ relationship_label: cleanRelationship(relationship) })
      .eq("id", id)
      .eq("household_id", householdId)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .select("*"),
    "save invitation relationship",
  );
  if (rows.length === 0) throw new InviteError(404, "not_found", "That invitation was already accepted or withdrawn.");
  return toInvite(rows[0]!);
}

/** Only an invitation that hasn't been accepted can be withdrawn. */
export async function revokeInvite(db: SupabaseClient, householdId: string, id: string, now = new Date()): Promise<void> {
  const rows = await q(
    db
      .from("household_invitations")
      .update({ revoked_at: now.toISOString() })
      .eq("id", id)
      .eq("household_id", householdId)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .select("id"),
    "withdraw invitation",
  );
  if (rows.length === 0) throw new InviteError(404, "not_found", "That invitation can't be withdrawn.");
}

export interface InviteLanding {
  familyName: string;
  inviterName: string;
  inviteeName: string;
  status: InviteStatus;
  /** A co-parent invitation makes them a parent, not a storyteller. */
  role: InviteRole;
  alreadyMember: boolean;
  /** Only for someone already in the family, so the join page can take them to their next step. */
  householdId: string | null;
}

/** What someone opening a link sees. Never reveals more than the family's name and who invited them. */
export async function inviteForToken(db: SupabaseClient, token: string, userId: string | null, now = new Date()): Promise<InviteLanding | null> {
  if (!token || token.length > 100) return null;
  const [inv] = await q(
    db.from("household_invitations").select("*").eq("token_hash", hashInviteToken(token)).limit(1),
    "read invitation",
  );
  if (!inv) return null;
  const [[home], [inviter], member] = await Promise.all([
    q(db.from("households").select("name").eq("id", inv.household_id as string).limit(1), "read family"),
    q(db.from("adult_profiles").select("display_name").eq("user_id", inv.inviter_id as string).limit(1), "read inviter"),
    userId
      ? q(db.from("household_members").select("user_id, role").eq("household_id", inv.household_id as string).eq("user_id", userId).is("removed_at", null).limit(1), "read membership")
      : Promise.resolve([] as Row[]),
  ]);
  const role: InviteRole = inv.invitee_role === "guardian" ? "guardian" : "member";
  // A storyteller asked to become a co-parent hasn't joined in that role yet.
  const joined = member.length > 0 && (role === "member" || member[0]!.role === "guardian");
  return {
    familyName: (home?.name as string) ?? "A Readli family",
    inviterName: (inviter?.display_name as string) ?? "Your family",
    inviteeName: inv.invitee_name as string,
    status: statusOf(inv, now),
    role,
    alreadyMember: joined,
    householdId: joined ? (inv.household_id as string) : null,
  };
}

export async function acceptInviteToken(db: SupabaseClient, token: string, userId: string): Promise<string> {
  const { data, error } = await db.rpc("accept_household_invitation", { p_token_hash: hashInviteToken(token), p_user: userId });
  if (error) {
    if (/already a parent in another family/.test(error.message)) {
      throw new InviteError(409, "parent_elsewhere", "You're already a parent in another Readli family, and an account can be a parent in only one family for now.");
    }
    if (/already a member/.test(error.message)) throw new InviteError(409, "already_member", "You're already in this family.");
    if (/not valid/.test(error.message)) throw new InviteError(410, "invite_invalid", "This invitation has expired or was already used. Ask for a fresh link.");
    throw new Error(`accept invitation: ${error.message}`);
  }
  return data as string;
}
