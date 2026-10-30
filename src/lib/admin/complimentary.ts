import type { SupabaseClient } from "@supabase/supabase-js";
import { generateGiftCode, hashGiftCode } from "@/lib/gifting/codes.server";
import type { GiftCodeCipher } from "@/lib/gifting/code-cipher";
import type { AdminUser } from "./access";
import {
  COMPLIMENTARY_KINDS,
  COMPLIMENTARY_MONTHS,
  MAX_CODES_PER_BATCH,
  planIdForMonths,
  type ComplimentaryKind,
  type ComplimentaryMonths,
} from "./complimentary-kinds";
import { AdminActionError } from "./tester-plans";

/**
 * Complimentary Readli Family memberships for raffles, auctions, gift baskets, schools, charities and
 * giveaways (Kevin, 2026-10-11, reworked 2026-10-22). They are ordinary gifts (gifts table, redeem_gift)
 * issued in batches: each membership has its own one-time code, QR code and certificate. The sponsor,
 * the event and the recipient are kept apart, and an unknown winner has no name at all.
 *
 * Codes are stored hashed for redemption and encrypted so the same artwork can be downloaded again.
 * Logs and the audit trail name a membership by its certificate label and last 4 characters only.
 */
export interface ComplimentaryRequest {
  requestKey: string;
  months: number;
  sponsor: "readli" | "organization";
  organization?: string;
  occasion: string;
  eventName?: string;
  recipient: "unknown" | "named";
  recipientName?: string;
  recipientEmail?: string;
  count: number;
  message?: string;
  label?: string;
  /** YYYY-MM-DD; the code stops working after that day (UTC). */
  claimBy: string;
}

export interface ValidRequest {
  requestKey: string;
  months: ComplimentaryMonths;
  sponsorName: string;
  sponsorIsReadli: boolean;
  occasion: ComplimentaryKind;
  eventName: string | null;
  recipientName: string | null;
  recipientEmail: string | null;
  count: number;
  message: string | null;
  label: string | null;
  claimBy: string;
}

const clean = (v: string | undefined, max: number) => v?.replace(/\s+/g, " ").trim().slice(0, max) || null;

export function defaultClaimBy(at = new Date()): string {
  return new Date(Date.UTC(at.getUTCFullYear() + 1, at.getUTCMonth(), at.getUTCDate())).toISOString().slice(0, 10);
}

export function validateComplimentary(req: ComplimentaryRequest, at = new Date()): ValidRequest {
  if (!/^[A-Za-z0-9-]{8,80}$/.test(req.requestKey)) throw new AdminActionError("Please reload the page and try again.");
  if (!(COMPLIMENTARY_MONTHS as readonly number[]).includes(req.months)) throw new AdminActionError("Pick 1, 3 or 12 months.");
  const sponsorIsReadli = req.sponsor !== "organization";
  const sponsorName = sponsorIsReadli ? "Readli" : clean(req.organization, 120);
  if (!sponsorName) throw new AdminActionError("Name the organization presenting these memberships.");
  if (!(COMPLIMENTARY_KINDS as readonly string[]).includes(req.occasion)) throw new AdminActionError("Pick the occasion.");
  if (!Number.isInteger(req.count) || req.count < 1 || req.count > MAX_CODES_PER_BATCH) {
    throw new AdminActionError(`Issue between 1 and ${MAX_CODES_PER_BATCH} memberships at a time.`);
  }
  let recipientName: string | null = null;
  let recipientEmail: string | null = null;
  if (req.recipient === "named") {
    recipientName = clean(req.recipientName, 120);
    if (!recipientName) throw new AdminActionError("Add the recipient's name, or choose an unknown winner.");
    if (req.count !== 1) throw new AdminActionError("A named membership is for one person. Issue them one at a time.");
    recipientEmail = clean(req.recipientEmail, 254)?.toLowerCase() ?? null;
    if (recipientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) throw new AdminActionError("That email address doesn't look right.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(req.claimBy)) throw new AdminActionError("Pick a claim-by date.");
  const claimBy = new Date(`${req.claimBy}T23:59:59.000Z`);
  if (Number.isNaN(claimBy.getTime()) || claimBy.getTime() <= at.getTime()) throw new AdminActionError("The claim-by date must be in the future.");
  if (claimBy.getTime() > at.getTime() + 2 * 366 * 86_400_000) throw new AdminActionError("Pick a claim-by date within two years.");
  return {
    requestKey: req.requestKey,
    months: req.months as ComplimentaryMonths,
    sponsorName,
    sponsorIsReadli,
    occasion: req.occasion as ComplimentaryKind,
    eventName: clean(req.eventName, 120),
    recipientName,
    recipientEmail,
    count: req.count,
    message: clean(req.message, 300),
    label: clean(req.label, 120),
    claimBy: claimBy.toISOString(),
  };
}

/** Initials of the event (else the sponsor) for certificate labels: "Mount Elementary Basket Dinner" → "MEB". */
export function batchPrefix(eventName: string | null, sponsorName: string): string {
  const words = (eventName ?? sponsorName).toUpperCase().replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter((w) => w && w !== "THE" && w !== "OF" && w !== "AND");
  const initials = words.map((w) => w[0]).join("").slice(0, 3);
  return initials.length >= 2 ? initials : (words[0] ?? "RL").slice(0, 3).padEnd(2, "X");
}

export function certificateLabel(prefix: string, no: number | null): string {
  return no ? `${prefix}-${String(no).padStart(3, "0")}` : "Earlier code";
}

/** Where a batch's certificates send families: Readli Gives Back donations use /redeem, everything else /claim. */
export function claimPath(program: string | null | undefined): "/redeem" | "/claim" {
  return program === "readli_gives_back" ? "/redeem" : "/claim";
}

/** The claim link. The code rides after #, so it never reaches server logs, analytics or referrers. */
export function claimLink(origin: string, code: string, path: "/redeem" | "/claim" = "/claim"): string {
  return `${origin.replace(/\/$/, "")}${path}#${code}`;
}

const last4 = (code: string) => code.replace(/-/g, "").slice(-4);

/** Issues a batch once per request key: a repeated submit returns the same batch and creates nothing. */
export async function issueComplimentary(
  db: SupabaseClient,
  admin: AdminUser,
  request: ComplimentaryRequest,
  cipher: GiftCodeCipher,
  at = new Date(),
): Promise<{ batchId: string; created: boolean }> {
  const req = validateComplimentary(request, at);
  const prefix = batchPrefix(req.eventName, req.sponsorName);
  const gifts = Array.from({ length: req.count }, (_, i) => {
    const code = generateGiftCode();
    return {
      plan_id: planIdForMonths(req.months),
      code_hash: hashGiftCode(code),
      code_last4: last4(code),
      code_encrypted: cipher.encryptHex(code),
      recipient_name: req.recipientName,
      recipient_email: req.recipientEmail,
      certificate_no: i + 1,
    };
  });
  const batch = {
    request_key: req.requestKey,
    label: req.label,
    prefix,
    sponsor_name: req.sponsorName,
    sponsor_is_readli: req.sponsorIsReadli,
    event_name: req.eventName,
    occasion: req.occasion,
    months: req.months,
    message: req.message,
    claim_by: req.claimBy,
    issued_by: admin.id,
    issued_by_email: admin.email,
  };
  const { data, error } = await db.rpc("issue_complimentary_batch", { p_batch: batch, p_gifts: gifts });
  if (error) throw new Error(`issue complimentary memberships: ${error.message}`);
  const row = (Array.isArray(data) ? data[0] : data) as { batch_id: string; created: boolean } | undefined;
  if (!row) throw new Error("issue complimentary memberships: no batch returned");
  if (row.created) {
    await logAction(db, admin, "complimentary_issued", {
      batch_id: row.batch_id,
      count: req.count,
      months: req.months,
      sponsor: req.sponsorName,
      event: req.eventName,
      occasion: req.occasion,
    });
  }
  return { batchId: row.batch_id, created: row.created };
}

async function logAction(db: SupabaseClient, admin: AdminUser, action: string, detail: Record<string, unknown>) {
  const { error } = await db.from("admin_actions").insert({ admin_id: admin.id, admin_email: admin.email, action, detail });
  if (error) throw new Error(`log admin action: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Reading batches
// ---------------------------------------------------------------------------

export type IssuedStatus = "unclaimed" | "claimed" | "revoked" | "expired";

export interface Batch {
  id: string;
  label: string | null;
  prefix: string;
  sponsorName: string;
  sponsorIsReadli: boolean;
  eventName: string | null;
  occasion: ComplimentaryKind;
  months: number;
  message: string | null;
  claimBy: string;
  createdAt: string;
  /** "readli_gives_back" for a donation approved through /donations. */
  program: string | null;
  /** The organization a donation supports, printed on its certificate. */
  supportingName: string | null;
}

export interface IssuedGift {
  id: string;
  certificate: string;
  last4: string | null;
  status: IssuedStatus;
  recipientName: string | null;
  redeemedAt: string | null;
  revokedAt: string | null;
  replacedBy: string | null;
  /** False for codes issued before downloads existed: only their hash was stored. */
  hasArtwork: boolean;
}

export interface AuditEntry {
  at: string;
  text: string;
}

type Row = Record<string, unknown>;

export function issuedStatus(row: Row, now = new Date()): IssuedStatus {
  if (row.status === "cancelled") return "revoked";
  if (row.redeemed_at || row.status === "active" || row.status === "ended") return "claimed";
  const claimBy = row.claim_by ? new Date(row.claim_by as string) : row.sent_at ? new Date(new Date(row.sent_at as string).getTime() + 365 * 86_400_000) : null;
  if (claimBy && claimBy.getTime() < now.getTime()) return "expired";
  return "unclaimed";
}

const toBatch = (b: Row): Batch => ({
  id: b.id as string,
  label: (b.label as string | null) ?? null,
  prefix: b.prefix as string,
  sponsorName: b.sponsor_name as string,
  sponsorIsReadli: Boolean(b.sponsor_is_readli),
  eventName: (b.event_name as string | null) ?? null,
  occasion: b.occasion as ComplimentaryKind,
  months: Number(b.months),
  message: (b.message as string | null) ?? null,
  claimBy: b.claim_by as string,
  createdAt: b.created_at as string,
  program: (b.program as string | null) ?? null,
  supportingName: (b.supporting_name as string | null) ?? null,
});

const GIFT_COLUMNS = "id, batch_id, certificate_no, code_last4, code_encrypted, status, redeemed_at, revoked_at, replaced_by, claim_by, sent_at, recipient_name";

export async function listBatches(db: SupabaseClient, now = new Date()): Promise<(Batch & { counts: Record<IssuedStatus, number> })[]> {
  const { data, error } = await db.from("complimentary_batches").select("*").order("created_at", { ascending: false }).limit(50);
  if (error) throw new Error(`read batches: ${error.message}`);
  const batches = (data ?? []).map((b) => toBatch(b as Row));
  if (!batches.length) return [];
  const { data: gifts, error: gErr } = await db.from("gifts").select("batch_id, status, redeemed_at, claim_by, sent_at").in("batch_id", batches.map((b) => b.id));
  if (gErr) throw new Error(`read batch gifts: ${gErr.message}`);
  return batches.map((b) => {
    const counts: Record<IssuedStatus, number> = { unclaimed: 0, claimed: 0, revoked: 0, expired: 0 };
    for (const g of (gifts ?? []) as Row[]) if (g.batch_id === b.id) counts[issuedStatus(g, now)] += 1;
    return { ...b, counts };
  });
}

/** Complimentary codes from before batches: hash only, so they can be tracked and revoked but not reprinted. */
export async function earlierCodes(db: SupabaseClient, now = new Date()): Promise<Record<IssuedStatus, number>> {
  const { data, error } = await db.from("gifts").select("status, redeemed_at, claim_by, sent_at").not("complimentary_for", "is", null).is("batch_id", null);
  if (error) throw new Error(`read earlier codes: ${error.message}`);
  const counts: Record<IssuedStatus, number> = { unclaimed: 0, claimed: 0, revoked: 0, expired: 0 };
  for (const g of (data ?? []) as Row[]) counts[issuedStatus(g, now)] += 1;
  return counts;
}

export async function batchDetail(db: SupabaseClient, batchId: string, now = new Date()): Promise<{ batch: Batch; gifts: IssuedGift[]; audit: AuditEntry[] } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(batchId)) return null;
  const { data: b, error } = await db.from("complimentary_batches").select("*").eq("id", batchId).maybeSingle();
  if (error) throw new Error(`read batch: ${error.message}`);
  if (!b) return null;
  const batch = toBatch(b as Row);
  const { data: rows, error: gErr } = await db.from("gifts").select(GIFT_COLUMNS).eq("batch_id", batchId).order("certificate_no", { ascending: true });
  if (gErr) throw new Error(`read batch gifts: ${gErr.message}`);
  const byId = new Map(((rows ?? []) as Row[]).map((r) => [r.id as string, r]));
  const label = (r: Row | undefined) => (r ? certificateLabel(batch.prefix, r.certificate_no as number | null) : null);
  const gifts: IssuedGift[] = ((rows ?? []) as Row[]).map((r) => ({
    id: r.id as string,
    certificate: label(r)!,
    last4: (r.code_last4 as string | null) ?? null,
    status: issuedStatus(r, now),
    recipientName: (r.recipient_name as string | null) ?? null,
    redeemedAt: (r.redeemed_at as string | null) ?? null,
    revokedAt: (r.revoked_at as string | null) ?? null,
    replacedBy: label(byId.get(r.replaced_by as string)),
    hasArtwork: Boolean(r.code_encrypted),
  }));

  const { data: actions, error: aErr } = await db
    .from("admin_actions")
    .select("action, admin_email, detail, created_at")
    .eq("detail->>batch_id", batchId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (aErr) throw new Error(`read audit trail: ${aErr.message}`);
  const audit: AuditEntry[] = ((actions ?? []) as Row[]).map((a) => ({ at: a.created_at as string, text: auditText(a) }));
  for (const g of gifts) if (g.redeemedAt) audit.push({ at: g.redeemedAt, text: `${g.certificate} claimed by a family` });
  audit.sort((x, y) => y.at.localeCompare(x.at));
  return { batch, gifts, audit };
}

function auditText(a: Row): string {
  const d = (a.detail ?? {}) as Row;
  const who = String(a.admin_email ?? "An admin");
  switch (a.action) {
    case "complimentary_issued":
      return `${who} issued ${d.count} ${d.count === 1 ? "membership" : "memberships"}`;
    case "complimentary_revoked":
      return `${who} revoked ${d.certificate} and issued ${d.replacement} as its replacement`;
    case "complimentary_code_revealed":
      return `${who} revealed the code for ${d.certificate}`;
    case "complimentary_artwork_downloaded":
      return `${who} downloaded ${d.what}${d.certificate ? ` for ${d.certificate}` : ""}`;
    default:
      return `${who}: ${String(a.action)}`;
  }
}

// ---------------------------------------------------------------------------
// One membership: its code, revoking and replacing it
// ---------------------------------------------------------------------------

export interface MembershipArtwork {
  giftId: string;
  batch: Batch;
  certificate: string;
  code: string;
  recipientName: string | null;
}

/** The membership's real code and facts, for its QR code and certificate. Null without a stored code. */
export async function membershipArtwork(db: SupabaseClient, cipher: GiftCodeCipher, giftId: string): Promise<MembershipArtwork | null> {
  if (!/^[0-9a-f-]{36}$/i.test(giftId)) return null;
  const { data: g, error } = await db.from("gifts").select(`${GIFT_COLUMNS}, code_hash`).eq("id", giftId).maybeSingle();
  if (error) throw new Error(`read membership: ${error.message}`);
  if (!g || !g.batch_id) return null;
  const code = cipher.decrypt(g.code_encrypted as string | null);
  // The stored hash is the source of truth: artwork is only made for the code that redeems this membership.
  if (!code || hashGiftCode(code) !== g.code_hash) return null;
  const { data: b, error: bErr } = await db.from("complimentary_batches").select("*").eq("id", g.batch_id as string).maybeSingle();
  if (bErr) throw new Error(`read batch: ${bErr.message}`);
  if (!b) return null;
  const batch = toBatch(b as Row);
  return { giftId, batch, certificate: certificateLabel(batch.prefix, g.certificate_no as number | null), code, recipientName: (g.recipient_name as string | null) ?? null };
}

/** Every unrevoked membership in a batch with a stored code, in certificate order. */
export async function batchArtwork(db: SupabaseClient, cipher: GiftCodeCipher, batchId: string): Promise<MembershipArtwork[]> {
  const detail = await batchDetail(db, batchId);
  if (!detail) return [];
  const out: MembershipArtwork[] = [];
  for (const g of detail.gifts) {
    if (g.status === "revoked" || !g.hasArtwork) continue;
    const art = await membershipArtwork(db, cipher, g.id);
    if (art) out.push(art);
  }
  return out;
}

export async function logArtworkDownload(db: SupabaseClient, admin: AdminUser, batchId: string, what: string, certificate?: string) {
  await logAction(db, admin, "complimentary_artwork_downloaded", { batch_id: batchId, what, ...(certificate ? { certificate } : {}) });
}

/** Shows an admin the full code (for "Show full code" and "Copy link"), and records that they saw it. */
export async function revealCode(db: SupabaseClient, admin: AdminUser, cipher: GiftCodeCipher, giftId: string): Promise<{ code: string; certificate: string; program: string | null }> {
  const art = await membershipArtwork(db, cipher, giftId);
  if (!art) throw new AdminActionError("This code was issued before codes could be shown again. Revoke and replace it to get a new one.");
  await logAction(db, admin, "complimentary_code_revealed", { batch_id: art.batch.id, certificate: art.certificate });
  return { code: art.code, certificate: art.certificate, program: art.batch.program };
}

/** Revokes an unclaimed membership and issues a replacement in the same batch, with a new code. */
export async function revokeAndReplace(db: SupabaseClient, admin: AdminUser, cipher: GiftCodeCipher, giftId: string, at = new Date()): Promise<{ certificate: string; replacement: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(giftId)) throw new AdminActionError("That membership wasn't found.");
  const { data: g, error } = await db.from("gifts").select("*").eq("id", giftId).maybeSingle();
  if (error) throw new Error(`read membership: ${error.message}`);
  if (!g || !g.complimentary_for || !g.batch_id) throw new AdminActionError("That membership wasn't found.");
  const { data: b, error: bErr } = await db.from("complimentary_batches").select("*").eq("id", g.batch_id as string).maybeSingle();
  if (bErr || !b) throw new Error(`read batch: ${bErr?.message ?? "missing"}`);
  const batch = toBatch(b as Row);

  const { data: revoked, error: rErr } = await db
    .from("gifts")
    .update({ status: "cancelled", revoked_at: at.toISOString(), recipient_email: null })
    .eq("id", giftId)
    .eq("status", "sent")
    .is("redeemed_at", null)
    .select("id");
  if (rErr) throw new Error(`revoke membership: ${rErr.message}`);
  if (!revoked?.length) throw new AdminActionError("Only an unclaimed membership can be revoked. This one was already claimed or revoked.");

  const { data: last, error: lErr } = await db.from("gifts").select("certificate_no").eq("batch_id", batch.id).order("certificate_no", { ascending: false }).limit(1);
  if (lErr) throw new Error(`read certificate numbers: ${lErr.message}`);
  const no = Number((last ?? [])[0]?.certificate_no ?? 0) + 1;
  const code = generateGiftCode();
  const { data: added, error: aErr } = await db
    .from("gifts")
    .insert({
      giver_id: g.giver_id,
      plan_id: g.plan_id,
      status: "sent",
      sent_at: at.toISOString(),
      code_hash: hashGiftCode(code),
      code_last4: last4(code),
      code_encrypted: `\\x${cipher.encryptHex(code)}`,
      recipient_name: g.recipient_name,
      recipient_email: g.recipient_email,
      giver_display_name: g.giver_display_name,
      event_name: g.event_name,
      message: g.message,
      complimentary_for: g.complimentary_for,
      claim_by: g.claim_by,
      batch_id: batch.id,
      certificate_no: no,
    })
    .select("id");
  if (aErr || !added?.[0]) throw new Error(`issue replacement: ${aErr?.message ?? "no row"}`);
  const { error: linkErr } = await db.from("gifts").update({ replaced_by: added[0].id }).eq("id", giftId);
  if (linkErr) throw new Error(`link replacement: ${linkErr.message}`);
  const certificate = certificateLabel(batch.prefix, g.certificate_no as number | null);
  const replacement = certificateLabel(batch.prefix, no);
  await logAction(db, admin, "complimentary_revoked", { batch_id: batch.id, certificate, replacement });
  return { certificate, replacement };
}
