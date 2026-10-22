import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { familyInviteEmail, type Mailer } from "@/lib/invitations/email";
import { REPORT_REASONS, type ReportReason } from "@/lib/invitations/invitations";
import { invitationSettings, track, type InvitationResponse } from "@/lib/invitations/server";
import { ProviderRefCipher } from "@/lib/server/provider-ref";
import { InviteError, hashInviteToken, inviteLink, newInviteToken } from "./server";

/**
 * Email for a family's storyteller invitations (household_invitations, migration 20261022120000), on
 * the same rails as Readli Voice invitations: the same Resend mailer and on/off switch, the same daily
 * and resend limits, the same suppression list, and decline, unsubscribe and report links in every
 * email. The copyable link keeps working whether or not email is on. Addresses are kept encrypted for
 * resends and hashed for suppression; they're never shown back in full.
 */
export interface InviteMailContext {
  secret: string;
  origin: string;
  mailer: Mailer | null;
}

/** What happened to the email: sent, or why it wasn't. The invitation and its link exist either way. */
export type EmailOutcome = "sent" | "off" | "suppressed" | "daily_limit" | "resend_limit" | "closed" | "failed";

export const EMAIL_MESSAGES: Record<Exclude<EmailOutcome, "sent">, string> = {
  off: "Email isn't switched on yet, so share the link yourself.",
  suppressed: "This person asked not to get Readli invitations, so we didn't email them.",
  daily_limit: "You've reached today's email limit. Share the link yourself, or try again tomorrow.",
  resend_limit: "You've emailed this invitation as many times as you can.",
  closed: "That invitation is finished, so it can't be sent again.",
  failed: "We couldn't send the email just now. Share the link yourself, or try again.",
};

type Row = Record<string, unknown>;

async function q<T = Row[]>(p: PromiseLike<{ data: unknown; error: { message: string } | null }>, what: string): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return (data ?? []) as T;
}

const mac = (secret: string, id: string) => createHmac("sha256", `readli-respond-household:${secret}`).update(id).digest("base64url").slice(0, 22);

/** Decline, unsubscribe and report links for a family's invitation. They survive resends. */
export const householdRespondToken = (secret: string, invitationId: string) => `h.${invitationId}.${mac(secret, invitationId)}`;

export function householdInviteIdFromRespondToken(secret: string, token: string): string | null {
  const [kind, id = ""] = token.split(".");
  if (kind !== "h" || !/^[0-9a-f-]{36}$/.test(id)) return null;
  const want = Buffer.from(householdRespondToken(secret, id));
  const got = Buffer.from(token);
  return want.length === got.length && timingSafeEqual(want, got) ? id : null;
}

/** Whether invitation email can go out here: a mailer is configured and an admin switched sending on. */
export async function inviteEmailOn(db: SupabaseClient, mailer: Mailer | null): Promise<{ on: boolean; maxResends: number; linkDays: number }> {
  const settings = await invitationSettings(db);
  return { on: Boolean(mailer) && settings.sendingEnabled, maxResends: settings.maxResends, linkDays: settings.linkDays };
}

export const encryptEmail = (secret: string, email: string) => new ProviderRefCipher(secret).encrypt(email.trim());

/** Records a send (send_household_invitation checks the switch, limits and suppression) and emails it. */
async function sendWithToken(db: SupabaseClient, ctx: InviteMailContext, inviterId: string, invitationId: string, token: string): Promise<EmailOutcome> {
  if (!ctx.mailer) return "off";
  const { data, error } = await db.rpc("send_household_invitation", { p_inviter: inviterId, p_invitation: invitationId, p_token_hash: hashInviteToken(token) });
  if (error) throw new Error(`send invitation: ${error.message}`);
  const result = String(data);
  if (result === "switched_off" || result === "not_found") return "off";
  if (result !== "sent") return (result in EMAIL_MESSAGES ? result : "failed") as EmailOutcome;

  const [inv] = await q(db.from("household_invitations").select("*").eq("id", invitationId).limit(1), "read invitation");
  if (!inv?.recipient_email_encrypted) return "failed";
  const [[home], [inviter], settings] = await Promise.all([
    q(db.from("households").select("name").eq("id", inv.household_id as string).limit(1), "read family"),
    q(db.from("adult_profiles").select("display_name").eq("user_id", inviterId).limit(1), "read inviter"),
    invitationSettings(db),
  ]);
  const base = ctx.origin.replace(/\/$/, "");
  const respond = householdRespondToken(ctx.secret, invitationId);
  const email = familyInviteEmail({
    inviterName: (inviter?.display_name as string) ?? "Your family",
    familyName: (home?.name as string) ?? "their family",
    recipientName: (inv.invitee_name as string) ?? "",
    joinUrl: inviteLink(base, token),
    declineUrl: `${base}/v/respond/${respond}?action=decline`,
    unsubscribeUrl: `${base}/v/respond/${respond}?action=unsubscribe`,
    reportUrl: `${base}/v/respond/${respond}?action=report`,
    oneClickUnsubscribeUrl: `${base}/api/invitations/unsubscribe/${respond}`,
    linkDays: settings.linkDays,
  });
  let delivery: "sent" | "failed" = "sent";
  let providerId: string | null = null;
  try {
    const to = new ProviderRefCipher(ctx.secret).decrypt(inv.recipient_email_encrypted as string);
    providerId = (await ctx.mailer.send({ ...email, to })).id;
  } catch (err) {
    console.error("family invitation email failed", invitationId, err);
    delivery = "failed";
  }
  const [send] = await q(
    db.from("household_invitation_sends").select("id").eq("invitation_id", invitationId).eq("delivery", "queued").order("sent_at", { ascending: false }).limit(1),
    "read send",
  );
  if (send) await q(db.from("household_invitation_sends").update({ delivery, provider_message_id: providerId }).eq("id", send.id as number), "record delivery");
  if (delivery === "sent") await track(db, "family_invite_sent", { invitation_id: invitationId, household_id: inv.household_id, resend: Number(inv.sent_count ?? 1) > 1 }, inviterId);
  return delivery;
}

/** Emails a new invitation with the link the parent already has. */
export function emailNewInvite(db: SupabaseClient, ctx: InviteMailContext, inviterId: string, invitationId: string, token: string): Promise<EmailOutcome> {
  return sendWithToken(db, ctx, inviterId, invitationId, token);
}

/**
 * Sends the invitation again with a fresh link (the old one stops working) and returns that link, so
 * the parent can still share it if the email didn't go.
 */
export async function resendInvite(db: SupabaseClient, ctx: InviteMailContext, householdId: string, inviterId: string, invitationId: string): Promise<{ link: string | null; email: EmailOutcome }> {
  const [inv] = await q(db.from("household_invitations").select("*").eq("id", invitationId).eq("household_id", householdId).limit(1), "read invitation");
  if (!inv?.recipient_email_encrypted) throw new InviteError(404, "not_found", "That invitation has no email address to send to.");
  if (!ctx.mailer) return { link: null, email: "off" };
  const token = newInviteToken();
  const email = await sendWithToken(db, ctx, inviterId, invitationId, token);
  // Only a recorded send rotates the link; otherwise the old one still works.
  return { link: email === "sent" || email === "failed" ? inviteLink(ctx.origin, token) : null, email };
}

/** Decline stops this inviter asking again; unsubscribe and report stop every Readli invitation to the address. */
export async function respondToHouseholdInvite(
  db: SupabaseClient,
  secret: string,
  token: string,
  action: InvitationResponse,
  report?: { reason: unknown; details: unknown },
  now = new Date(),
): Promise<boolean> {
  const id = householdInviteIdFromRespondToken(secret, token);
  if (!id) return false;
  const [inv] = await q(db.from("household_invitations").select("*").eq("id", id).limit(1), "read invitation");
  if (!inv?.recipient_email_hash) return false;
  const at = now.toISOString();
  const suppress = async (reason: string, contributorId: string | null) => {
    const { error } = await db.from("email_suppressions").insert({ email_hash: inv.recipient_email_hash, contributor_id: contributorId, reason });
    if (error && !/duplicate|unique/i.test(error.message)) throw new Error(`suppress: ${error.message}`);
  };
  const close: Row = inv.accepted_at ? {} : { declined_at: (inv.declined_at as string | null) ?? at };
  if (action === "decline") {
    await suppress("declined", inv.inviter_id as string);
  } else if (action === "unsubscribe") {
    await suppress("unsubscribed", null);
  } else {
    const reason = typeof report?.reason === "string" && report.reason in REPORT_REASONS ? (report.reason as ReportReason) : "other";
    const details = typeof report?.details === "string" ? report.details.trim().slice(0, 1000) : "";
    await q(db.from("voice_invitation_reports").insert({ household_invitation_id: id, contributor_id: inv.inviter_id, reason, details: details || null }), "save report");
    await suppress("reported", null);
    close.reported_at = (inv.reported_at as string | null) ?? at;
  }
  if (Object.keys(close).length) await q(db.from("household_invitations").update(close).eq("id", id), "close invitation");
  await track(db, `family_invite_${action === "decline" ? "declined" : action === "unsubscribe" ? "unsubscribed" : "reported"}`, { invitation_id: id, household_id: inv.household_id });
  return true;
}
