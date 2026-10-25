import type { SupabaseClient } from "@supabase/supabase-js";
import { familyInviteEmail, invitationEmail } from "@/lib/invitations/email";
import { hashInvitationToken, invitationLinks, invitationSettings, newInvitationToken } from "@/lib/invitations/server";
import { householdRespondToken } from "@/lib/invites/email";
import { hashInviteToken, inviteLink, newInviteToken } from "@/lib/invites/server";
import { findCatalogBook } from "@/lib/library/catalog";
import { ProviderRefCipher } from "@/lib/server/provider-ref";
import { queueEmails, type QueuedEmail } from "./outbox";
import { DEFAULT_TIME_ZONE, sendWindow } from "./policy";
import { preferencesUrl, unsubscribeHeaders } from "./preferences";
import type { SequenceContext } from "./sequences";
import { readliEmail } from "./templates";

/**
 * Invitation reminders (I1, I2) and the parent's heads-up (I3). A reminder goes through the same
 * database function as the parent's or contributor's Resend button, so it counts toward the resend
 * and daily limits, respects "Stop all Readli invitations", and records a send. Readli keeps only a
 * hash of each link, so a reminder carries a fresh link and the old one stops working, exactly like
 * Resend. A link that has expired, or expires within 48 hours, is never sent again.
 *
 * Reminders are only looked for inside send hours, so each one goes out in the same run as its new
 * link is made, never hours later.
 */

type Row = Record<string, unknown>;

async function q<T = Row[]>(p: PromiseLike<{ data: unknown; error: { message: string } | null }>, what: string): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return (data ?? []) as T;
}

const DAY = 86_400_000;
const ago = (now: Date, ms: number) => new Date(now.getTime() - ms).toISOString();

export interface SentReminder {
  outboxId: string;
  dedupeKey: string;
  sends: "household_invitation_sends" | "voice_invitation_sends";
  invitationId: string;
}

/** Which automatic reminder an invitation is due, if any: the first 3 days after the last send, the second from day 7. */
function reminderNumber(inv: Row, queued: Set<string>, prefix: string, now: Date): 1 | 2 | null {
  const age = now.getTime() - new Date(inv.created_at as string).getTime();
  const sinceLast = now.getTime() - new Date((inv.last_sent_at ?? inv.created_at) as string).getTime();
  if (sinceLast < 3 * DAY) return null;
  if (!queued.has(`${prefix}:${inv.id}:1`)) return 1;
  if (!queued.has(`${prefix}:${inv.id}:2`) && age >= 7 * DAY) return 2;
  return null;
}

async function queuedKeys(db: SupabaseClient, prefix: string, ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const keys = ids.flatMap((id) => [`${prefix}:${id}:1`, `${prefix}:${id}:2`]);
  const rows = await q(db.from("email_outbox").select("dedupe_key").in("dedupe_key", keys), "read queued reminders");
  return new Set(rows.map((r) => r.dedupe_key as string));
}

async function displayNames(db: SupabaseClient, ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map();
  const rows = await q(db.from("adult_profiles").select("user_id, display_name").in("user_id", ids), "read names");
  return new Map(rows.map((r) => [r.user_id as string, String(r.display_name ?? "")]));
}

/** I1: a parent's invitation to a storyteller, still waiting. */
async function householdReminders(ctx: SequenceContext, linkDays: number): Promise<{ emails: QueuedEmail[]; sent: Omit<SentReminder, "outboxId">[] }> {
  const { db, now } = ctx;
  const rows = await q(
    db
      .from("household_invitations")
      .select("id, household_id, inviter_id, invitee_name, recipient_email_encrypted, created_at, last_sent_at, expires_at")
      .not("recipient_email_encrypted", "is", null)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .is("declined_at", null)
      .is("reported_at", null)
      .gt("expires_at", new Date(now.getTime() + 2 * DAY).toISOString())
      .lte("created_at", ago(now, 3 * DAY)),
    "read waiting family invitations",
  );
  const queued = await queuedKeys(db, "I1", rows.map((r) => r.id as string));
  const due = rows.map((r) => ({ r, n: reminderNumber(r, queued, "I1", now) })).filter((d) => d.n !== null);
  if (!due.length) return { emails: [], sent: [] };
  const [names, homes] = await Promise.all([
    displayNames(db, due.map((d) => d.r.inviter_id as string)),
    q(db.from("households").select("id, name").in("id", due.map((d) => d.r.household_id as string)), "read families"),
  ]);
  const cipher = new ProviderRefCipher(ctx.secret);
  const emails: QueuedEmail[] = [];
  const sent: Omit<SentReminder, "outboxId">[] = [];
  for (const { r, n } of due) {
    const id = r.id as string;
    const token = newInviteToken();
    const { data, error } = await db.rpc("send_household_invitation", { p_inviter: r.inviter_id, p_invitation: id, p_token_hash: hashInviteToken(token) });
    if (error) throw new Error(`remind family invitation: ${error.message}`);
    if (String(data) !== "sent") continue;
    const respond = householdRespondToken(ctx.secret, id);
    const message = familyInviteEmail({
      inviterName: names.get(r.inviter_id as string) || "Your family",
      familyName: String(homes.find((h) => h.id === r.household_id)?.name ?? "their family"),
      recipientName: String(r.invitee_name ?? ""),
      joinUrl: inviteLink(ctx.base, token),
      declineUrl: `${ctx.base}/v/respond/${respond}?action=decline`,
      unsubscribeUrl: `${ctx.base}/v/respond/${respond}?action=unsubscribe`,
      reportUrl: `${ctx.base}/v/respond/${respond}?action=report`,
      oneClickUnsubscribeUrl: `${ctx.base}/api/invitations/unsubscribe/${respond}`,
      linkDays,
      reminder: true,
    });
    emails.push({ emailId: "I1", dedupeKey: `I1:${id}:${n}`, to: { email: cipher.decrypt(r.recipient_email_encrypted as string) }, householdId: r.household_id as string, message });
    sent.push({ sends: "household_invitation_sends", invitationId: id, dedupeKey: `I1:${id}:${n}` });
  }
  return { emails, sent };
}

/** I2: a contributor's invitation for a family to hear their voice, still waiting. */
async function voiceReminders(ctx: SequenceContext, linkDays: number): Promise<{ emails: QueuedEmail[]; sent: Omit<SentReminder, "outboxId">[] }> {
  const { db, now } = ctx;
  const rows = await q(
    db
      .from("voice_invitations")
      .select("id, contributor_id, preview_id, recipient_name, message, recipient_email_encrypted, created_at, last_sent_at, expires_at")
      .not("recipient_email_encrypted", "is", null)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .is("declined_at", null)
      .is("reported_at", null)
      .gt("expires_at", new Date(now.getTime() + 2 * DAY).toISOString())
      .lte("created_at", ago(now, 3 * DAY)),
    "read waiting voice invitations",
  );
  const queued = await queuedKeys(db, "I2", rows.map((r) => r.id as string));
  const due = rows.map((r) => ({ r, n: reminderNumber(r, queued, "I2", now) })).filter((d) => d.n !== null);
  if (!due.length) return { emails: [], sent: [] };
  const previewIds = due.map((d) => d.r.preview_id).filter((p): p is string => typeof p === "string");
  const [names, previews] = await Promise.all([
    displayNames(db, due.map((d) => d.r.contributor_id as string)),
    previewIds.length ? q(db.from("voice_previews").select("id, book_slug").in("id", previewIds), "read previews") : Promise.resolve([] as Row[]),
  ]);
  const cipher = new ProviderRefCipher(ctx.secret);
  const emails: QueuedEmail[] = [];
  const sent: Omit<SentReminder, "outboxId">[] = [];
  for (const { r, n } of due) {
    const id = r.id as string;
    const token = newInvitationToken();
    const { data, error } = await db.rpc("resend_voice_invitation", { p_contributor: r.contributor_id, p_invitation: id, p_token_hash: hashInvitationToken(token) });
    if (error) throw new Error(`remind voice invitation: ${error.message}`);
    if (String(data) !== "resent") continue;
    const slug = previews.find((p) => p.id === r.preview_id)?.book_slug;
    const message = invitationEmail({
      contributorName: names.get(r.contributor_id as string) || "Someone in your family",
      recipientName: String(r.recipient_name ?? ""),
      message: String(r.message ?? ""),
      bookTitle: typeof slug === "string" ? (findCatalogBook(slug)?.title ?? null) : null,
      linkDays,
      reminder: true,
      ...invitationLinks({ secret: ctx.secret, origin: ctx.base }, id, token),
    });
    emails.push({ emailId: "I2", dedupeKey: `I2:${id}:${n}`, to: { email: cipher.decrypt(r.recipient_email_encrypted as string) }, message });
    sent.push({ sends: "voice_invitation_sends", invitationId: id, dedupeKey: `I2:${id}:${n}` });
  }
  return { emails, sent };
}

/** I3: tells the parent when a storyteller who joined 10 to 14 days ago still hasn't recorded. */
export async function storytellerHeadsUps(ctx: SequenceContext): Promise<QueuedEmail[]> {
  const { db, now } = ctx;
  const rows = await q(
    db.from("household_invitations").select("id, household_id, inviter_id, accepted_by, invitee_name, accepted_at").gte("accepted_at", ago(now, 14 * DAY)).lte("accepted_at", ago(now, 10 * DAY)),
    "read accepted invitations",
  );
  const accepted = rows.filter((r) => typeof r.accepted_by === "string");
  if (!accepted.length) return [];
  const storytellers = accepted.map((r) => r.accepted_by as string);
  const [voices, members, names] = await Promise.all([
    q(db.from("voice_profiles").select("owner_id").in("owner_id", storytellers).in("status", ["processing", "ready"]).is("deleted_at", null), "read voices"),
    q(db.from("household_members").select("household_id, user_id").in("user_id", storytellers).is("removed_at", null), "read members"),
    displayNames(db, [...storytellers, ...accepted.map((r) => r.inviter_id as string)]),
  ]);
  const recorded = new Set(voices.map((v) => v.owner_id as string));
  const stillThere = new Set(members.map((m) => `${m.household_id}:${m.user_id}`));
  return accepted
    .filter((r) => !recorded.has(r.accepted_by as string) && stillThere.has(`${r.household_id}:${r.accepted_by}`))
    .map((r) => {
      const parent = r.inviter_id as string;
      const who = names.get(r.accepted_by as string) || String(r.invitee_name ?? "") || "Your storyteller";
      return {
        emailId: "I3",
        dedupeKey: `I3:${r.id}`,
        to: { userId: parent },
        householdId: r.household_id as string,
        message: readliEmail({
          subject: `${who} hasn't recorded yet`,
          name: (names.get(parent) ?? "").split(/\s+/)[0] ?? "",
          title: `${who} hasn't recorded their voice yet`,
          paragraphs: [`${who} joined your family on Readli but hasn't recorded yet. A friendly nudge from you often helps. Recording is free and takes about three minutes.`],
          cta: { label: "See your storytellers", url: `${ctx.base}/family/narrators` },
          reason: "You're getting this because you invited a storyteller to your family on Readli.",
          preferencesUrl: preferencesUrl(ctx.base, ctx.secret, parent),
          headers: unsubscribeHeaders(ctx.base, ctx.secret, parent, "setup_reminders"),
          stopLabel: "Stop setup reminders",
        }),
      } satisfies QueuedEmail;
    });
}

/** Makes fresh links and queues the reminders due now; returns them so their sends can be marked after delivery. */
export async function queueInvitationReminders(ctx: SequenceContext): Promise<SentReminder[]> {
  const wantI1 = ctx.enabled.has("I1");
  const wantI2 = ctx.enabled.has("I2");
  if (!wantI1 && !wantI2) return [];
  if (sendWindow(ctx.now, DEFAULT_TIME_ZONE).getTime() !== ctx.now.getTime()) return [];
  const { linkDays } = await invitationSettings(ctx.db);
  const out: SentReminder[] = [];
  for (const batch of [wantI1 ? await householdReminders(ctx, linkDays) : null, wantI2 ? await voiceReminders(ctx, linkDays) : null]) {
    if (!batch?.emails.length) continue;
    await queueEmails(ctx.db, ctx.secret, batch.emails, ctx.now);
    const rows = await q(ctx.db.from("email_outbox").select("id, dedupe_key").in("dedupe_key", batch.sent.map((s) => s.dedupeKey)), "read queued reminders");
    for (const s of batch.sent) {
      const row = rows.find((r) => r.dedupe_key === s.dedupeKey);
      if (row) out.push({ ...s, outboxId: row.id as string });
    }
  }
  return out;
}

/** After the outbox has run: marks each reminder's recorded send as sent or failed. */
export async function recordReminderDeliveries(db: SupabaseClient, reminders: SentReminder[]): Promise<void> {
  if (!reminders.length) return;
  const rows = await q(db.from("email_outbox").select("id, status, provider_ref").in("id", reminders.map((r) => r.outboxId)), "read reminder delivery");
  for (const r of reminders) {
    const row = rows.find((x) => x.id === r.outboxId);
    if (!row || (row.status !== "sent" && row.status !== "failed" && row.status !== "suppressed")) continue;
    const [send] = await q(db.from(r.sends).select("id").eq("invitation_id", r.invitationId).eq("delivery", "queued").order("sent_at", { ascending: false }).limit(1), "read send");
    if (send) await q(db.from(r.sends).update({ delivery: row.status === "sent" ? "sent" : "failed", provider_message_id: (row.provider_ref as string | null) ?? null }).eq("id", send.id as number), "record send");
  }
}
