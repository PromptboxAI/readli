import { createHash, createHmac, randomUUID } from "node:crypto";
import { sameHash } from "@/lib/server/guest-token";
import type { VoiceProvider } from "@/lib/voice/provider";
import type { Actor, FamilyState, NarrationJob, NarrationLibrary, NarrationSegment } from "@/lib/family/model";
import { activeChild, activeEntitlement, activeShare, activeSlot, childVoiceAccess, readyVoice } from "@/lib/family/permissions";
import type { PlanConfig } from "@/lib/family/plan";
import {
  actorLabel,
  audit,
  liveSession,
  NOT_AVAILABLE,
  PermissionError,
  requireChildAccess,
  requireHouseholdGuardian,
  type FamilyStore,
} from "@/lib/family/service";
import { estimateSeconds, modelCost } from "./costs";
import { bookText, type BookText } from "./text";

/**
 * Voice narration libraries (Voice Narration Libraries, Pre-Generation & Instant Narrator Switching
 * amendment). One library per voice version × book text × generation config; segments are stable
 * sentences; parents prepare narration ahead of time with household credits; children play only
 * ready segments through short-lived signed URLs after every permission gate passes.
 */

type Clock = () => Date;
const now: Clock = () => new Date();

// ---------------------------------------------------------------------------
// Library identity
// ---------------------------------------------------------------------------

export function generationConfig(plan: PlanConfig) {
  return { modelId: plan.narrationModelId, outputFormat: "mp3_44100_128", voiceSettings: { stability: 0.5, similarity_boost: 0.75 } };
}

function configHash(plan: PlanConfig): string {
  return createHash("sha256").update(JSON.stringify(generationConfig(plan))).digest("hex").slice(0, 12);
}

/**
 * Where a household finds a voice's narration of a book. With cross-household reuse licensed,
 * every authorized household shares one library; otherwise each household has its own.
 */
export function libraryFor(state: FamilyState, plan: PlanConfig, voiceId: string, text: BookText, householdId: string): NarrationLibrary {
  const voice = state.voices.find((v) => v.id === voiceId)!;
  const scope = plan.crossHouseholdReuse ? "shared" : householdId;
  const hash = configHash(plan);
  const key = [voice.id, `v${voice.version}`, text.slug, text.edition, text.revision, plan.narrationModelId, hash, scope].join(":");
  return (
    state.libraries.find((l) => l.key === key) ?? {
      key,
      voiceId,
      voiceVersion: voice.version,
      bookSlug: text.slug,
      edition: text.edition,
      textRevision: text.revision,
      modelId: plan.narrationModelId,
      configHash: hash,
      scope,
      createdAt: "",
    }
  );
}

function segmentsOf(state: FamilyState, libraryKey: string): Map<string, NarrationSegment> {
  return new Map(state.segments.filter((s) => s.libraryKey === libraryKey).map((s) => [s.sentenceId, s]));
}

function activeJob(state: FamilyState, jobId: string | null): NarrationJob | null {
  const job = jobId ? state.jobs.find((j) => j.id === jobId) : undefined;
  return job && (job.status === "queued" || job.status === "running") ? job : null;
}

export type Readiness = "ready" | "preparing" | "partial" | "not_prepared";

export const READINESS_LABELS: Record<Readiness, string> = {
  ready: "Ready",
  preparing: "Preparing",
  partial: "Partially ready",
  not_prepared: "Not prepared",
};

export interface LibraryStatus {
  readiness: Readiness;
  readySentenceIds: string[];
  total: number;
  ready: number;
  inProgress: number;
  missingCharacters: number;
}

/** Ready only counts segments whose audio is stored; a book is Ready only when every segment is. */
export function libraryStatus(state: FamilyState, library: NarrationLibrary, text: BookText): LibraryStatus {
  const segs = segmentsOf(state, library.key);
  let ready = 0;
  let inProgress = 0;
  let missingCharacters = 0;
  const readySentenceIds: string[] = [];
  for (const s of text.sentences) {
    const seg = segs.get(s.id);
    if (seg?.status === "ready" && seg.storageKey) {
      ready += 1;
      readySentenceIds.push(s.id);
    } else if (seg && activeJob(state, seg.jobId)) {
      inProgress += 1;
    } else {
      missingCharacters += s.text.length;
    }
  }
  const total = text.sentences.length;
  const readiness: Readiness = ready === total ? "ready" : inProgress > 0 ? "preparing" : ready > 0 ? "partial" : "not_prepared";
  return { readiness, readySentenceIds, total, ready, inProgress, missingCharacters };
}

// ---------------------------------------------------------------------------
// Household narration credits (seconds of new narration)
// ---------------------------------------------------------------------------

export function periodOf(at: string): string {
  return at.slice(0, 7);
}

export interface CreditBalance {
  period: string;
  allowanceSeconds: number;
  /** Allowance left this month. */
  monthlyLeft: number;
  /** Purchased seconds left (they don't expire monthly). */
  purchasedLeft: number;
  available: number;
  heldSeconds: number;
  usedThisPeriod: number;
}

export function creditBalance(state: FamilyState, plan: PlanConfig, householdId: string, at = new Date().toISOString()): CreditBalance {
  const allowance = activeEntitlement(state, householdId) ? plan.monthlyNarrationMinutes * 60 : 0;
  const entries = state.ledger.filter((e) => e.householdId === householdId);
  const purchased = entries.filter((e) => e.kind === "purchase").reduce((n, e) => n + e.seconds, 0);
  const net = new Map<string, number>();
  for (const e of entries) {
    if (e.kind === "reserve") net.set(e.period, (net.get(e.period) ?? 0) + e.seconds);
    if (e.kind === "refund") net.set(e.period, (net.get(e.period) ?? 0) - e.seconds);
  }
  const period = periodOf(at);
  let overflow = 0;
  for (const n of net.values()) overflow += Math.max(0, n - allowance);
  const usedNow = net.get(period) ?? 0;
  const committedNow = entries.filter((e) => e.kind === "commit" && e.period === period).reduce((n, e) => n + e.seconds, 0);
  const monthlyLeft = Math.max(0, allowance - usedNow);
  const purchasedLeft = Math.max(0, purchased - overflow);
  return {
    period,
    allowanceSeconds: allowance,
    monthlyLeft,
    purchasedLeft,
    available: monthlyLeft + purchasedLeft,
    heldSeconds: Math.max(0, usedNow - committedNow),
    usedThisPeriod: committedNow,
  };
}

/** Purchased narration minutes. Payments are off; checkout calls this after a charge succeeds. */
export async function addNarrationCredits(store: FamilyStore, actor: Actor | null, householdId: string, minutes: number, clock: Clock = now) {
  const state = await store.read();
  const adultId = requireHouseholdGuardian(state, actor, householdId);
  if (!activeEntitlement(state, householdId)) throw new PermissionError(402, "no_family_plan", "Narration credits come with Readli Family.");
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 600) throw new PermissionError(400, "bad_amount", "Choose how many minutes to add.");
  const at = clock().toISOString();
  await store.write((s) => {
    s.ledger.push({ id: randomUUID(), householdId, period: periodOf(at), kind: "purchase", seconds: minutes * 60, jobId: null, sentenceId: null, at });
    audit(s, adultId, "narrator_slot_added", at, { householdId, detail: `narration_minutes=${minutes}` });
  });
}

// ---------------------------------------------------------------------------
// Parent: Prepare Narration
// ---------------------------------------------------------------------------

/** Voices the household may prepare: shared by their owner and in one of its narrator slots. */
function requirePreparable(state: FamilyState, plan: PlanConfig, householdId: string, voiceId: string) {
  if (!activeEntitlement(state, householdId)) throw new PermissionError(402, "no_family_plan", "Preparing narration needs Readli Family.");
  if (!readyVoice(state, voiceId) || !activeShare(state, voiceId, householdId)) {
    throw new PermissionError(403, "voice_not_shared", "This storyteller hasn't shared their voice with your family.");
  }
  if (!activeSlot(state, voiceId, householdId, plan)) {
    throw new PermissionError(409, "needs_slot", "Add this storyteller to a narrator slot first.");
  }
}

export interface PrepareVoiceView {
  voiceId: string;
  name: string;
  tint: string;
  avatarUrl: string | null;
  /** Owner consent, narrator slot and per-child approval are shown separately from audio status. */
  shared: boolean;
  inSlot: boolean;
  approvedFor: string[];
  status: LibraryStatus;
  readinessLabel: string;
  estimateSeconds: number;
  jobId: string | null;
}

export interface PrepareBookView {
  householdId: string;
  book: { slug: string; title: string; sentences: number };
  voices: PrepareVoiceView[];
  credits: CreditBalance;
  purchasesEnabled: boolean;
  minutePriceCents: number;
}

export async function prepareView(store: FamilyStore, actor: Actor | null, householdId: string, slug: string, clock: Clock = now): Promise<PrepareBookView> {
  const state = await store.read();
  requireHouseholdGuardian(state, actor, householdId);
  const text = bookText(slug);
  if (!text) throw new PermissionError(404, "unknown_book", "That book isn't in the library yet.");
  const plan = store.plan;
  const kids = state.children.filter((c) => c.householdId === householdId && c.deletedAt === null);
  const voices = state.voices
    .filter((v) => v.status === "ready" && v.deletedAt === null && activeShare(state, v.id, householdId))
    .map((v): PrepareVoiceView => {
      const owner = state.adults.find((a) => a.id === v.ownerId)!;
      const library = libraryFor(state, plan, v.id, text, householdId);
      const status = libraryStatus(state, library, text);
      const job = state.jobs.find((j) => j.libraryKey === library.key && j.householdId === householdId && (j.status === "queued" || j.status === "running"));
      return {
        voiceId: v.id,
        name: owner.displayName,
        tint: owner.tint,
        avatarUrl: owner.avatarUrl,
        shared: true,
        inSlot: activeSlot(state, v.id, householdId, plan) !== null,
        approvedFor: kids.filter((c) => childVoiceAccess(state, c.id, v.id, plan).allowed).map((c) => c.nickname),
        status,
        readinessLabel: READINESS_LABELS[status.readiness],
        estimateSeconds: status.missingCharacters ? estimateSeconds(status.missingCharacters, plan.narrationModelId) : 0,
        jobId: job?.id ?? null,
      };
    });
  return {
    householdId,
    book: { slug, title: text.title, sentences: text.sentences.length },
    voices,
    credits: creditBalance(state, plan, householdId, clock().toISOString()),
    purchasesEnabled: plan.narrationPurchasesEnabled,
    minutePriceCents: plan.narrationMinutePriceCents,
  };
}

export interface GenerationRequest {
  voiceId: string;
  bookSlug: string;
  scope: "book" | "chapter" | "passage";
  /** For chapter scope. */
  chapter?: number;
  /** For passage scope: generated first, in this order. */
  sentenceIds?: string[];
}

export interface GenerationQuote {
  /** Segments this request would generate and pay for. */
  sentenceIds: string[];
  characters: number;
  estimateSeconds: number;
  /** Already-stored segments reused for free. */
  reusedReady: number;
  /** Segments another request is already generating (that request pays). */
  alreadyQueued: number;
}

function requestedSentences(text: BookText, req: GenerationRequest) {
  if (req.scope === "chapter") {
    const ids = new Set(text.chapters.find((c) => c.number === req.chapter)?.sentenceIds ?? []);
    return text.sentences.filter((s) => ids.has(s.id));
  }
  if (req.scope === "passage") {
    const order = req.sentenceIds ?? [];
    const byId = new Map(text.sentences.map((s) => [s.id, s]));
    return order.map((id) => byId.get(id)).filter((s): s is NonNullable<typeof s> => Boolean(s));
  }
  return text.sentences;
}

/** What a request would cost: only text with no stored or in-progress audio is charged. */
export function quote(state: FamilyState, plan: PlanConfig, householdId: string, req: GenerationRequest): GenerationQuote {
  const text = bookText(req.bookSlug);
  if (!text) throw new PermissionError(404, "unknown_book", "That book isn't in the library yet.");
  const library = libraryFor(state, plan, req.voiceId, text, householdId);
  const segs = segmentsOf(state, library.key);
  const missing: string[] = [];
  let characters = 0;
  let reusedReady = 0;
  let alreadyQueued = 0;
  for (const s of requestedSentences(text, req)) {
    const seg = segs.get(s.id);
    if (seg?.status === "ready" && seg.storageKey) reusedReady += 1;
    else if (seg && activeJob(state, seg.jobId)) alreadyQueued += 1;
    else {
      missing.push(s.id);
      characters += s.text.length;
    }
  }
  return { sentenceIds: missing, characters, estimateSeconds: characters ? estimateSeconds(characters, plan.narrationModelId) : 0, reusedReady, alreadyQueued };
}

export async function quoteGeneration(store: FamilyStore, actor: Actor | null, householdId: string, req: GenerationRequest) {
  const state = await store.read();
  requireHouseholdGuardian(state, actor, householdId);
  requirePreparable(state, store.plan, householdId, req.voiceId);
  return quote(state, store.plan, householdId, req);
}

/**
 * Confirms generation. Allocation rule: the first confirmed request for a segment claims it and
 * reserves its credits; anyone else asking for that audio while it is being made, or after it is
 * stored, pays nothing. If a job fails or is canceled, its unfinished segments are released and its
 * reservation refunded, and the next request claims them. All of this happens in one store write,
 * so two simultaneous requests can't both claim (and pay for) the same segment.
 */
export async function requestGeneration(
  store: FamilyStore,
  actor: Actor | null,
  householdId: string,
  req: GenerationRequest,
  clock: Clock = now,
): Promise<{ job: NarrationJob | null; quote: GenerationQuote }> {
  const state = await store.read();
  const adultId = requireHouseholdGuardian(state, actor, householdId);
  requirePreparable(state, store.plan, householdId, req.voiceId);
  const text = bookText(req.bookSlug)!;
  const at = clock().toISOString();
  let result: { job: NarrationJob | null; quote: GenerationQuote } = { job: null, quote: quote(state, store.plan, householdId, req) };

  await store.write((s) => {
    // Re-quote inside the write: this is the claim.
    const q = quote(s, store.plan, householdId, req);
    result = { job: null, quote: q };
    if (q.sentenceIds.length === 0) return;
    const balance = creditBalance(s, store.plan, householdId, at);
    if (q.estimateSeconds > balance.available) {
      throw new PermissionError(402, "not_enough_credits", "Not enough narration minutes left this month for this book.");
    }
    const library = libraryFor(s, store.plan, req.voiceId, text, householdId);
    if (!s.libraries.some((l) => l.key === library.key)) s.libraries.push({ ...library, createdAt: at });
    const job: NarrationJob = {
      id: randomUUID(),
      libraryKey: library.key,
      householdId,
      requestedBy: adultId,
      scope: req.scope,
      sentenceIds: q.sentenceIds,
      reservations: {},
      status: "queued",
      createdAt: at,
      finishedAt: null,
    };
    const byId = new Map(text.sentences.map((x) => [x.id, x]));
    for (const id of q.sentenceIds) {
      const sentence = byId.get(id)!;
      const seconds = estimateSeconds(sentence.text.length, store.plan.narrationModelId);
      job.reservations[id] = seconds;
      const existing = s.segments.find((x) => x.libraryKey === library.key && x.sentenceId === id);
      if (existing) Object.assign(existing, { status: "pending", jobId: job.id, error: null, attempts: 0 });
      else
        s.segments.push({
          libraryKey: library.key,
          sentenceId: id,
          ordinal: sentence.ordinal,
          status: "pending",
          jobId: job.id,
          storageKey: null,
          characters: sentence.text.length,
          durationMs: null,
          providerCredits: null,
          attempts: 0,
          error: null,
          readyAt: null,
        });
      s.ledger.push({ id: randomUUID(), householdId, period: periodOf(at), kind: "reserve", seconds, jobId: job.id, sentenceId: id, at });
    }
    s.jobs.push(job);
    audit(s, adultId, "narration_requested", at, { voiceId: req.voiceId, householdId, detail: `${req.bookSlug}:${q.sentenceIds.length}` });
    result = { job, quote: q };
  });
  return result;
}

function ledgerHas(state: FamilyState, jobId: string, sentenceId: string, kind: "commit" | "refund") {
  return state.ledger.some((e) => e.jobId === jobId && e.sentenceId === sentenceId && e.kind === kind);
}

/** Releases a job's unfinished segments and refunds their reservations, once. */
function settleUnfinished(s: FamilyState, job: NarrationJob, at: string) {
  for (const id of job.sentenceIds) {
    const seg = s.segments.find((x) => x.libraryKey === job.libraryKey && x.sentenceId === id);
    if (seg && seg.status !== "ready" && seg.jobId === job.id) {
      seg.jobId = null;
      if (seg.status === "generating" || seg.status === "pending") seg.status = seg.status === "generating" ? "failed" : "pending";
    }
    if (!(seg?.status === "ready" && ledgerHas(s, job.id, id, "commit")) && !ledgerHas(s, job.id, id, "refund")) {
      const reserved = job.reservations[id] ?? 0;
      s.ledger.push({ id: randomUUID(), householdId: job.householdId, period: periodOf(job.createdAt), kind: "refund", seconds: reserved, jobId: job.id, sentenceId: id, at });
    }
  }
}

export async function cancelGeneration(store: FamilyStore, actor: Actor | null, jobId: string, clock: Clock = now) {
  const state = await store.read();
  const job = state.jobs.find((j) => j.id === jobId);
  if (!job) throw new PermissionError(404, "no_job", "We couldn't find that preparation.");
  const adultId = requireHouseholdGuardian(state, actor, job.householdId);
  if (job.status !== "queued" && job.status !== "running") return;
  const at = clock().toISOString();
  await store.write((s) => {
    job.status = "canceled";
    job.finishedAt = at;
    settleUnfinished(s, job, at);
    audit(s, adultId, "narration_canceled", at, { householdId: job.householdId, detail: job.libraryKey });
  });
}

/**
 * Generates a job's segments in order. Resumable: it picks up wherever it stopped. A segment is
 * marked ready only after its audio is stored and read back. Failed segments retry up to the plan's
 * limit. Credits are committed per segment at most once (capped at what was reserved; Readli
 * absorbs any overrun), and anything not generated is refunded when the job ends.
 */
export async function runJob(store: FamilyStore, provider: VoiceProvider, jobId: string, clock: Clock = now): Promise<NarrationJob> {
  const state = await store.read();
  const job = state.jobs.find((j) => j.id === jobId);
  if (!job) throw new Error(`no job ${jobId}`);
  if (job.status !== "queued" && job.status !== "running") return job;
  const library = state.libraries.find((l) => l.key === job.libraryKey)!;
  const text = bookText(library.bookSlug)!;
  const byId = new Map(text.sentences.map((x) => [x.id, x]));
  const voice = state.voices.find((v) => v.id === library.voiceId);
  await store.write(() => {
    job.status = "running";
  });

  for (const id of job.sentenceIds) {
    if (job.status !== "running") break; // canceled
    const seg = state.segments.find((x) => x.libraryKey === job.libraryKey && x.sentenceId === id)!;
    if (seg.jobId !== job.id || seg.status === "ready") continue;
    // The owner may have revoked, or the voice been deleted, since the job was confirmed.
    if (!voice || voice.deletedAt || !activeShare(state, voice.id, job.householdId)) break;
    while ((seg.status as string) !== "ready" && seg.attempts < store.plan.maxSegmentAttempts && job.status === "running") {
      await store.write(() => {
        seg.status = "generating";
        seg.attempts += 1;
      });
      try {
        const sentence = byId.get(id)!;
        const { audio, contentType } = await provider.synthesize({ voiceId: voice.id, text: sentence.text });
        const storageKey = `${library.key.replaceAll(":", "/")}/${id}`;
        await store.audio.put(storageKey, audio, contentType);
        if (!(await store.audio.exists(storageKey))) throw new Error("stored audio not readable");
        const at = clock().toISOString();
        const durationMs = Math.round((sentence.text.length / modelCost(library.modelId).charactersPerMinute) * 60_000);
        const credits = Math.ceil(sentence.text.length * modelCost(library.modelId).creditsPerCharacter);
        await store.write((s) => {
          Object.assign(seg, { status: "ready", storageKey, durationMs, providerCredits: credits, error: null, readyAt: at });
          s.usage.push({ id: randomUUID(), libraryKey: library.key, sentenceId: id, modelId: library.modelId, characters: sentence.text.length, providerCredits: credits, durationMs, bytes: audio.byteLength, at });
          if (!ledgerHas(s, job.id, id, "commit")) {
            const reserved = job.reservations[id] ?? 0;
            const actual = Math.min(reserved, Math.max(1, Math.ceil(durationMs / 1000)));
            s.ledger.push({ id: randomUUID(), householdId: job.householdId, period: periodOf(job.createdAt), kind: "commit", seconds: actual, jobId: job.id, sentenceId: id, at });
            if (reserved > actual) {
              s.ledger.push({ id: randomUUID(), householdId: job.householdId, period: periodOf(job.createdAt), kind: "refund", seconds: reserved - actual, jobId: job.id, sentenceId: id, at });
            }
          }
        });
      } catch (err) {
        await store.write(() => {
          seg.status = "failed";
          seg.error = err instanceof Error ? err.message.slice(0, 200) : "generation failed";
        });
      }
    }
  }

  const at = clock().toISOString();
  await store.write((s) => {
    if (job.status !== "running") return;
    const allReady = job.sentenceIds.every((id) => s.segments.find((x) => x.libraryKey === job.libraryKey && x.sentenceId === id)?.status === "ready");
    job.status = allReady ? "done" : "failed";
    job.finishedAt = at;
    settleUnfinished(s, job, at);
    const owner = voice ? s.adults.find((a) => a.id === voice.ownerId) : null;
    const status = libraryStatus(s, library, text);
    s.notifications.push({
      id: randomUUID(),
      householdId: job.householdId,
      text: allReady
        ? `${owner?.displayName ?? "Your storyteller"}'s reading of ${text.title} is ${status.readiness === "ready" ? "ready" : "partly ready"}.`
        : `We couldn't finish preparing ${text.title} in ${owner?.displayName ?? "that voice"}. Unused minutes were returned.`,
      href: `/family/books/${text.slug}`,
      at,
      readAt: null,
    });
  });
  return job;
}

/** Runs every queued job (background worker; resumes interrupted jobs). */
export async function runPendingJobs(store: FamilyStore, provider: VoiceProvider, clock: Clock = now) {
  const state = await store.read();
  for (const job of state.jobs.filter((j) => j.status === "queued" || j.status === "running")) await runJob(store, provider, job.id, clock);
}

// ---------------------------------------------------------------------------
// Kids: narrator readiness and signed playback
// ---------------------------------------------------------------------------

export interface KidsNarratorReadiness {
  voiceId: string;
  readySentenceIds: string[];
  readiness: Readiness;
}

/** For each narrator this child may hear, which sentences of this book have audio. */
export async function kidsReadiness(store: FamilyStore, actor: Actor | null, childId: string, slug: string): Promise<KidsNarratorReadiness[]> {
  const state = await store.read();
  requireChildAccess(state, actor, childId);
  const child = activeChild(state, childId)!;
  const text = bookText(slug);
  if (!text) throw new PermissionError(404, "unknown_book", "That book isn't here.");
  return state.voices
    .filter((v) => childVoiceAccess(state, childId, v.id, store.plan).allowed)
    .map((v) => {
      const status = libraryStatus(state, libraryFor(state, store.plan, v.id, text, child.householdId), text);
      return { voiceId: v.id, readySentenceIds: status.readySentenceIds, readiness: status.readiness };
    });
}

interface PlaybackClaims {
  lk: string;
  sid: string;
  c: string;
  v: string;
  exp: number;
}

function sign(body: string, key: string) {
  return createHmac("sha256", key).update(body).digest("base64url");
}

export function signPlayback(claims: PlaybackClaims, key: string): string {
  const body = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${body}.${sign(body, key)}`;
}

export function verifyPlayback(token: string, key: string, at = Date.now()): PlaybackClaims | null {
  const [body, mac] = token.split(".");
  if (!body || !mac || !sameHash(mac, sign(body, key))) return null;
  const claims = JSON.parse(Buffer.from(body, "base64url").toString()) as PlaybackClaims;
  return claims.exp > at ? claims : null;
}

/**
 * Issues a short-lived playback URL for one ready sentence, after every gate passes: owner share,
 * active reading entitlement, narrator slot, this child's approval, and a live listening session.
 * Never calls the voice provider: playback only reads stored audio.
 */
export async function authorizePlayback(
  store: FamilyStore,
  actor: Actor | null,
  input: { childId: string; voiceId: string; bookSlug: string; sentence: number },
  key: string,
  clock: Clock = now,
): Promise<{ url: string; expiresAt: string }> {
  const state = await store.read();
  requireChildAccess(state, actor, input.childId);
  const child = activeChild(state, input.childId)!;
  const access = childVoiceAccess(state, input.childId, input.voiceId, store.plan);
  const at = clock();
  if (!access.allowed) {
    await store.write((s) => audit(s, actorLabel(actor!), "narration_denied", at.toISOString(), { voiceId: input.voiceId, childId: input.childId, detail: access.reason }));
    throw NOT_AVAILABLE;
  }
  if (!liveSession(state, input.childId, store.plan, at.toISOString())) {
    throw new PermissionError(409, "no_listening_session", "Press play to start listening.");
  }
  const text = bookText(input.bookSlug);
  const sentence = text?.sentences[input.sentence];
  if (!text || !sentence) throw new PermissionError(400, "bad_sentence", "That page doesn't exist.");
  const library = libraryFor(state, store.plan, input.voiceId, text, child.householdId);
  const seg = segmentsOf(state, library.key).get(sentence.id);
  if (seg?.status !== "ready" || !seg.storageKey) {
    throw new PermissionError(409, "not_prepared", "This part isn't prepared in that voice yet.");
  }
  const exp = at.getTime() + store.plan.playbackUrlTtlSeconds * 1000;
  await store.write((s) => {
    const session = liveSession(s, input.childId, store.plan, at.toISOString());
    if (session) session.lastSeenAt = at.toISOString();
    s.plays.push({ libraryKey: library.key, sentenceId: sentence.id, householdId: child.householdId, childId: input.childId, at: at.toISOString() });
  });
  const token = signPlayback({ lk: library.key, sid: sentence.id, c: input.childId, v: input.voiceId, exp }, key);
  return { url: `/api/narration/audio/${token}`, expiresAt: new Date(exp).toISOString() };
}

/**
 * Serves stored audio for a signed playback URL. The signature and expiry are checked, then every
 * permission gate again, so a revocation stops playback even inside the URL's lifetime.
 */
export async function readPlayback(store: FamilyStore, actor: Actor | null, token: string, key: string, at = Date.now()) {
  const claims = verifyPlayback(token, key, at);
  if (!claims || !actor) throw NOT_AVAILABLE;
  const state = await store.read();
  try {
    requireChildAccess(state, actor, claims.c);
  } catch {
    throw NOT_AVAILABLE;
  }
  if (!childVoiceAccess(state, claims.c, claims.v, store.plan).allowed) throw NOT_AVAILABLE;
  const seg = segmentsOf(state, claims.lk).get(claims.sid);
  const object = seg?.status === "ready" && seg.storageKey ? await store.audio.get(seg.storageKey) : null;
  if (!object) throw NOT_AVAILABLE;
  return object;
}

// ---------------------------------------------------------------------------
// Deletion
// ---------------------------------------------------------------------------

/**
 * Honors a voice owner's deletion: removes that voice's narration audio and segment records for
 * every household. A household merely removing a narrator never calls this; shared audio stays for
 * other households with their own authorization.
 */
export async function deleteVoiceNarrations(store: FamilyStore, voiceId: string, clock: Clock = now) {
  const state = await store.read();
  const keys = new Set(state.libraries.filter((l) => l.voiceId === voiceId).map((l) => l.key));
  const storageKeys = state.segments.filter((s) => keys.has(s.libraryKey) && s.storageKey).map((s) => s.storageKey!);
  await store.audio.delete(storageKeys);
  const at = clock().toISOString();
  await store.write((s) => {
    for (const job of s.jobs) {
      if (keys.has(job.libraryKey) && (job.status === "queued" || job.status === "running")) {
        job.status = "canceled";
        job.finishedAt = at;
        settleUnfinished(s, job, at);
      }
    }
    s.segments = s.segments.filter((x) => !keys.has(x.libraryKey));
    s.libraries = s.libraries.filter((l) => !keys.has(l.key));
  });
}
