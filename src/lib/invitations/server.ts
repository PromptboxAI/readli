import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PREVIEWS_BUCKET } from "@/lib/account/privacy";
import { normalizeGiftCode } from "@/lib/gifting/codes";
import { hashGiftCode } from "@/lib/gifting/codes.server";
import { findCatalogBook } from "@/lib/library/catalog";
import { ProviderRefCipher } from "@/lib/server/provider-ref";
import type { VoiceProvider } from "@/lib/voice/provider";
import { connectedEmail, emailCoverUrl, invitationEmail, type Mailer } from "./email";
import {
  DEFAULT_INVITATION_SETTINGS,
  REPORT_REASONS,
  SETTING_BOUNDS,
  cleanMessage,
  invitationStatus,
  parseRecipients,
  type InvitationSettings,
  type InvitationStatus,
  type ReportReason,
  type SendResult,
} from "./invitations";
import { findPassage } from "./passages";

/**
 * Readli Voice family invitations, server side (migration 20261012000100). Preview links carry a
 * random token stored only as a hash; resending issues a new one. Decline, unsubscribe and report
 * links carry a separate signed id so they keep working from older emails. Recipient addresses are
 * kept encrypted for resends and hashed for suppression; they never reach analytics.
 */
export const INVITE_COOKIE = "readli_voice_invite";
export const SHARE_CONSENT_VERSION = "voice-invitation-2026-10b";
export const SHARE_CONSENT =
  "I agree that each family I invite here may connect my Readli voice. Only these families, and only for the children their parents approve. I'll be told each time a family connects, and I can stop sharing with any family at any time.";
export const ADULTS_CONSENT = "Everyone I'm inviting is 18 or older, and I know them.";

type Row = Record<string, unknown>;

export class InvitationError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly userMessage: string,
  ) {
    super(userMessage);
  }
}

async function q<T = Row[]>(p: PromiseLike<{ data: unknown; error: { message: string } | null }>, what: string): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return (data ?? []) as T;
}

export const newInvitationToken = () => randomBytes(24).toString("base64url");
export const hashInvitationToken = (token: string) => createHash("sha256").update(token).digest("hex");

export function invitationSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  return env.PROVIDER_REF_SECRET ?? env.GUEST_COOKIE_SECRET ?? (env.VOICE_PROVIDER === "stub" ? "readli-dev-only-secret" : null);
}

export function emailHash(secret: string, email: string): string {
  return createHmac("sha256", `readli-email:${secret}`).update(email.trim().toLowerCase()).digest("hex");
}

/** A stable link for decline, unsubscribe and report that survives resends. */
export function respondToken(secret: string, invitationId: string): string {
  return `${invitationId}.${createHmac("sha256", `readli-respond:${secret}`).update(invitationId).digest("base64url").slice(0, 22)}`;
}

export function invitationIdFromRespondToken(secret: string, token: string): string | null {
  const id = token.split(".")[0] ?? "";
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const want = Buffer.from(respondToken(secret, id));
  const got = Buffer.from(token);
  return want.length === got.length && timingSafeEqual(want, got) ? id : null;
}

export function maskEmail(email: string): string {
  const [user = "", domain = ""] = email.split("@");
  return `${user.slice(0, 2)}${"•".repeat(Math.max(1, Math.min(4, user.length - 2)))}@${domain}`;
}

/** Adult-only first-party events. Never an email address, never anything about a child. */
export async function track(db: SupabaseClient, name: string, properties: Row, userId: string | null = null): Promise<void> {
  const { error } = await db.from("analytics_events").insert({ name, user_id: userId, properties });
  if (error) console.error("analytics event failed", name, error.message);
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export function settingsFromRow(row: Row | null): InvitationSettings {
  if (!row) return DEFAULT_INVITATION_SETTINGS;
  const n = (v: unknown, fallback: number) => (Number.isInteger(Number(v)) ? Number(v) : fallback);
  const d = DEFAULT_INVITATION_SETTINGS;
  return {
    sendingEnabled: row.sending_enabled === true,
    maxRecipientsPerSend: n(row.max_recipients_per_send, d.maxRecipientsPerSend),
    maxRecipientsPerDay: n(row.max_recipients_per_day, d.maxRecipientsPerDay),
    maxResends: n(row.max_resends, d.maxResends),
    linkDays: n(row.link_days, d.linkDays),
  };
}

export async function invitationSettings(db: SupabaseClient): Promise<InvitationSettings> {
  const { data, error } = await db.from("voice_invitation_settings").select("*").eq("id", true).maybeSingle();
  return settingsFromRow(error ? null : ((data as Row | null) ?? null));
}

/** Validates an admin's change; returns the error to show, or the row to save. */
export function settingsUpdate(input: Record<string, unknown>): { ok: true; row: Row } | { ok: false; message: string } {
  const row: Row = { sending_enabled: input.sendingEnabled === true || input.sendingEnabled === "on" };
  const columns: Record<keyof typeof SETTING_BOUNDS, string> = {
    maxRecipientsPerSend: "max_recipients_per_send",
    maxRecipientsPerDay: "max_recipients_per_day",
    maxResends: "max_resends",
    linkDays: "link_days",
  };
  for (const [key, [min, max]] of Object.entries(SETTING_BOUNDS) as [keyof typeof SETTING_BOUNDS, [number, number]][]) {
    const v = Number(input[key]);
    if (!Number.isInteger(v) || v < min || v > max) return { ok: false, message: `Choose a whole number from ${min} to ${max}.` };
    row[columns[key]] = v;
  }
  if (Number(row.max_recipients_per_send) > Number(row.max_recipients_per_day)) return { ok: false, message: "The per-send limit can't be higher than the daily limit." };
  return { ok: true, row };
}

// ---------------------------------------------------------------------------
// The contributor's approved preview
// ---------------------------------------------------------------------------

export interface ContributorVoice {
  id: string;
  status: string;
  version: number;
  providerVoiceId: string | null;
}

export interface PreviewDeps {
  provider: VoiceProvider;
  findVoice(ownerId: string): Promise<ContributorVoice | null>;
}

export interface PreviewView {
  id: string;
  book: string;
  passageId: string;
  approved: boolean;
  createdAt: string;
}

export interface ContributorState {
  /** Why this person can't invite yet, or null when they can. */
  blocker: "no_voice" | "voice_processing" | "email_unconfirmed" | null;
  displayName: string;
  approved: PreviewView | null;
  draft: PreviewView | null;
  settings: InvitationSettings;
}

function previewView(r: Row): PreviewView {
  return { id: r.id as string, book: r.book_slug as string, passageId: r.passage_id as string, approved: Boolean(r.approved_at), createdAt: r.created_at as string };
}

async function livePreviews(db: SupabaseClient, ownerId: string, voice: ContributorVoice | null): Promise<Row[]> {
  if (!voice) return [];
  return q(
    db.from("voice_previews").select("id, book_slug, passage_id, approved_at, created_at, voice_version").eq("owner_id", ownerId).is("retired_at", null).eq("voice_version", voice.version).order("created_at", { ascending: false }),
    "read previews",
  );
}

/** Contributors make as many previews as they like (Kevin, 2026-10-12); this only stops a runaway script. */
export const PREVIEWS_PER_HOUR = 20;

async function previewsLastHour(db: SupabaseClient, ownerId: string, now: Date): Promise<number> {
  const rows = await q(db.from("voice_previews").select("id").eq("owner_id", ownerId).gte("created_at", new Date(now.getTime() - 3_600_000).toISOString()), "count previews");
  return rows.length;
}

export async function displayNameOf(db: SupabaseClient, userId: string, fallback = "A Readli storyteller"): Promise<string> {
  const row = await q<Row | null>(db.from("adult_profiles").select("display_name").eq("user_id", userId).maybeSingle(), "read display name");
  const name = typeof row?.display_name === "string" ? row.display_name.replace(/\s+/g, " ").trim().slice(0, 40) : "";
  return name || fallback;
}

async function emailConfirmed(db: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await db.auth.admin.getUserById(userId);
  if (error || !data.user) return false;
  return Boolean(data.user.email_confirmed_at ?? data.user.confirmed_at);
}

export async function contributorState(db: SupabaseClient, deps: PreviewDeps, user: { id: string; name: string }): Promise<ContributorState> {
  const [voice, settings, displayName, confirmed] = await Promise.all([
    deps.findVoice(user.id),
    invitationSettings(db),
    displayNameOf(db, user.id, user.name),
    emailConfirmed(db, user.id),
  ]);
  const previews = await livePreviews(db, user.id, voice);
  const approved = previews.find((p) => p.approved_at);
  const draft = previews.find((p) => !p.approved_at);
  return {
    blocker: !voice ? "no_voice" : voice.status !== "ready" ? "voice_processing" : !confirmed ? "email_unconfirmed" : null,
    displayName,
    approved: approved ? previewView(approved) : null,
    draft: draft ? previewView(draft) : null,
    settings,
  };
}

async function removeStored(db: SupabaseClient, keys: string[]) {
  if (!keys.length) return;
  const { error } = await db.storage.from(PREVIEWS_BUCKET).remove(keys);
  if (error) console.error("remove preview audio failed", error.message);
}

/** Reads the chosen passage in the contributor's own voice and keeps it as a draft for them to approve. */
export async function generatePreview(db: SupabaseClient, deps: PreviewDeps, userId: string, passageId: string, now = new Date()): Promise<PreviewView> {
  const passage = findPassage(passageId);
  if (!passage || !findCatalogBook(passage.book)) throw new InvitationError(400, "bad_passage", "Choose one of the passages.");
  const voice = await deps.findVoice(userId);
  if (!voice?.providerVoiceId || voice.status !== "ready") throw new InvitationError(409, "no_voice", "Record your Readli voice first.");
  if ((await previewsLastHour(db, userId, now)) >= PREVIEWS_PER_HOUR) {
    throw new InvitationError(429, "generation_limit", "You've made a lot of previews in the last hour. Try again a little later.");
  }
  const audio = await deps.provider.synthesize({ voiceId: voice.providerVoiceId, text: passage.text });
  const key = `${userId}/${randomUUID()}.mp3`;
  const { error } = await db.storage.from(PREVIEWS_BUCKET).upload(key, new Blob([audio.audio], { type: audio.contentType }), { contentType: audio.contentType, upsert: false });
  if (error) throw new Error(`upload preview: ${error.message}`);
  const old = await q(db.from("voice_previews").select("id, storage_key").eq("owner_id", userId).is("approved_at", null).is("retired_at", null), "read drafts");
  const row = await q<Row>(
    db
      .from("voice_previews")
      .insert({ owner_id: userId, voice_id: voice.id, voice_version: voice.version, book_slug: passage.book, passage_id: passage.id, characters: passage.text.length, storage_key: key, content_type: audio.contentType })
      .select("id, book_slug, passage_id, approved_at, created_at")
      .single(),
    "save preview",
  );
  if (old.length) {
    await q(db.from("voice_previews").update({ retired_at: now.toISOString() }).in("id", old.map((o) => o.id as string)), "retire drafts");
    await removeStored(db, old.map((o) => o.storage_key as string));
  }
  await track(db, "invite_preview_generated", { book: passage.book, passage: passage.id }, userId);
  return previewView(row);
}

/** The contributor approves their draft; it replaces the preview every invitation plays. */
export async function approvePreview(db: SupabaseClient, deps: PreviewDeps, userId: string, previewId: string, now = new Date()): Promise<PreviewView> {
  const voice = await deps.findVoice(userId);
  const [draft] = await q(db.from("voice_previews").select("*").eq("id", previewId).eq("owner_id", userId).is("retired_at", null).limit(1), "read preview");
  if (!draft || !voice || voice.status !== "ready" || Number(draft.voice_version) !== voice.version) {
    throw new InvitationError(404, "no_preview", "That preview isn't available any more. Make a new one.");
  }
  if (draft.approved_at) return previewView(draft);
  const current = await q(db.from("voice_previews").select("id, storage_key").eq("owner_id", userId).not("approved_at", "is", null).is("retired_at", null), "read approved preview");
  if (current.length) {
    await q(db.from("voice_previews").update({ retired_at: now.toISOString() }).in("id", current.map((c) => c.id as string)), "retire approved preview");
    await removeStored(db, current.map((c) => c.storage_key as string));
  }
  const row = await q<Row>(db.from("voice_previews").update({ approved_at: now.toISOString() }).eq("id", previewId).select("*").single(), "approve preview");
  await track(db, "invite_preview_approved", { book: row.book_slug, passage: row.passage_id }, userId);
  return previewView(row);
}

/** Retires every preview made from the contributor's voice and deletes its audio (voice or account deletion). */
export async function removePreviews(db: SupabaseClient, ownerId: string, now = new Date()): Promise<void> {
  const rows = await q(db.from("voice_previews").select("id, storage_key").eq("owner_id", ownerId).is("retired_at", null), "read previews");
  if (!rows.length) return;
  await q(db.from("voice_previews").update({ retired_at: now.toISOString() }).in("id", rows.map((r) => r.id as string)), "retire previews");
  await removeStored(db, rows.map((r) => r.storage_key as string));
}

/** A short-lived link to a preview's audio. */
export async function previewAudioUrl(db: SupabaseClient, storageKey: string, seconds = 120): Promise<string> {
  const { data, error } = await db.storage.from(PREVIEWS_BUCKET).createSignedUrl(storageKey, seconds);
  if (error || !data?.signedUrl) throw new Error(`sign preview: ${error?.message ?? "no url"}`);
  return data.signedUrl;
}

/** The owner hearing their own draft or approved preview. */
export async function ownPreviewAudioUrl(db: SupabaseClient, userId: string, previewId: string): Promise<string | null> {
  const [row] = await q(db.from("voice_previews").select("storage_key").eq("id", previewId).eq("owner_id", userId).is("retired_at", null).limit(1), "read preview");
  return row ? previewAudioUrl(db, row.storage_key as string) : null;
}

/** The contributor's current approved preview, if it still matches their voice. Gift emails reuse it too. */
export async function approvedPreviewFor(db: SupabaseClient, contributorId: string): Promise<Row | null> {
  const [voice] = await q(db.from("voice_profiles").select("id, version, status").eq("owner_id", contributorId).neq("status", "deleted").order("created_at", { ascending: false }).limit(1), "read voice");
  if (!voice || voice.status !== "ready") return null;
  const [row] = await q(
    db.from("voice_previews").select("*").eq("owner_id", contributorId).eq("voice_version", Number(voice.version)).not("approved_at", "is", null).is("retired_at", null).limit(1),
    "read approved preview",
  );
  return row ?? null;
}

// ---------------------------------------------------------------------------
// Sending, resending and withdrawing
// ---------------------------------------------------------------------------

export interface SendContext {
  secret: string;
  origin: string;
  mailer: Mailer | null;
}

export interface SendInput {
  recipients: unknown;
  message: unknown;
  adultsConfirmed: boolean;
  shareConsent: boolean;
}

export function invitationLinks(ctx: { secret: string; origin: string }, invitationId: string, token: string) {
  const base = ctx.origin.replace(/\/$/, "");
  const respond = respondToken(ctx.secret, invitationId);
  return {
    previewUrl: `${base}/v/${token}`,
    declineUrl: `${base}/v/respond/${respond}?action=decline`,
    unsubscribeUrl: `${base}/v/respond/${respond}?action=unsubscribe`,
    reportUrl: `${base}/v/respond/${respond}?action=report`,
    oneClickUnsubscribeUrl: `${base}/api/invitations/unsubscribe/${respond}`,
  };
}

async function deliver(db: SupabaseClient, ctx: SendContext, invitation: { id: string; email: string; name: string; message: string; token: string }, sender: { name: string; book: string | null }, linkDays: number): Promise<boolean> {
  const email = invitationEmail({
    contributorName: sender.name,
    recipientName: invitation.name,
    message: invitation.message,
    bookTitle: sender.book ? (findCatalogBook(sender.book)?.title ?? null) : null,
    coverUrl: emailCoverUrl(ctx.origin, sender.book),
    linkDays,
    ...invitationLinks(ctx, invitation.id, invitation.token),
  });
  let delivery: "sent" | "failed" = "sent";
  let providerId: string | null = null;
  try {
    providerId = (await ctx.mailer!.send({ ...email, to: invitation.email })).id;
  } catch (err) {
    console.error("invitation email failed", invitation.id, err);
    delivery = "failed";
  }
  const [send] = await q(db.from("voice_invitation_sends").select("id").eq("invitation_id", invitation.id).eq("delivery", "queued").order("sent_at", { ascending: false }).limit(1), "read send");
  if (send) await q(db.from("voice_invitation_sends").update({ delivery, provider_message_id: providerId }).eq("id", send.id as number), "record delivery");
  return delivery === "sent";
}

export interface SendOutcome {
  email: string;
  name: string;
  result: SendResult | "failed";
}

export async function sendInvitations(db: SupabaseClient, ctx: SendContext, deps: PreviewDeps, user: { id: string; name: string }, input: SendInput): Promise<SendOutcome[]> {
  const state = await contributorState(db, deps, user);
  if (!state.settings.sendingEnabled || !ctx.mailer) throw new InvitationError(503, "sending_off", "Sending invitations isn't switched on yet.");
  if (state.blocker) throw new InvitationError(403, state.blocker, "Finish setting up your Readli voice before inviting your family.");
  // The preview is optional: without one, the email and page simply have nothing to play.
  if (!input.adultsConfirmed) throw new InvitationError(400, "adults_only", "Please confirm everyone you're inviting is an adult you know.");
  if (!input.shareConsent) throw new InvitationError(400, "consent_required", "Please agree to share your voice with families who join.");
  const { recipients, problems } = parseRecipients(input.recipients);
  if (problems.length) throw new InvitationError(400, "bad_email", "Check the email addresses.");
  if (!recipients.length) throw new InvitationError(400, "no_recipients", "Add at least one email address.");
  if (recipients.length > state.settings.maxRecipientsPerSend) throw new InvitationError(400, "too_many", `You can invite up to ${state.settings.maxRecipientsPerSend} people at a time.`);
  const message = cleanMessage(input.message);

  const receipt = await q<Row>(
    db
      .from("consent_receipts")
      .insert({ user_id: user.id, policy_version: SHARE_CONSENT_VERSION, purpose: "voice_invitation", adult_owner_declared: true, accepted_fields: { statements: [SHARE_CONSENT, ADULTS_CONSENT], recipients: recipients.length } })
      .select("id")
      .single(),
    "save consent",
  );
  const cipher = new ProviderRefCipher(ctx.secret);
  const prepared = recipients.map((r) => ({ ...r, token: newInvitationToken(), hash: emailHash(ctx.secret, r.email) }));
  const { data, error } = await db.rpc("send_voice_invitations", {
    p_contributor: user.id,
    p_preview: state.approved?.id ?? null,
    p_consent: receipt.id,
    p_recipients: prepared.map((r) => ({ email_hash: r.hash, email_encrypted: cipher.encrypt(r.email), name: r.name, relationship: r.relationship, message, token_hash: hashInvitationToken(r.token) })),
  });
  if (error) {
    if (/switched off/.test(error.message)) throw new InvitationError(503, "sending_off", "Sending invitations isn't switched on yet.");
    if (/too many/.test(error.message)) throw new InvitationError(400, "too_many", `You can invite up to ${state.settings.maxRecipientsPerSend} people at a time.`);
    if (/no approved preview/.test(error.message)) throw new InvitationError(409, "no_preview", "Choose and approve your preview first.");
    throw new Error(`send invitations: ${error.message}`);
  }
  const results = (data ?? []) as { email_hash: string; result: SendResult; id?: string }[];
  const outcomes: SendOutcome[] = [];
  for (const r of prepared) {
    const res = results.find((x) => x.email_hash === r.hash && x.result === "created") ?? results.find((x) => x.email_hash === r.hash);
    let result: SendOutcome["result"] = res?.result ?? "failed";
    if (res?.result === "created" && res.id) {
      const book = state.approved?.book ?? null;
      const ok = await deliver(db, ctx, { id: res.id, email: r.email, name: r.name, message, token: r.token }, { name: state.displayName, book }, state.settings.linkDays);
      if (!ok) result = "failed";
      else await track(db, "invite_sent", { invitation_id: res.id, contributor_id: user.id, book }, user.id);
    }
    outcomes.push({ email: r.email, name: r.name, result });
  }
  return outcomes;
}

const RESEND_MESSAGES: Record<string, string> = {
  switched_off: "Sending invitations isn't switched on yet.",
  not_found: "That invitation isn't yours.",
  closed: "That invitation is finished, so it can't be sent again.",
  suppressed: "This person asked not to get Readli invitations.",
  resend_limit: "You've sent this invitation as many times as you can.",
  daily_limit: "You've reached today's invitation limit. Try again tomorrow.",
};

export async function resendInvitation(db: SupabaseClient, ctx: SendContext, deps: PreviewDeps, user: { id: string; name: string }, invitationId: string): Promise<void> {
  const state = await contributorState(db, deps, user);
  if (!ctx.mailer || !state.settings.sendingEnabled) throw new InvitationError(503, "sending_off", RESEND_MESSAGES.switched_off!);
  const [inv] = await q(db.from("voice_invitations").select("*").eq("id", invitationId).eq("contributor_id", user.id).limit(1), "read invitation");
  if (!inv?.recipient_email_encrypted) throw new InvitationError(404, "not_found", RESEND_MESSAGES.not_found!);
  const token = newInvitationToken();
  const { data, error } = await db.rpc("resend_voice_invitation", { p_contributor: user.id, p_invitation: invitationId, p_token_hash: hashInvitationToken(token) });
  if (error) throw new Error(`resend invitation: ${error.message}`);
  if (data !== "resent") throw new InvitationError(409, String(data), RESEND_MESSAGES[String(data)] ?? "That invitation can't be sent again.");
  const email = new ProviderRefCipher(ctx.secret).decrypt(inv.recipient_email_encrypted as string);
  const ok = await deliver(db, ctx, { id: invitationId, email, name: (inv.recipient_name as string) ?? "", message: (inv.message as string) ?? "", token }, { name: state.displayName, book: state.approved?.book ?? null }, state.settings.linkDays);
  if (!ok) throw new InvitationError(502, "email_failed", "We couldn't send that email just now. Please try again.");
  await track(db, "invite_resent", { invitation_id: invitationId, contributor_id: user.id }, user.id);
}

export async function revokeInvitation(db: SupabaseClient, userId: string, invitationId: string, now = new Date()): Promise<void> {
  const rows = await q(
    db.from("voice_invitations").update({ revoked_at: now.toISOString() }).eq("id", invitationId).eq("contributor_id", userId).is("accepted_at", null).is("revoked_at", null).select("id"),
    "withdraw invitation",
  );
  if (!rows.length) throw new InvitationError(409, "closed", "That invitation can't be withdrawn.");
}

export interface InvitationRow {
  id: string;
  name: string;
  relationship: string;
  email: string;
  status: InvitationStatus;
  sentCount: number;
  lastSentAt: string;
  expiresAt: string;
  canResend: boolean;
  canRevoke: boolean;
}

export async function listInvitations(db: SupabaseClient, secret: string, userId: string, settings: InvitationSettings, now = new Date()): Promise<InvitationRow[]> {
  const rows = await q(db.from("voice_invitations").select("*").eq("contributor_id", userId).order("created_at", { ascending: false }).limit(200), "read invitations");
  const cipher = new ProviderRefCipher(secret);
  return rows.map((r) => {
    const status = invitationStatus(r as never, now);
    let email = "";
    try {
      email = r.recipient_email_encrypted ? maskEmail(cipher.decrypt(r.recipient_email_encrypted as string)) : "";
    } catch {
      email = "";
    }
    const open = status === "pending" || status === "opened" || status === "expired";
    return {
      id: r.id as string,
      name: (r.recipient_name as string | null) ?? "",
      relationship: (r.relationship_label as string | null) ?? "",
      email,
      status,
      sentCount: Number(r.sent_count ?? 1),
      lastSentAt: r.last_sent_at as string,
      expiresAt: r.expires_at as string,
      canResend: open && Number(r.sent_count ?? 1) - 1 < settings.maxResends,
      canRevoke: open,
    };
  });
}

// ---------------------------------------------------------------------------
// The recipient's side
// ---------------------------------------------------------------------------

export interface Landing {
  id: string;
  contributorId: string;
  status: InvitationStatus;
  contributorName: string;
  recipientName: string;
  message: string;
  book: { slug: string; title: string; author: string; coverUrl: string | null } | null;
  hasPreview: boolean;
  expiresAt: string;
  householdId: string | null;
  respondToken: string;
}

async function invitationByToken(db: SupabaseClient, token: string): Promise<Row | null> {
  if (!token || token.length > 100) return null;
  const [row] = await q(db.from("voice_invitations").select("*").eq("token_hash", hashInvitationToken(token)).limit(1), "read invitation");
  return row ?? null;
}

export async function landingFor(db: SupabaseClient, secret: string, token: string, now = new Date()): Promise<Landing | null> {
  const inv = await invitationByToken(db, token);
  if (!inv) return null;
  const contributor = inv.contributor_id as string;
  const [name, preview] = await Promise.all([displayNameOf(db, contributor), approvedPreviewFor(db, contributor)]);
  const book = preview ? findCatalogBook(preview.book_slug as string) : null;
  return {
    id: inv.id as string,
    contributorId: contributor,
    status: invitationStatus(inv as never, now),
    contributorName: name,
    recipientName: (inv.recipient_name as string | null) ?? "",
    message: (inv.message as string | null) ?? "",
    book: book ? { slug: book.slug, title: book.title, author: book.author, coverUrl: book.coverUrl } : null,
    hasPreview: Boolean(preview),
    expiresAt: inv.expires_at as string,
    householdId: (inv.household_id as string | null) ?? null,
    respondToken: respondToken(secret, inv.id as string),
  };
}

const usable = (status: InvitationStatus) => status === "pending" || status === "opened";

/** The preview page was viewed in a browser (a script beacon, not a pixel or a link scanner). */
export async function markOpened(db: SupabaseClient, token: string, now = new Date()): Promise<boolean> {
  const inv = await invitationByToken(db, token);
  if (!inv || !usable(invitationStatus(inv as never, now))) return false;
  if (!inv.opened_at) await q(db.from("voice_invitations").update({ opened_at: now.toISOString() }).eq("id", inv.id as string).is("opened_at", null), "mark opened");
  await track(db, "invite_landing_viewed", { invitation_id: inv.id, contributor_id: inv.contributor_id });
  return true;
}

/** What the invitation page reports as the recipient moves on: listened to the end, or chose a path. */
export const RECIPIENT_EVENTS = {
  audio_completed: "invite_audio_completed",
  family_cta: "invite_family_cta_clicked",
  connect_cta: "invite_connect_cta_clicked",
} as const;

/** Records one recipient event against a usable invitation. Adult-only: the invitation and contributor, nothing about a child. */
export async function recipientEvent(db: SupabaseClient, token: string, event: string, now = new Date()): Promise<boolean> {
  const name = RECIPIENT_EVENTS[event as keyof typeof RECIPIENT_EVENTS];
  if (!name) return false;
  const inv = await invitationByToken(db, token);
  if (!inv || !usable(invitationStatus(inv as never, now))) return false;
  await track(db, name, { invitation_id: inv.id, contributor_id: inv.contributor_id });
  return true;
}

/** A person pressed play: the strongest sign of a human. Returns a short-lived audio link. */
export async function playPreview(db: SupabaseClient, token: string, now = new Date()): Promise<string | null> {
  const inv = await invitationByToken(db, token);
  if (!inv || !usable(invitationStatus(inv as never, now))) return null;
  const preview = await approvedPreviewFor(db, inv.contributor_id as string);
  if (!preview) return null;
  const at = now.toISOString();
  await q(db.from("voice_invitations").update({ played_at: at, opened_at: (inv.opened_at as string | null) ?? at }).eq("id", inv.id as string), "mark played");
  await track(db, "invite_audio_played", { invitation_id: inv.id, contributor_id: inv.contributor_id, book: preview.book_slug });
  return previewAudioUrl(db, preview.storage_key as string);
}

export type InvitationResponse = "decline" | "unsubscribe" | "report";

/** Decline stops this contributor inviting again; unsubscribe and report stop every Readli invitation to the address. */
export async function respond(db: SupabaseClient, secret: string, respondTok: string, action: InvitationResponse, report?: { reason: unknown; details: unknown }, now = new Date()): Promise<boolean> {
  const id = invitationIdFromRespondToken(secret, respondTok);
  if (!id) return false;
  const [inv] = await q(db.from("voice_invitations").select("*").eq("id", id).limit(1), "read invitation");
  if (!inv) return false;
  const at = now.toISOString();
  const suppress = async (reason: string, contributorId: string | null) => {
    const { error } = await db.from("email_suppressions").insert({ email_hash: inv.recipient_email_hash, contributor_id: contributorId, reason, invitation_id: id });
    if (error && !/duplicate|unique/i.test(error.message)) throw new Error(`suppress: ${error.message}`);
  };
  const close: Row = inv.accepted_at ? {} : { declined_at: (inv.declined_at as string | null) ?? at };
  if (action === "decline") {
    await suppress("declined", inv.contributor_id as string);
  } else if (action === "unsubscribe") {
    await suppress("unsubscribed", null);
  } else {
    const reason = typeof report?.reason === "string" && report.reason in REPORT_REASONS ? (report.reason as ReportReason) : "other";
    const details = typeof report?.details === "string" ? report.details.trim().slice(0, 1000) : "";
    await q(db.from("voice_invitation_reports").insert({ invitation_id: id, contributor_id: inv.contributor_id, reason, details: details || null }), "save report");
    await suppress("reported", null);
    close.reported_at = (inv.reported_at as string | null) ?? at;
  }
  if (Object.keys(close).length) await q(db.from("voice_invitations").update(close).eq("id", id), "close invitation");
  await track(db, `invite_${action === "decline" ? "declined" : action === "unsubscribe" ? "unsubscribed" : "reported"}`, { invitation_id: id, contributor_id: inv.contributor_id });
  return true;
}

export type AcceptResult = "accepted" | "invalid" | "expired" | "self" | "not_guardian" | "no_voice";

export const ACCEPT_MESSAGES: Record<Exclude<AcceptResult, "accepted">, string> = {
  invalid: "This invitation isn't available any more.",
  expired: "This invitation has expired. Ask for a new one.",
  self: "This is your own invitation.",
  not_guardian: "Only a parent or guardian of your family can connect a storyteller.",
  no_voice: "This storyteller's voice isn't available right now.",
};

/**
 * A family's parent connects the contributor: they join the family as a pending storyteller. No slot, no
 * child approvals. The contributor is told by email, with a link to manage or stop sharing.
 */
export async function acceptInvitation(db: SupabaseClient, token: string, userId: string, householdId: string, opts: { mailer?: Mailer | null; origin?: string } = {}): Promise<AcceptResult> {
  const before = await invitationByToken(db, token);
  const { data, error } = await db.rpc("accept_voice_invitation", { p_token_hash: hashInvitationToken(token), p_user: userId, p_household: householdId });
  if (error) throw new Error(`accept invitation: ${error.message}`);
  const result = data as AcceptResult;
  if (result === "accepted") {
    await track(db, "invite_accepted", { invitation_id: before?.id, contributor_id: before?.contributor_id, household_id: householdId }, userId);
    // Only the first connection sends the email; opening the link again doesn't.
    if (before && !before.accepted_at && opts.mailer) await tellContributor(db, opts.mailer, opts.origin ?? "https://readli.ai", before.contributor_id as string, householdId);
  }
  return result;
}

async function tellContributor(db: SupabaseClient, mailer: Mailer, origin: string, contributorId: string, householdId: string): Promise<void> {
  try {
    const [{ data }, name, [home]] = await Promise.all([
      db.auth.admin.getUserById(contributorId),
      displayNameOf(db, contributorId, "there"),
      q(db.from("households").select("name").eq("id", householdId).limit(1), "read family"),
    ]);
    const to = data?.user?.email;
    if (!to) return;
    const email = connectedEmail({ contributorName: name, familyName: (home?.name as string) ?? "A family", manageUrl: `${origin.replace(/\/$/, "")}/voice` });
    await mailer.send({ ...email, to });
  } catch (err) {
    console.error("connected email failed", contributorId, err);
  }
}

/**
 * A child in a family that accepted an invitation played a prepared chapter in the storyteller's
 * voice: the invite funnel's last step, noted once per invitation. Nothing about the child is stored.
 */
export async function noteInvitedStoryPlayed(db: SupabaseClient, contributorId: string, householdId: string): Promise<void> {
  const [inv] = await q(db.from("voice_invitations").select("id").eq("contributor_id", contributorId).eq("household_id", householdId).not("accepted_at", "is", null).limit(1), "read invitation for play");
  if (!inv) return;
  const { count } = await db.from("analytics_events").select("id", { count: "exact", head: true }).eq("name", "invite_first_story_played").contains("properties", { invitation_id: inv.id });
  if (count) return;
  await track(db, "invite_first_story_played", { invitation_id: inv.id, contributor_id: contributorId, household_id: householdId });
}

/** The invitation id behind a preview token, for Checkout metadata. */
export async function invitationIdForToken(db: SupabaseClient, token: string): Promise<string | null> {
  return ((await invitationByToken(db, token))?.id as string | undefined) ?? null;
}

/**
 * For the payments webhook. A Checkout carrying invitation_id started a trial ("trial") or a family
 * attributed to a contributor paid ("paid"). Safe to call repeatedly; only the first time counts.
 */
export async function recordInvitationBilling(db: SupabaseClient, input: { invitationId?: string | null; householdId: string; kind: "trial" | "paid" }, now = new Date()): Promise<void> {
  const column = input.kind === "trial" ? "trial_started_at" : "converted_at";
  let query = db.from("voice_invitations").update({ [column]: now.toISOString() }).is(column, null);
  query = input.invitationId ? query.eq("id", input.invitationId) : query.eq("household_id", input.householdId);
  const rows = await q(query.select("id, contributor_id"), "record invitation billing");
  if (input.invitationId) {
    await q(db.from("voice_invitations").update({ household_id: input.householdId }).eq("id", input.invitationId).is("household_id", null), "attribute household");
  }
  for (const r of rows) {
    await track(db, input.kind === "trial" ? "invite_trial_started" : "invite_converted", { invitation_id: r.id, contributor_id: r.contributor_id, household_id: input.householdId });
  }
}

// ---------------------------------------------------------------------------
// Gift pages reuse the giver's approved preview
// ---------------------------------------------------------------------------

/**
 * A gift's personal giver, whose approved preview may play on its page. Complimentary memberships have
 * none: the admin who issued them is not the sender, and their voice must never reach a winner.
 */
async function giftGiver(db: SupabaseClient, code: string): Promise<{ id: string; giverId: string } | null> {
  const normalized = normalizeGiftCode(code);
  if (!normalized) return null;
  const [gift] = await q(db.from("gifts").select("id, giver_id, status, complimentary_for").eq("code_hash", hashGiftCode(normalized)).limit(1), "read gift");
  if (!gift || gift.status === "cancelled" || gift.complimentary_for) return null;
  return { id: gift.id as string, giverId: gift.giver_id as string };
}

export interface GiftPreview {
  giverName: string;
  book: { title: string; coverUrl: string | null };
}

/** What a gift page shows when the giver has an approved Readli voice preview; null otherwise. */
export async function giftPreview(db: SupabaseClient, code: string): Promise<GiftPreview | null> {
  const gift = await giftGiver(db, code);
  const preview = gift ? await approvedPreviewFor(db, gift.giverId) : null;
  const book = preview ? findCatalogBook(preview.book_slug as string) : null;
  if (!gift || !book) return null;
  return { giverName: await displayNameOf(db, gift.giverId), book: { title: book.title, coverUrl: book.coverUrl } };
}

/** The gift's recipient pressed play: a short-lived link to the giver's approved preview. */
export async function playGiftPreview(db: SupabaseClient, code: string): Promise<string | null> {
  const gift = await giftGiver(db, code);
  const preview = gift ? await approvedPreviewFor(db, gift.giverId) : null;
  if (!gift || !preview) return null;
  await track(db, "gift_preview_played", { gift_id: gift.id, contributor_id: gift.giverId, book: preview.book_slug });
  return previewAudioUrl(db, preview.storage_key as string);
}
