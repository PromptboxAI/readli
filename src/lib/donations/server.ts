import { createHash, createHmac, randomInt, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminUser } from "@/lib/admin/access";
import { batchArtwork, issueComplimentary, type MembershipArtwork } from "@/lib/admin/complimentary";
import type { ComplimentaryKind } from "@/lib/admin/complimentary-kinds";
import { AdminActionError } from "@/lib/admin/tester-plans";
import { queueEmails, type EmailMessage } from "@/lib/email/outbox";
import { preferencesUrl } from "@/lib/email/preferences";
import { deliverEmails } from "@/lib/email/send";
import { GIFT_CODE_ALPHABET } from "@/lib/gifting/codes";
import type { GiftCodeCipher } from "@/lib/gifting/code-cipher";
import { claimByLabel } from "@/lib/gifting/complimentary-copy";
import { approvedEmail, infoNeededEmail, notApprovedEmail, requestReceivedEmail, winnerWelcomeEmail, type RequestFacts } from "./emails";
import { claimByForEvent, DONATION_MONTHS, FLYER_MAX_BYTES, FLYER_TYPES, type DonationStatus, type DonationUse, type EventType, type ValidDonation } from "./program";
import { eventKey, isOfficialEmail, screen, type Flag, type PriorRequest } from "./screening";

/**
 * Readli Gives Back requests (spec sections 2, 3, 5 and 7; Phase 1). A request is reviewed by a person;
 * approving it issues an ordinary complimentary membership (a one-certificate batch in
 * complimentary_batches and gifts, program "readli_gives_back"), so redemption, revoke and replace,
 * and the gifted entitlement are the same system as every other complimentary membership.
 *
 * The applicant gets a private status page (a random token, stored hashed) by email only, and that is
 * where the certificate is downloaded. Contact details stay in donation_requests, which only the
 * server can read.
 */

export const PROGRAM = "readli_gives_back";
const BUCKET = "donation-documents";
type Row = Record<string, unknown>;

export class DonationError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export interface DonationContext {
  db: SupabaseClient;
  /** Encrypts queued addresses and signs links: the email secret. */
  secret: string;
  base: string;
}

async function q<T = Row[]>(p: PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>, what: string): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return (data ?? []) as T;
}

export const hashToken = (token: string) => createHash("sha256").update(`readli-donation:${token}`).digest("hex");
export const statusUrl = (base: string, token: string) => `${base.replace(/\/$/, "")}/donations/status/${token}`;
/** The status link's token, derived from the request id so every email can carry the same link. Stored only as a hash. */
export const statusToken = (secret: string, id: string) => createHmac("sha256", `readli-donation-status:${secret}`).update(id).digest("base64url").slice(0, 32);
const newReference = () => `RGB-${Array.from({ length: 6 }, () => GIFT_CODE_ALPHABET[randomInt(GIFT_CODE_ALPHABET.length)]).join("")}`;
export const clientHash = (secret: string, address: string) => createHash("sha256").update(`readli-donation-client:${secret}:${address}`).digest("hex").slice(0, 32);

/** The certificate's occasion, from how the organization will use the membership. */
export function occasionFor(use: DonationUse | null, eventType: EventType): ComplimentaryKind {
  const kind = use ?? eventType;
  if (kind === "raffle" || kind === "tricky_tray" || kind === "door_prize") return "raffle";
  if (kind === "silent_auction" || kind === "live_auction") return "auction";
  if (kind === "gift_basket" || kind === "basket_dinner") return "gift_basket";
  return "fundraiser";
}

const facts = (r: Row): RequestFacts => ({
  reference: r.reference as string,
  orgName: r.org_name as string,
  eventName: r.event_name as string,
  eventDate: r.event_date as string,
  contactName: r.contact_name as string,
});

async function log(db: SupabaseClient, requestId: string, actor: "applicant" | "system" | "admin", action: string, detail: Row = {}, actorEmail: string | null = null) {
  await q(db.from("donation_activity_log").insert({ request_id: requestId, actor, actor_email: actorEmail, action, detail }), "log donation activity");
}

async function sendToApplicant(ctx: DonationContext, r: Row, emailId: string, dedupeKey: string, message: EmailMessage) {
  const ids = await queueEmails(ctx.db, ctx.secret, [{ emailId, dedupeKey, to: { email: r.contact_email as string }, message }]);
  if (ids.length) await deliverEmails(ctx.db, ids).catch((err) => console.error("donation email send failed", err instanceof Error ? err.message : err));
}

export interface Upload {
  bytes: Uint8Array;
  type: string;
}

const EXT: Record<string, string> = { "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

export function checkUpload(file: Upload | null): string | null {
  if (!file) return null;
  if (!(FLYER_TYPES as readonly string[]).includes(file.type)) return "Attach a PDF, PNG, JPG or WebP file.";
  if (file.bytes.byteLength > FLYER_MAX_BYTES) return "That file is over 10 MB. Please attach a smaller one.";
  return null;
}

async function store(db: SupabaseClient, requestId: string, name: string, file: Upload): Promise<string> {
  const path = `requests/${requestId}/${name}-${Date.now()}.${EXT[file.type] ?? "bin"}`;
  const { error } = await db.storage.from(BUCKET).upload(path, new Blob([new Uint8Array(file.bytes)], { type: file.type }), { contentType: file.type, upsert: false });
  if (error) throw new Error(`store donation document: ${error.message}`);
  return path;
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

async function priorRequests(db: SupabaseClient, v: ValidDonation): Promise<PriorRequest[]> {
  const cols = "id, status, event_key, org_name, event_date, contact_email, created_at";
  const [byEvent, byContact, byOrg] = await Promise.all([
    q(db.from("donation_requests").select(cols).eq("event_key", eventKey(v)).limit(50), "read same event"),
    q(db.from("donation_requests").select(cols).eq("contact_email", v.contactEmail).order("created_at", { ascending: false }).limit(50), "read same contact"),
    q(db.from("donation_requests").select(cols).ilike("org_name", escapeLike(v.orgName)).order("created_at", { ascending: false }).limit(50), "read same organization"),
  ]);
  const seen = new Map<string, PriorRequest>();
  for (const r of [...byEvent, ...byContact, ...byOrg]) {
    seen.set(r.id as string, {
      id: r.id as string,
      status: r.status as string,
      eventKey: r.event_key as string,
      orgName: r.org_name as string,
      eventDate: r.event_date as string,
      contactEmail: r.contact_email as string,
      createdAt: r.created_at as string,
    });
  }
  return [...seen.values()];
}

/** Saves a request, runs the basic checks and emails the applicant their reference and status link. */
export async function submitDonationRequest(ctx: DonationContext, v: ValidDonation, opts: { flyer: Upload | null; client: string }, at = new Date()): Promise<{ reference: string }> {
  const uploadProblem = checkUpload(opts.flyer);
  if (uploadProblem) throw new DonationError(400, "bad_file", uploadProblem);
  const hourAgo = new Date(at.getTime() - 3_600_000).toISOString();
  const recent = await q(ctx.db.from("donation_requests").select("id").eq("client_hash", opts.client).gte("created_at", hourAgo).limit(6), "read recent requests");
  if (recent.length >= 5) throw new DonationError(429, "slow_down", "We've received several requests from you in the last hour. Please try again later.");

  const flags = screen(v, await priorRequests(ctx.db, v), at);
  const id = randomUUID();
  const token = statusToken(ctx.secret, id);
  const flyerPath = opts.flyer ? await store(ctx.db, id, "flyer", opts.flyer) : null;
  let row: Row | null = null;
  for (let attempt = 0; attempt < 4 && !row; attempt++) {
    const { data, error } = await ctx.db
      .from("donation_requests")
      .insert({
        id,
        reference: newReference(),
        status_token_hash: hashToken(token),
        org_name: v.orgName,
        org_type: v.orgType,
        org_website: v.orgWebsite,
        org_proof: v.orgProof,
        org_ein: v.orgEin,
        org_street: v.orgStreet,
        org_city: v.orgCity,
        org_state: v.orgState,
        org_zip: v.orgZip,
        contact_name: v.contactName,
        contact_role: v.contactRole,
        contact_email: v.contactEmail,
        contact_phone: v.contactPhone,
        event_name: v.eventName,
        event_type: v.eventType,
        event_date: v.eventDate,
        beneficiary: v.beneficiary,
        event_location: v.eventLocation,
        event_online: v.eventOnline,
        event_url: v.eventUrl,
        attendance: v.attendance,
        donation_use: v.donationUse,
        flyer_path: flyerPath,
        certificate_delivery: v.certificateDelivery,
        certificate_org_name: v.certificateOrgName,
        notes: v.notes,
        flags,
        event_key: eventKey(v),
        client_hash: opts.client,
      })
      .select("*")
      .single();
    if (!error) row = data as Row;
    else if (error.code !== "23505" || !/reference/.test(error.message)) throw new Error(`save donation request: ${error.message}`);
  }
  if (!row) throw new Error("save donation request: no free reference");
  await log(ctx.db, id, "applicant", "submitted", { org_type: v.orgType, event_type: v.eventType, state: v.orgState });
  if (flags.length) await log(ctx.db, id, "system", "flagged", { flags: flags.map((f) => f.code) });
  await sendToApplicant(ctx, row, "D1", `D1:${id}`, requestReceivedEmail(facts(row), statusUrl(ctx.base, token)));
  return { reference: row.reference as string };
}

// ---------------------------------------------------------------------------
// The applicant's status page
// ---------------------------------------------------------------------------

export interface ApplicantView {
  reference: string;
  status: DonationStatus;
  orgName: string;
  eventName: string;
  eventDate: string;
  submittedAt: string;
  infoRequest: string | null;
  replied: boolean;
  decisionReason: string | null;
  certificate: { claimBy: string; redeemed: boolean; certificate: string; supportingName: string } | null;
}

async function rowForToken(db: SupabaseClient, token: string): Promise<Row | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const rows = await q(db.from("donation_requests").select("*").eq("status_token_hash", hashToken(token)).limit(1), "read donation request");
  return rows[0] ?? null;
}

export async function applicantView(db: SupabaseClient, token: string): Promise<ApplicantView | null> {
  const r = await rowForToken(db, token);
  if (!r) return null;
  let certificate: ApplicantView["certificate"] = null;
  if (r.status === "approved" && r.batch_id) {
    const [batch] = await q(db.from("complimentary_batches").select("prefix, claim_by, supporting_name").eq("id", r.batch_id as string).limit(1), "read batch");
    const gifts = await q(db.from("gifts").select("certificate_no, status, redeemed_at").eq("batch_id", r.batch_id as string).neq("status", "cancelled").order("certificate_no", { ascending: false }).limit(1), "read certificate");
    const g = gifts[0];
    if (batch && g) {
      certificate = {
        claimBy: batch.claim_by as string,
        redeemed: Boolean(g.redeemed_at),
        certificate: `${batch.prefix as string}-${String(g.certificate_no ?? 1).padStart(3, "0")}`,
        supportingName: (batch.supporting_name as string | null) ?? (r.org_name as string),
      };
    }
  }
  return {
    reference: r.reference as string,
    status: r.status as DonationStatus,
    orgName: r.org_name as string,
    eventName: r.event_name as string,
    eventDate: r.event_date as string,
    submittedAt: r.created_at as string,
    infoRequest: r.status === "needs_info" ? ((r.info_request as string | null) ?? null) : null,
    replied: Boolean(r.applicant_reply),
    decisionReason: r.status === "rejected" ? ((r.decision_reason as string | null) ?? null) : null,
    certificate,
  };
}

/** The approved request's live certificate: the newest unrevoked one, so a replacement takes over. */
export async function applicantArtwork(db: SupabaseClient, cipher: GiftCodeCipher, token: string): Promise<{ art: MembershipArtwork; requestId: string } | null> {
  const r = await rowForToken(db, token);
  if (!r || r.status !== "approved" || !r.batch_id) return null;
  const all = await batchArtwork(db, cipher, r.batch_id as string);
  const art = all[all.length - 1];
  return art ? { art, requestId: r.id as string } : null;
}

export async function logApplicantDownload(db: SupabaseClient, requestId: string, what: string) {
  await log(db, requestId, "applicant", "certificate_downloaded", { what });
}

/** The applicant answers a request for more information; the request goes back to the review queue. */
export async function applicantReply(ctx: DonationContext, token: string, text: string, file: Upload | null): Promise<void> {
  const r = await rowForToken(ctx.db, token);
  if (!r) throw new DonationError(404, "not_found", "We couldn't find that request.");
  if (r.status !== "needs_info") throw new DonationError(409, "not_waiting", "This request isn't waiting on anything from you right now.");
  const reply = text.replace(/\r\n/g, "\n").trim().slice(0, 2000);
  if (!reply && !file) throw new DonationError(400, "empty", "Write a reply or attach a document.");
  const problem = checkUpload(file);
  if (problem) throw new DonationError(400, "bad_file", problem);
  const path = file ? await store(ctx.db, r.id as string, "reply", file) : null;
  const updated = await q(
    ctx.db
      .from("donation_requests")
      .update({ applicant_reply: reply || null, ...(path ? { reply_path: path } : {}), status: "pending", updated_at: new Date().toISOString() })
      .eq("id", r.id as string)
      .eq("status", "needs_info")
      .select("id"),
    "save reply",
  );
  if (!updated.length) throw new DonationError(409, "not_waiting", "This request isn't waiting on anything from you right now.");
  await log(ctx.db, r.id as string, "applicant", "applicant_replied", { attached: Boolean(path) });
}

// ---------------------------------------------------------------------------
// Admin: review, approve, reject, ask for more, resend
// ---------------------------------------------------------------------------

export interface AdminRequest {
  id: string;
  reference: string;
  status: DonationStatus;
  orgName: string;
  orgType: string;
  orgWebsite: string | null;
  orgProof: string | null;
  orgEin: string | null;
  address: string | null;
  state: string | null;
  contactName: string;
  contactRole: string | null;
  contactEmail: string;
  contactPhone: string | null;
  officialEmail: boolean;
  eventName: string;
  eventType: string;
  eventDate: string;
  beneficiary: string;
  eventLocation: string | null;
  eventOnline: boolean;
  eventUrl: string | null;
  attendance: number | null;
  donationUse: string | null;
  hasFlyer: boolean;
  certificateDelivery: string;
  certificateOrgName: string | null;
  notes: string | null;
  flags: Flag[];
  infoRequest: string | null;
  applicantReply: string | null;
  hasReplyFile: boolean;
  decisionReason: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  batchId: string | null;
  redemption: "none" | "unredeemed" | "redeemed" | "expired" | "revoked";
  createdAt: string;
}

function toAdmin(r: Row, redemption: AdminRequest["redemption"] = "none"): AdminRequest {
  const address = [r.org_street, r.org_city, [r.org_state, r.org_zip].filter(Boolean).join(" ")].filter((x) => typeof x === "string" && x).join(", ");
  return {
    id: r.id as string,
    reference: r.reference as string,
    status: r.status as DonationStatus,
    orgName: r.org_name as string,
    orgType: r.org_type as string,
    orgWebsite: (r.org_website as string | null) ?? null,
    orgProof: (r.org_proof as string | null) ?? null,
    orgEin: (r.org_ein as string | null) ?? null,
    address: address || null,
    state: (r.org_state as string | null) ?? null,
    contactName: r.contact_name as string,
    contactRole: (r.contact_role as string | null) ?? null,
    contactEmail: r.contact_email as string,
    contactPhone: (r.contact_phone as string | null) ?? null,
    officialEmail: isOfficialEmail(r.contact_email as string, (r.org_website as string | null) ?? null),
    eventName: r.event_name as string,
    eventType: r.event_type as string,
    eventDate: r.event_date as string,
    beneficiary: r.beneficiary as string,
    eventLocation: (r.event_location as string | null) ?? null,
    eventOnline: Boolean(r.event_online),
    eventUrl: (r.event_url as string | null) ?? null,
    attendance: (r.attendance as number | null) ?? null,
    donationUse: (r.donation_use as string | null) ?? null,
    hasFlyer: Boolean(r.flyer_path),
    certificateDelivery: r.certificate_delivery as string,
    certificateOrgName: (r.certificate_org_name as string | null) ?? null,
    notes: (r.notes as string | null) ?? null,
    flags: Array.isArray(r.flags) ? (r.flags as Flag[]) : [],
    infoRequest: (r.info_request as string | null) ?? null,
    applicantReply: (r.applicant_reply as string | null) ?? null,
    hasReplyFile: Boolean(r.reply_path),
    decisionReason: (r.decision_reason as string | null) ?? null,
    decidedBy: (r.decided_by_email as string | null) ?? null,
    decidedAt: (r.decided_at as string | null) ?? null,
    batchId: (r.batch_id as string | null) ?? null,
    redemption,
    createdAt: r.created_at as string,
  };
}

function redemptionOf(gifts: Row[], now: Date): AdminRequest["redemption"] {
  if (!gifts.length) return "none";
  if (gifts.some((g) => g.redeemed_at)) return "redeemed";
  const live = gifts.filter((g) => g.status !== "cancelled");
  if (!live.length) return "revoked";
  return live.some((g) => !g.claim_by || new Date(g.claim_by as string).getTime() > now.getTime()) ? "unredeemed" : "expired";
}

async function giftsByBatch(db: SupabaseClient, batchIds: string[]): Promise<Map<string, Row[]>> {
  const out = new Map<string, Row[]>();
  if (!batchIds.length) return out;
  for (let i = 0; i < batchIds.length; i += 200) {
    const rows = await q(db.from("gifts").select("batch_id, status, redeemed_at, claim_by, paid_through").in("batch_id", batchIds.slice(i, i + 200)), "read donated memberships");
    for (const g of rows) out.set(g.batch_id as string, [...(out.get(g.batch_id as string) ?? []), g]);
  }
  return out;
}

export type RequestFilter = "review" | "approved" | "rejected" | "all";

export async function listRequests(db: SupabaseClient, filter: RequestFilter, search = "", now = new Date()): Promise<AdminRequest[]> {
  let query = db.from("donation_requests").select("*").order("created_at", { ascending: filter === "review" }).limit(500);
  if (filter === "review") query = query.in("status", ["pending", "needs_info"]);
  else if (filter !== "all") query = query.eq("status", filter);
  const s = search.trim();
  if (s) {
    const like = `*${escapeLike(s).replace(/[,()*]/g, " ")}*`;
    query = query.or(`org_name.ilike.${like},event_name.ilike.${like},contact_email.ilike.${like},reference.ilike.${like}`);
  }
  const rows = await q(query, "read donation requests");
  const gifts = await giftsByBatch(db, rows.map((r) => r.batch_id as string | null).filter((b): b is string => Boolean(b)));
  return rows.map((r) => toAdmin(r, r.batch_id ? redemptionOf(gifts.get(r.batch_id as string) ?? [], now) : "none"));
}

export interface ActivityEntry {
  at: string;
  actor: string;
  action: string;
  detail: Row;
}

export async function requestDetail(db: SupabaseClient, id: string, now = new Date()): Promise<{ request: AdminRequest; activity: ActivityEntry[]; history: AdminRequest[] } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [r] = await q(db.from("donation_requests").select("*").eq("id", id).limit(1), "read donation request");
  if (!r) return null;
  const gifts = r.batch_id ? await giftsByBatch(db, [r.batch_id as string]) : new Map<string, Row[]>();
  const request = toAdmin(r, r.batch_id ? redemptionOf(gifts.get(r.batch_id as string) ?? [], now) : "none");
  const log = await q(db.from("donation_activity_log").select("created_at, actor, actor_email, action, detail").eq("request_id", id).order("created_at", { ascending: false }).limit(200), "read activity");
  const activity = log.map((a) => ({ at: a.created_at as string, actor: (a.actor_email as string | null) ?? (a.actor as string), action: a.action as string, detail: (a.detail ?? {}) as Row }));
  const others = await q(db.from("donation_requests").select("*").ilike("org_name", escapeLike(request.orgName)).neq("id", id).order("created_at", { ascending: false }).limit(50), "read organization history");
  return { request, activity, history: others.map((o) => toAdmin(o)) };
}

export interface ProgramStats {
  applications: number;
  approved: number;
  pending: number;
  needsInfo: number;
  rejected: number;
  certificatesIssued: number;
  redeemed: number;
  activeMemberships: number;
  expiredMemberships: number;
  unredeemedExpired: number;
}

export async function programStats(db: SupabaseClient, now = new Date()): Promise<ProgramStats> {
  const rows = await q(db.from("donation_requests").select("status, batch_id"), "read donation counts");
  const count = (s: string) => rows.filter((r) => r.status === s).length;
  const batches = rows.map((r) => r.batch_id as string | null).filter((b): b is string => Boolean(b));
  const gifts = [...(await giftsByBatch(db, batches)).values()].flat();
  const t = now.getTime();
  const redeemed = gifts.filter((g) => g.redeemed_at);
  return {
    applications: rows.length,
    approved: count("approved"),
    pending: count("pending"),
    needsInfo: count("needs_info"),
    rejected: count("rejected"),
    certificatesIssued: gifts.length,
    redeemed: redeemed.length,
    activeMemberships: redeemed.filter((g) => !g.paid_through || new Date(g.paid_through as string).getTime() > t).length,
    expiredMemberships: redeemed.filter((g) => g.paid_through && new Date(g.paid_through as string).getTime() <= t).length,
    unredeemedExpired: gifts.filter((g) => !g.redeemed_at && g.status !== "cancelled" && g.claim_by && new Date(g.claim_by as string).getTime() <= t).length,
  };
}

/** A short-lived link to an uploaded flyer or reply document, for admins only. */
export async function documentUrl(db: SupabaseClient, id: string, which: "flyer" | "reply"): Promise<string | null> {
  const [r] = await q(db.from("donation_requests").select("flyer_path, reply_path").eq("id", id).limit(1), "read document");
  const path = r?.[which === "flyer" ? "flyer_path" : "reply_path"] as string | null | undefined;
  if (!path) return null;
  const { data, error } = await db.storage.from(BUCKET).createSignedUrl(path, 120);
  if (error) throw new Error(`sign document link: ${error.message}`);
  return data.signedUrl;
}

async function adminRow(db: SupabaseClient, id: string): Promise<Row> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new AdminActionError("That request wasn't found.");
  const [r] = await q(db.from("donation_requests").select("*").eq("id", id).limit(1), "read donation request");
  if (!r) throw new AdminActionError("That request wasn't found.");
  return r;
}

const decided = (admin: AdminUser, at: Date) => ({ decided_by: admin.id, decided_by_email: admin.email, decided_at: at.toISOString(), updated_at: at.toISOString() });

const linkFor = (ctx: DonationContext, id: string) => statusUrl(ctx.base, statusToken(ctx.secret, id));

export interface ApproveDeps {
  cipher: GiftCodeCipher;
  retailValue: string;
}

/**
 * Approves a request and issues its certificate. Safe to press twice: the batch is keyed to the
 * request, and the database allows one approved request per event.
 */
export async function approveRequest(ctx: DonationContext, admin: AdminUser, id: string, deps: ApproveDeps, at = new Date()): Promise<void> {
  const r = await adminRow(ctx.db, id);
  if (r.status === "approved" && r.batch_id) throw new AdminActionError("This request is already approved.");
  if (r.status === "rejected") throw new AdminActionError("This request was declined. Ask the applicant to apply again if things have changed.");
  const before = r.status as string;
  const { data: claimed, error } = await ctx.db
    .from("donation_requests")
    .update({ status: "approved", ...decided(admin, at) })
    .eq("id", id)
    .in("status", ["pending", "needs_info", "approved"])
    .is("batch_id", null)
    .select("id");
  if (error) {
    if (error.code === "23505") throw new AdminActionError("This event already has an approved donation. Decline this one, or edit the event if it's a different one.");
    throw new Error(`approve donation: ${error.message}`);
  }
  if (!claimed?.length) throw new AdminActionError("Someone else just changed this request. Reload to see it.");

  let batchId: string;
  try {
    ({ batchId } = await issueComplimentary(
      ctx.db,
      admin,
      {
        requestKey: `donation-${id}`,
        months: DONATION_MONTHS,
        sponsor: "readli",
        occasion: occasionFor((r.donation_use as DonationUse | null) ?? null, r.event_type as EventType),
        eventName: (r.event_name as string).slice(0, 120),
        recipient: "unknown",
        count: 1,
        label: `${r.reference as string} · ${(r.org_name as string).slice(0, 80)}`,
        claimBy: claimByForEvent(r.event_date as string),
      },
      deps.cipher,
      at,
    ));
  } catch (err) {
    await ctx.db.from("donation_requests").update({ status: before, decided_by: null, decided_by_email: null, decided_at: null }).eq("id", id).is("batch_id", null);
    throw err;
  }
  await q(
    ctx.db.from("complimentary_batches").update({ program: PROGRAM, supporting_name: ((r.certificate_org_name ?? r.org_name) as string).slice(0, 120) }).eq("id", batchId),
    "mark donation batch",
  );
  const [gift] = await q(ctx.db.from("gifts").select("id").eq("batch_id", batchId).order("certificate_no").limit(1), "read issued certificate");
  await q(ctx.db.from("donation_requests").update({ batch_id: batchId, gift_id: (gift?.id as string | undefined) ?? null }).eq("id", id), "link certificate");
  await log(ctx.db, id, "admin", "approved", {}, admin.email);
  await log(ctx.db, id, "system", "certificate_issued", { batch_id: batchId });
  const [batch] = await q(ctx.db.from("complimentary_batches").select("claim_by").eq("id", batchId).limit(1), "read claim-by");
  await sendToApplicant(
    ctx,
    r,
    "D2",
    `D2:${id}:1`,
    approvedEmail(facts(r), linkFor(ctx, id), claimByLabel((batch?.claim_by as string | undefined) ?? null) ?? "the date on the certificate", deps.retailValue),
  );
  await log(ctx.db, id, "system", "certificate_emailed", {});
}

export async function rejectRequest(ctx: DonationContext, admin: AdminUser, id: string, reason: string, at = new Date()): Promise<void> {
  const why = reason.replace(/\r\n/g, "\n").trim().slice(0, 2000);
  if (!why) throw new AdminActionError("Write a short, kind reason. The applicant will see it.");
  const r = await adminRow(ctx.db, id);
  const updated = await q(
    ctx.db.from("donation_requests").update({ status: "rejected", decision_reason: why, ...decided(admin, at) }).eq("id", id).in("status", ["pending", "needs_info"]).select("id"),
    "decline donation",
  );
  if (!updated.length) throw new AdminActionError("Only a request under review can be declined.");
  await log(ctx.db, id, "admin", "rejected", { reason: why }, admin.email);
  await sendToApplicant(ctx, r, "D4", `D4:${id}`, notApprovedEmail(facts(r), linkFor(ctx, id), why));
}

export async function askForInfo(ctx: DonationContext, admin: AdminUser, id: string, message: string, at = new Date()): Promise<void> {
  const ask = message.replace(/\r\n/g, "\n").trim().slice(0, 2000);
  if (!ask) throw new AdminActionError("Say what you need from the applicant.");
  const r = await adminRow(ctx.db, id);
  const updated = await q(
    ctx.db
      .from("donation_requests")
      .update({ status: "needs_info", info_request: ask, applicant_reply: null, updated_at: at.toISOString() })
      .eq("id", id)
      .in("status", ["pending", "needs_info"])
      .select("id"),
    "ask for information",
  );
  if (!updated.length) throw new AdminActionError("Only a request under review can be sent a question.");
  await log(ctx.db, id, "admin", "info_requested", { message: ask }, admin.email);
  await sendToApplicant(ctx, r, "D3", `D3:${id}:${at.getTime()}`, infoNeededEmail(facts(r), linkFor(ctx, id), ask));
}

export async function resendCertificate(ctx: DonationContext, admin: AdminUser, id: string, retailValue: string, at = new Date()): Promise<void> {
  const r = await adminRow(ctx.db, id);
  if (r.status !== "approved" || !r.batch_id) throw new AdminActionError("Only an approved request has a certificate to send.");
  const [batch] = await q(ctx.db.from("complimentary_batches").select("claim_by").eq("id", r.batch_id as string).limit(1), "read claim-by");
  await sendToApplicant(
    ctx,
    r,
    "D2",
    `D2:${id}:${at.getTime()}`,
    approvedEmail(facts(r), linkFor(ctx, id), claimByLabel((batch?.claim_by as string | undefined) ?? null) ?? "the date on the certificate", retailValue),
  );
  await log(ctx.db, id, "admin", "certificate_emailed", { resent: true }, admin.email);
}

// ---------------------------------------------------------------------------
// The winner
// ---------------------------------------------------------------------------

/** After any gift is redeemed: if it was a Readli Gives Back certificate, welcome the family and log it. */
export async function afterGiftRedeemed(ctx: DonationContext, giftId: string, user: { id: string; name: string }, paidThrough: string | null): Promise<void> {
  const [gift] = await q(ctx.db.from("gifts").select("batch_id").eq("id", giftId).limit(1), "read redeemed gift");
  if (!gift?.batch_id) return;
  const [batch] = await q(ctx.db.from("complimentary_batches").select("program, event_name").eq("id", gift.batch_id as string).limit(1), "read gift batch");
  if (batch?.program !== PROGRAM) return;
  const [request] = await q(ctx.db.from("donation_requests").select("id").eq("batch_id", gift.batch_id as string).limit(1), "read donation for gift");
  if (request) await log(ctx.db, request.id as string, "system", "redeemed", {});
  const endsLabel = paidThrough ? new Date(paidThrough).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "a year from your current plan's end";
  const ids = await queueEmails(ctx.db, ctx.secret, [
    {
      emailId: "D6",
      dedupeKey: `D6:${giftId}`,
      to: { userId: user.id },
      message: winnerWelcomeEmail({
        name: user.name.trim().split(/\s+/)[0] ?? "",
        endsLabel,
        eventName: (batch.event_name as string | null) ?? null,
        base: ctx.base,
        preferencesUrl: preferencesUrl(ctx.base, ctx.secret, user.id),
      }),
    },
  ]);
  if (ids.length) await deliverEmails(ctx.db, ids).catch((err) => console.error("winner welcome send failed", err instanceof Error ? err.message : err));
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  // A leading =, +, - or @ would run as a formula in a spreadsheet.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function requestsCsv(rows: AdminRequest[]): string {
  const head = ["Reference", "Status", "Organization", "Organization type", "State", "Event", "Event type", "Event date", "Contact email", "Applied", "Flags", "Certificate", "Redemption"];
  const lines = rows.map((r) =>
    [r.reference, r.status, r.orgName, r.orgType, r.state, r.eventName, r.eventType, r.eventDate, r.contactEmail, r.createdAt.slice(0, 10), r.flags.map((f) => f.code).join(" "), r.batchId ? "issued" : "", r.redemption]
      .map(csvCell)
      .join(","),
  );
  return [head.join(","), ...lines].join("\n") + "\n";
}
