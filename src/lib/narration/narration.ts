import { createHash, createHmac, randomUUID } from "node:crypto";
import { sameHash } from "@/lib/server/guest-token";
import { voiceSettings } from "@/lib/voice/elevenlabs";
import type { VoiceProvider } from "@/lib/voice/provider";
import type { Actor, CreditLot, FamilyState, NarrationJob, NarrationLibrary, NarrationSegment } from "@/lib/family/model";
import { activeChild, activeEntitlement, activeShare, activeSlot, childVoiceAccess, familyEntitlement, isActiveMember, liveSlots, narratorSlotCount, readyVoice, storedNarrationAccess, storedShare } from "@/lib/family/permissions";
import type { GenerationLimits, PlanConfig } from "@/lib/family/plan";
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
import { creditBalance, creditsFor, creditUnits, draw, inTrial, spendableLots, type CreditBalance } from "./credits";
import { CATALOG, findCatalogBook } from "@/lib/library/catalog";
import { bookCharacters, bookText, type BookText, withoutTheEnd } from "./text";

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

export function generationConfig(modelId: string) {
  return { modelId, outputFormat: "mp3_44100_128", voiceSettings: voiceSettings(modelId) };
}

function configHash(modelId: string): string {
  return createHash("sha256").update(JSON.stringify(generationConfig(modelId))).digest("hex").slice(0, 12);
}

/** The reading model a voice narrates with: its own, so a new model never changes an existing voice. */
export function voiceModel(state: FamilyState, plan: PlanConfig, voiceId: string): string {
  return state.voices.find((v) => v.id === voiceId)?.modelId ?? plan.narrationModelId;
}

/**
 * Where a household finds a voice's narration of a book. With cross-household reuse licensed,
 * every authorized household shares one library; otherwise each household has its own.
 *
 * A book fully prepared under an earlier model or settings keeps playing that audio, so switching
 * a voice to a new model never makes finished books look unprepared. New books use the voice's model.
 * A book finished before "The End." was added still counts, so only that sentence is left to prepare.
 */
export function libraryFor(state: FamilyState, plan: PlanConfig, voiceId: string, text: BookText, householdId: string): NarrationLibrary {
  const voice = state.voices.find((v) => v.id === voiceId)!;
  const scope = plan.crossHouseholdReuse ? "shared" : householdId;
  const modelId = voiceModel(state, plan, voiceId);
  const hash = configHash(modelId);
  const key = [voice.id, `v${voice.version}`, text.slug, text.edition, text.revision, modelId, hash, scope].join(":");
  const current = state.libraries.find((l) => l.key === key);
  if (current) return current;
  const finished = state.libraries.find(
    (l) =>
      l.voiceId === voice.id &&
      l.voiceVersion === voice.version &&
      l.bookSlug === text.slug &&
      l.edition === text.edition &&
      l.textRevision === text.revision &&
      l.scope === scope &&
      libraryStatus(state, l, withoutTheEnd(text)).readiness === "ready",
  );
  return (
    finished ?? {
      key,
      voiceId,
      voiceVersion: voice.version,
      bookSlug: text.slug,
      edition: text.edition,
      textRevision: text.revision,
      modelId,
      configHash: hash,
      scope,
      createdAt: "",
    }
  );
}

/**
 * The library a child hears for this voice and book. Replacing a voice, or a model or settings change,
 * makes a new library, and the old one stays: books keep their original audio and its voice version.
 * The newest complete library wins; with none complete, the one with the most ready sentences (the
 * newer version on a tie). Sentences from different libraries are never mixed within one book.
 */
export function playbackLibrary(state: FamilyState, plan: PlanConfig, voiceId: string, text: BookText, householdId: string): NarrationLibrary {
  const current = libraryFor(state, plan, voiceId, text, householdId);
  const candidates = state.libraries.filter(
    (l) =>
      l.voiceId === voiceId &&
      l.bookSlug === text.slug &&
      l.edition === text.edition &&
      l.textRevision === text.revision &&
      (l.scope === "shared" || l.scope === householdId),
  );
  if (!candidates.some((l) => l.key === current.key)) candidates.push(current);
  const total = text.sentences.length;
  const ranked = candidates.map((l) => ({ l, ready: libraryStatus(state, l, text).ready }));
  ranked.sort((a, b) => {
    const ca = a.ready === total;
    const cb = b.ready === total;
    if (ca !== cb) return ca ? -1 : 1;
    if (!ca && a.ready !== b.ready) return b.ready - a.ready;
    if (a.l.voiceVersion !== b.l.voiceVersion) return b.l.voiceVersion - a.l.voiceVersion;
    if (a.l.key === current.key || b.l.key === current.key) return a.l.key === current.key ? -1 : 1;
    return b.l.createdAt.localeCompare(a.l.createdAt);
  });
  return ranked[0]!.l;
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
// Household credits (see credits.ts)
// ---------------------------------------------------------------------------

/**
 * Adds purchased credits for a pack. Checkout calls this after a successful charge; in the preview
 * (no payments) it is the simulated checkout. Never callable by a child.
 */
export async function purchaseCredits(store: FamilyStore, actor: Actor | null, householdId: string, packId: string, opts: { paymentRef: string | null }, clock: Clock = now) {
  const state = await store.read();
  const adultId = requireHouseholdGuardian(state, actor, householdId);
  if (!familyEntitlement(state, householdId)) throw new PermissionError(402, "no_family_plan", "Narration credits come with Readli Family.");
  const pack = store.plan.creditPacks.find((p) => p.id === packId);
  if (!pack) throw new PermissionError(400, "bad_pack", "Choose a credit pack.");
  const at = clock();
  const months = store.plan.purchasedCreditMonths;
  const expires = months > 0 ? new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + months, at.getUTCDate())).toISOString() : null;
  const lot: CreditLot = {
    id: randomUUID(),
    householdId,
    source: "purchased",
    credits: creditUnits(pack.credits, store.plan),
    grantedAt: at.toISOString(),
    expiresAt: expires,
    note: opts.paymentRef ? `Credit pack (${pack.credits})` : `Credit pack (${pack.credits}), preview: no payment taken`,
  };
  await store.write((s) => {
    s.creditLots.push(lot);
    audit(s, adultId, "credits_purchased", at.toISOString(), { householdId, detail: `${pack.id}:${pack.credits}` });
  });
  return lot;
}

/** Promotional credits (whole credits): the welcome grant for a new household, or an admin grant. */
export async function grantPromoCredits(store: FamilyStore, householdId: string, credits: number, days: number, note: string, clock: Clock = now) {
  const at = clock();
  const lot: CreditLot = {
    id: randomUUID(),
    householdId,
    source: "promotional",
    credits: creditUnits(credits, store.plan),
    grantedAt: at.toISOString(),
    expiresAt: days > 0 ? new Date(at.getTime() + days * 86_400_000).toISOString() : null,
    note,
  };
  await store.write((s) => {
    s.creditLots.push(lot);
  });
  return lot;
}

/** Credit activity for a household, newest first: grants, purchases and each preparation. */
export function creditHistory(state: FamilyState, householdId: string) {
  const rows: { at: string; text: string; credits: number; status: string }[] = [];
  for (const lot of state.creditLots.filter((l) => l.householdId === householdId)) {
    rows.push({ at: lot.grantedAt, text: lot.note, credits: lot.credits, status: lot.expiresAt ? `Expires ${lot.expiresAt.slice(0, 10)}` : "Never expires" });
  }
  for (const job of state.jobs.filter((j) => j.householdId === householdId)) {
    const library = state.libraries.find((l) => l.key === job.libraryKey);
    const text = library ? bookText(library.bookSlug) : null;
    const owner = library ? state.adults.find((a) => a.id === state.voices.find((v) => v.id === library.voiceId)?.ownerId) : null;
    const entries = state.ledger.filter((e) => e.jobId === job.id);
    const sum = (kind: string) => entries.filter((e) => e.kind === kind).reduce((n, e) => n + e.credits, 0);
    const spent = job.status === "queued" || job.status === "running" ? sum("reserve") - sum("refund") : sum("commit");
    const label = { queued: "Preparing", running: "Preparing", done: "Ready", failed: "Stopped, unused credits returned", canceled: "Stopped, unused credits returned" }[job.status];
    rows.push({ at: job.createdAt, text: `${text?.title ?? "A book"} read by ${owner?.displayName ?? "a storyteller"}`, credits: -spent, status: label });
  }
  return rows.sort((a, b) => b.at.localeCompare(a.at));
}

const ARCHIVE_NO_NEW = "Preparing new stories needs Readli Family. Your Family Archive keeps the stories you've already prepared";
const WITHDRAWN_NO_NEW = "This storyteller deleted their voice, so no new stories can be made in it. Stories already prepared still play";
const PAUSED_NO_NEW = "This storyteller has stopped new stories in their voice for now. Stories already prepared still play";
const paused = (state: FamilyState, voiceId: string) => state.voices.some((v) => v.id === voiceId && v.pausedAt);

function requirePreparable(state: FamilyState, plan: PlanConfig, householdId: string, voiceId: string) {
  if (!familyEntitlement(state, householdId)) {
    const archive = activeEntitlement(state, householdId) !== null;
    throw new PermissionError(402, "no_family_plan", archive ? `${ARCHIVE_NO_NEW}.` : "Preparing narration needs Readli Family.");
  }
  if (state.voices.some((v) => v.id === voiceId && v.status === "withdrawn")) throw new PermissionError(409, "voice_withdrawn", `${WITHDRAWN_NO_NEW}.`);
  if (paused(state, voiceId)) throw new PermissionError(409, "voice_paused", `${PAUSED_NO_NEW}.`);
  if (!readyVoice(state, voiceId) || !activeShare(state, voiceId, householdId)) {
    throw new PermissionError(403, "voice_not_shared", "This storyteller hasn't shared their voice with your family.");
  }
  if (!activeSlot(state, voiceId, householdId, plan)) {
    throw new PermissionError(409, "needs_slot", "Add this storyteller to a narrator slot first.");
  }
}

export type Availability = "ready" | "partial" | "preparing" | "available" | "needs_credits" | "unavailable";

export const AVAILABILITY_LABELS: Record<Availability, string> = {
  ready: "Ready",
  partial: "Partially ready",
  preparing: "Preparing",
  available: "Available to generate",
  needs_credits: "More credits needed",
  unavailable: "Unavailable",
};

export interface ChapterView {
  number: number;
  title: string;
  readiness: Readiness;
  sentences: number;
  ready: number;
  /** Credits to prepare what's missing in this chapter. */
  credits: number;
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
  availability: Availability;
  availabilityLabel: string;
  /** Why this narrator can't be prepared or played, when Unavailable. */
  unavailableReason: string | null;
  /**
   * Stories kids hear from an earlier recording (or earlier settings) of this voice, when that isn't
   * the library `status` describes: after the owner records again, finished books keep their audio.
   */
  stored: { version: number; ready: number; total: number } | null;
  /** Why nothing new can be made in this voice here (plan ended, voice deleted, new stories paused), when that's the reason. */
  noNewReason: string | null;
  /** Where a parent fixes that reason, so Unavailable is never a dead end. */
  fix: { label: string; href: string } | null;
  /** Some of this book is stored in this voice and a grown-up here may play it. */
  canListen: boolean;
  /** The grown-up looking at the page owns this voice, so they can share it with the family right here. */
  yours: boolean;
  /** Each child in the family and whether they may hear this storyteller. */
  kids: { id: string; name: string; approved: boolean }[];
  /** Why the last preparation of this book in this voice stopped, when it did. */
  lastFailure: string | null;
  /** Credits to prepare everything still missing in this book. */
  missingCredits: number;
  /** How many more credits the household needs to prepare the rest of the book. */
  extraCreditsNeeded: number;
  estimateSeconds: number;
  chapters: ChapterView[];
  jobId: string | null;
}

export interface PrepareBookView {
  householdId: string;
  book: { slug: string; title: string; author: string; sentences: number; minutes: number; chapters: number; coverUrl: string | null; tint: string };
  voices: PrepareVoiceView[];
  credits: CreditBalance;
  /** A parent can buy credits here: real checkout once approved, or the preview's simulated one. */
  canBuyCredits: boolean;
  simulatedCheckout: boolean;
  chapterGenerationEnabled: boolean;
  /** Narrator slots the family has free, so a storyteller can go into one right here. */
  freeSlots: number;
  /** Shorter books one of this family's narrators can prepare with the current balance. */
  shorterThatFit: { slug: string; title: string; coverUrl: string | null; credits: number; narrator: string }[];
}

function missingByChapter(state: FamilyState, plan: PlanConfig, library: NarrationLibrary, text: BookText): ChapterView[] {
  const segs = segmentsOf(state, library.key);
  const byId = new Map(text.sentences.map((x) => [x.id, x]));
  return text.chapters.map((c) => {
    let ready = 0;
    let preparing = 0;
    let credits = 0;
    for (const id of c.sentenceIds) {
      const seg = segs.get(id);
      if (seg?.status === "ready" && seg.storageKey) ready += 1;
      else if (seg && activeJob(state, seg.jobId)) preparing += 1;
      else credits += creditsFor(byId.get(id)!.text.length);
    }
    const total = c.sentenceIds.length;
    const readiness: Readiness = ready === total ? "ready" : preparing > 0 ? "preparing" : ready > 0 ? "partial" : "not_prepared";
    return { number: c.number, title: c.title, readiness, sentences: total, ready, credits };
  });
}

/** The page where a parent clears the reason a narrator is unavailable. */
function fixFor(state: FamilyState, plan: PlanConfig, householdId: string, voiceId: string, kids: { id: string }[]): { label: string; href: string } | null {
  if (!activeEntitlement(state, householdId)) return { label: "See Readli Family plans", href: "/family/billing" };
  if (!readyVoice(state, voiceId) || !activeShare(state, voiceId, householdId)) return null;
  if (!activeSlot(state, voiceId, householdId, plan)) return { label: "Manage narrator slots", href: "/family/narrators" };
  if (kids.length === 0) return { label: "Add a child", href: "/family/kids" };
  if (kids.length === 1) return { label: "Approve for your child", href: `/family/kids/${kids[0]!.id}/storytellers` };
  return { label: "Approve for a child", href: "/family/kids" };
}

/** Why a household can't prepare (or a child can't hear) this narrator, or null. */
function unavailableReason(state: FamilyState, plan: PlanConfig, householdId: string, voiceId: string, approvedFor: string[], yours = false): string | null {
  if (!familyEntitlement(state, householdId)) return activeEntitlement(state, householdId) ? ARCHIVE_NO_NEW : "Needs Readli Family";
  if (state.voices.some((v) => v.id === voiceId && v.status === "withdrawn")) return WITHDRAWN_NO_NEW;
  if (paused(state, voiceId)) return PAUSED_NO_NEW;
  if (!readyVoice(state, voiceId) || !activeShare(state, voiceId, householdId)) {
    return yours ? "Share your voice with this family first" : "This storyteller hasn't shared their voice with your family";
  }
  if (!activeSlot(state, voiceId, householdId, plan)) return "Add this storyteller to a narrator slot first";
  if (approvedFor.length === 0) return "Not approved for any child yet";
  return null;
}

function voiceView(state: FamilyState, plan: PlanConfig, householdId: string, text: BookText, voiceId: string, available: number, viewerId?: string): PrepareVoiceView {
  const v = state.voices.find((x) => x.id === voiceId)!;
  const owner = state.adults.find((a) => a.id === v.ownerId)!;
  const kids = state.children.filter((c) => c.householdId === householdId && c.deletedAt === null);
  const current = libraryFor(state, plan, v.id, text, householdId);
  const playing = playbackLibrary(state, plan, v.id, text, householdId);
  const canPrepare = v.status === "ready" && familyEntitlement(state, householdId) !== null;
  // Where nothing new can be made, show what's stored; otherwise what preparing would add to.
  const library = canPrepare ? current : playing;
  const status = libraryStatus(state, library, text);
  const playingStatus = playing.key === library.key ? null : libraryStatus(state, playing, text);
  const chapters = missingByChapter(state, plan, library, text);
  const missingCredits = canPrepare ? chapters.reduce((n, c) => n + c.credits, 0) : 0;
  const job = state.jobs.find((j) => j.libraryKey === library.key && j.householdId === householdId && (j.status === "queued" || j.status === "running"));
  const approved = new Set(
    kids.filter((c) => (canPrepare ? childVoiceAccess(state, c.id, v.id, plan) : storedNarrationAccess(state, c.id, v.id, plan)).allowed).map((c) => c.id),
  );
  const approvedFor = kids.filter((c) => approved.has(c.id)).map((c) => c.nickname);
  const yours = viewerId !== undefined && v.ownerId === viewerId;
  const reason = unavailableReason(state, plan, householdId, v.id, approvedFor, yours);
  const last = state.jobs
    .filter((j) => j.libraryKey === library.key && j.householdId === householdId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const failedSeg = last?.status === "failed" ? state.segments.find((x) => x.libraryKey === library.key && x.status === "failed" && x.error) : undefined;
  const availability: Availability =
    !canPrepare && status.ready > 0
      ? status.readiness === "ready"
        ? "ready"
        : "partial"
      : reason
        ? "unavailable"
        : status.readiness === "ready"
          ? "ready"
          : status.readiness === "preparing"
            ? "preparing"
            : status.readiness === "partial"
              ? "partial"
              : missingCredits <= available
                ? "available"
                : "needs_credits";
  return {
    voiceId: v.id,
    name: owner.displayName,
    tint: owner.tint,
    avatarUrl: owner.avatarUrl,
    shared: Boolean(storedShare(state, v.id, householdId)),
    inSlot: activeSlot(state, v.id, householdId, plan) !== null,
    approvedFor,
    status,
    readinessLabel: READINESS_LABELS[status.readiness],
    availability,
    availabilityLabel: AVAILABILITY_LABELS[availability],
    unavailableReason: reason,
    noNewReason: reason === ARCHIVE_NO_NEW || reason === WITHDRAWN_NO_NEW || reason === PAUSED_NO_NEW ? reason : null,
    stored: playingStatus && playingStatus.ready > 0 ? { version: playing.voiceVersion, ready: playingStatus.ready, total: playingStatus.total } : null,
    fix: reason ? fixFor(state, plan, householdId, v.id, kids) : null,
    canListen: status.ready > 0 && guardianVoiceAccess(state, plan, householdId, v.id),
    yours,
    kids: kids.map((c) => ({ id: c.id, name: c.nickname, approved: approved.has(c.id) })),
    lastFailure:
      last?.status === "failed" && status.readiness !== "ready"
        ? `We couldn't finish preparing this, and unused credits were returned.${failedSeg?.error ? ` (${failedSeg.error})` : ""}`
        : null,
    missingCredits,
    extraCreditsNeeded: Math.max(0, missingCredits - available),
    estimateSeconds: status.missingCharacters ? estimateSeconds(status.missingCharacters, library.modelId) : 0,
    chapters,
    jobId: job?.id ?? null,
  };
}

/**
 * Narrators this household could use: every ready voice shared with it, voices whose owners have
 * deleted them but whose stories this family keeps, and (on the prepare page) the viewer's own ready
 * voice, which they can share with the family in place.
 */
function householdVoiceIds(state: FamilyState, householdId: string, viewerId?: string): string[] {
  return state.voices
    .filter((v) =>
      v.status === "withdrawn"
        ? storedShare(state, v.id, householdId) !== null
        : v.status === "ready" &&
          v.deletedAt === null &&
          (activeShare(state, v.id, householdId) || (viewerId !== undefined && v.ownerId === viewerId && isActiveMember(state, viewerId, householdId))),
    )
    .sort((a, b) => Number(b.ownerId === viewerId) - Number(a.ownerId === viewerId))
    .map((v) => v.id);
}

/** Full-book narration length estimate, in minutes. */
export function bookMinutes(text: BookText, plan: PlanConfig): number {
  return Math.round((estimateSeconds(bookCharacters(text), plan.narrationModelId) / 60) * 10) / 10;
}

export async function prepareView(store: FamilyStore, actor: Actor | null, householdId: string, slug: string, clock: Clock = now): Promise<PrepareBookView> {
  const state = await store.read();
  const viewerId = requireHouseholdGuardian(state, actor, householdId);
  const text = bookText(slug);
  if (!text) throw new PermissionError(404, "unknown_book", "That book isn't in the library yet.");
  const plan = store.plan;
  const book = findCatalogBook(slug)!;
  const credits = creditBalance(state, plan, householdId, clock().toISOString());
  const voices = householdVoiceIds(state, householdId, viewerId).map((id) => voiceView(state, plan, householdId, text, id, credits.available, viewerId));
  const needsMore = voices.some((v) => v.availability === "needs_credits" || (v.availability === "partial" && v.extraCreditsNeeded > 0));
  const shorterThatFit: PrepareBookView["shorterThatFit"] = [];
  if (needsMore) {
    for (const other of CATALOG) {
      if (other.slug === slug) continue;
      const t = bookText(other.slug)!;
      if (bookCharacters(t) >= bookCharacters(text)) continue;
      const fit = householdVoiceIds(state, householdId)
        .map((id) => voiceView(state, plan, householdId, t, id, credits.available))
        .find((v) => v.availability === "available");
      if (fit) shorterThatFit.push({ slug: other.slug, title: other.title, coverUrl: other.coverUrl, credits: fit.missingCredits, narrator: fit.name });
    }
  }
  return {
    householdId,
    book: {
      slug,
      title: text.title,
      author: book.author,
      sentences: text.sentences.length,
      minutes: bookMinutes(text, plan),
      chapters: text.chapters.length,
      coverUrl: book.coverUrl,
      tint: book.tint,
    },
    voices,
    credits,
    canBuyCredits: plan.narrationPurchasesEnabled || plan.simulatedCheckout,
    simulatedCheckout: !plan.narrationPurchasesEnabled && plan.simulatedCheckout,
    chapterGenerationEnabled: plan.chapterGenerationEnabled && text.chapters.length > 1,
    freeSlots: Math.max(0, narratorSlotCount(state, householdId, plan) - liveSlots(state, householdId, plan).length),
    shorterThatFit: shorterThatFit.slice(0, 3),
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
  /** Exact Readli credits this request reserves. */
  credits: number;
  estimateSeconds: number;
  /** Already-stored segments reused for free. */
  reusedReady: number;
  /** Segments another request is already generating (that request pays). */
  alreadyQueued: number;
  scope: GenerationRequest["scope"];
  chapter: { number: number; title: string } | null;
  book: { title: string };
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

/**
 * What a request would cost, from the book's actual text and the configured model. Only text with
 * no stored or in-progress audio is charged; authorized cached narration is free.
 */
export function quote(state: FamilyState, plan: PlanConfig, householdId: string, req: GenerationRequest): GenerationQuote {
  const text = bookText(req.bookSlug);
  if (!text) throw new PermissionError(404, "unknown_book", "That book isn't in the library yet.");
  if (req.scope === "chapter" && !text.chapters.some((c) => c.number === req.chapter)) {
    throw new PermissionError(400, "bad_chapter", "That chapter isn't in this book.");
  }
  if (req.scope === "chapter" && !plan.chapterGenerationEnabled) {
    throw new PermissionError(409, "chapters_off", "Preparing one chapter at a time isn't available.");
  }
  const library = libraryFor(state, plan, req.voiceId, text, householdId);
  const segs = segmentsOf(state, library.key);
  const missing: string[] = [];
  let characters = 0;
  let credits = 0;
  let reusedReady = 0;
  let alreadyQueued = 0;
  for (const s of requestedSentences(text, req)) {
    const seg = segs.get(s.id);
    if (seg?.status === "ready" && seg.storageKey) reusedReady += 1;
    else if (seg && activeJob(state, seg.jobId)) alreadyQueued += 1;
    else {
      missing.push(s.id);
      characters += s.text.length;
      credits += creditsFor(s.text.length);
    }
  }
  const chapter = req.scope === "chapter" ? text.chapters.find((c) => c.number === req.chapter)! : null;
  return {
    sentenceIds: missing,
    characters,
    credits,
    estimateSeconds: characters ? estimateSeconds(characters, library.modelId) : 0,
    reusedReady,
    alreadyQueued,
    scope: req.scope,
    chapter: chapter ? { number: chapter.number, title: chapter.title } : null,
    book: { title: text.title },
  };
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
/**
 * Whether a household may make this request now (Kevin, 2026-10-11, decision 6; 2026-10-12, answer 4):
 * request counts per hour (tighter during the free trial, with a daily trial cap), characters per day,
 * the size of one request, and preparations at once. Credits remain the real quota, checked after
 * this; asking again for audio already queued or stored is free and never counts. The limits come from
 * the plan, so an admin can tune them on /admin/plans.
 */
export function generationLimit(
  state: FamilyState,
  limits: GenerationLimits,
  householdId: string,
  at: string,
  characters: number,
): { code: string; message: string; status: number } | null {
  const t = Date.parse(at);
  const mine = state.jobs.filter((j) => j.householdId === householdId);
  const recent = (ms: number) => mine.filter((j) => t - Date.parse(j.createdAt) < ms).length;
  const e = activeEntitlement(state, householdId, at);
  const trial = e ? inTrial(e, at) : false;
  if (characters > limits.maxRequestCharacters) {
    return { status: 413, code: "request_too_large", message: "That's a lot to prepare in one go. Please prepare it a chapter at a time." };
  }
  if (mine.filter((j) => j.status === "queued" || j.status === "running").length >= (trial ? limits.trialMaxConcurrentJobs : limits.maxConcurrentJobs)) {
    return { status: 429, code: "too_many_at_once", message: "You've got stories being prepared already. Please wait for one to finish, then try again." };
  }
  if (trial && recent(86_400_000) >= limits.trialRequestsPerDay) {
    return { status: 429, code: "trial_rate_limited", message: "You've prepared a lot of stories today on your free trial. Try again tomorrow." };
  }
  if (recent(3_600_000) >= (trial ? limits.trialRequestsPerHour : limits.requestsPerHour)) {
    return { status: 429, code: "rate_limited", message: "You've asked for a lot of stories in the last hour. Please try again a little later." };
  }
  // Characters reserved in the last 24 hours, less any refunded when a preparation stopped (credits are kept in characters).
  const day = state.ledger.filter((l) => l.householdId === householdId && t - Date.parse(l.at) < 86_400_000);
  const used = day.filter((l) => l.kind === "reserve").reduce((n, l) => n + l.credits, 0) - day.filter((l) => l.kind === "refund").reduce((n, l) => n + l.credits, 0);
  if (used + characters > (trial ? limits.trialCharactersPerDay : limits.charactersPerDay)) {
    return { status: 429, code: "daily_characters", message: "You've prepared a lot of story today. Please try again tomorrow, or prepare a shorter part now." };
  }
  return null;
}

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
    const limited = generationLimit(s, store.plan.generationLimits, householdId, at, q.characters);
    if (limited) throw new PermissionError(limited.status, limited.code, limited.message);
    const lots = spendableLots(s, store.plan, householdId, at);
    const available = lots.reduce((n, l) => n + l.left, 0);
    if (q.credits > available) {
      throw new PermissionError(402, "not_enough_credits", "Not enough Readli credits for this. Get more credits or prepare a chapter at a time.", {
        needed: q.credits,
        available,
        extra: q.credits - available,
      });
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
      const draws = draw(lots, creditsFor(sentence.text.length))!;
      job.reservations[id] = draws;
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
      for (const d of draws) s.ledger.push({ id: randomUUID(), householdId, lotId: d.lotId, kind: "reserve", credits: d.credits, jobId: job.id, sentenceId: id, at });
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
    if (!ledgerHas(s, job.id, id, "commit") && !ledgerHas(s, job.id, id, "refund")) {
      for (const d of job.reservations[id] ?? []) {
        s.ledger.push({ id: randomUUID(), householdId: job.householdId, lotId: d.lotId, kind: "refund", credits: d.credits, jobId: job.id, sentenceId: id, at });
      }
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
    stopJob(s, job, at);
    audit(s, adultId, "narration_canceled", at, { householdId: job.householdId, detail: job.libraryKey });
  });
}

/**
 * Generates a job's segments in order. Resumable: it picks up wherever it stopped. A segment is
 * marked ready only after its audio is stored and read back. Failed segments retry up to the plan's
 * limit. Credits are committed per segment at most once (capped at what was reserved; Readli
 * absorbs any overrun), and anything not generated is refunded when the job ends.
 */
export async function runJob(store: FamilyStore, provider: VoiceProvider, jobId: string, clock: Clock = now, deadline = Infinity): Promise<NarrationJob> {
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

  let outOfTime = false;
  for (const id of job.sentenceIds) {
    if (job.status !== "running") break; // canceled
    // Stop between sentences when this worker's time is up; the next one picks up from here.
    if (Date.now() > deadline) {
      outOfTime = true;
      break;
    }
    const seg = state.segments.find((x) => x.libraryKey === job.libraryKey && x.sentenceId === id)!;
    if (seg.jobId !== job.id || seg.status === "ready") continue;
    // The owner may have revoked or deleted the voice, or the family moved to the Archive, since the job was confirmed.
    if (!voice || voice.deletedAt || voice.pausedAt || !activeShare(state, voice.id, job.householdId) || !familyEntitlement(state, job.householdId)) break;
    while ((seg.status as string) !== "ready" && seg.attempts < store.plan.maxSegmentAttempts && job.status === "running") {
      await store.write(() => {
        seg.status = "generating";
        seg.attempts += 1;
      });
      try {
        const sentence = byId.get(id)!;
        const { audio, contentType } = await provider.synthesize({ voiceId: voice.id, text: sentence.text, modelId: library.modelId });
        const storageKey = `${library.key.replaceAll(":", "/")}/${id}`;
        await store.audio.put(storageKey, audio, contentType);
        if (!(await store.audio.exists(storageKey))) throw new Error("stored audio not readable");
        const at = clock().toISOString();
        const durationMs = Math.round((sentence.text.length / modelCost(library.modelId).charactersPerMinute) * 60_000);
        const cost = modelCost(library.modelId);
        const credits = Math.ceil(sentence.text.length * cost.creditsPerCharacter);
        await store.write((s) => {
          Object.assign(seg, { status: "ready", storageKey, durationMs, providerCredits: credits, error: null, readyAt: at });
          s.usage.push({
            id: randomUUID(),
            libraryKey: library.key,
            sentenceId: id,
            householdId: job.householdId,
            jobId: job.id,
            modelId: library.modelId,
            characters: sentence.text.length,
            providerCredits: credits,
            usd: (sentence.text.length / 1000) * cost.usdPer1kCharacters,
            attempts: seg.attempts,
            durationMs,
            bytes: audio.byteLength,
            at,
          });
          if (!ledgerHas(s, job.id, id, "commit")) {
            // Reconcile: commit the characters actually generated (never more than reserved), lot by
            // lot in the order they were drawn, and return the rest to its lot.
            let actual = creditsFor(sentence.text.length);
            for (const d of job.reservations[id] ?? []) {
              const used = Math.min(d.credits, actual);
              actual -= used;
              s.ledger.push({ id: randomUUID(), householdId: job.householdId, lotId: d.lotId, kind: "commit", credits: used, jobId: job.id, sentenceId: id, at });
              if (d.credits > used) {
                s.ledger.push({ id: randomUUID(), householdId: job.householdId, lotId: d.lotId, kind: "refund", credits: d.credits - used, jobId: job.id, sentenceId: id, at });
              }
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

  if (outOfTime) return job;
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
        : `We couldn't finish preparing ${text.title} in ${owner?.displayName ?? "that voice"}. Unused credits were returned.`,
      href: `/family/books/${text.slug}`,
      at,
      readAt: null,
    });
  });
  return job;
}

/**
 * Runs a household's queued and interrupted jobs (background worker). Each job is leased first, so two
 * workers never prepare the same job at once; a worker stops at `budgetMs` and the next request resumes.
 */
export async function runPendingJobs(
  store: FamilyStore,
  provider: VoiceProvider,
  opts: { householdId?: string; budgetMs?: number } = {},
  clock: Clock = now,
) {
  const deadline = opts.budgetMs === undefined ? Infinity : Date.now() + opts.budgetMs;
  const leaseMs = opts.budgetMs === undefined ? 10 * 60_000 : opts.budgetMs + 60_000;
  const state = await store.read();
  const pending = state.jobs.filter((j) => (j.status === "queued" || j.status === "running") && (!opts.householdId || j.householdId === opts.householdId));
  for (const job of pending) {
    if (Date.now() > deadline) break;
    if (store.claimJob && !(await store.claimJob(job.id, leaseMs))) continue;
    try {
      await runJob(store, provider, job.id, clock, deadline);
    } finally {
      await store.releaseJob?.(job.id);
    }
  }
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
    .filter((v) => storedNarrationAccess(state, childId, v.id, store.plan).allowed)
    .map((v) => {
      const status = libraryStatus(state, playbackLibrary(state, store.plan, v.id, text, child.householdId), text);
      return { voiceId: v.id, readySentenceIds: status.readySentenceIds, readiness: status.readiness };
    });
}

interface PlaybackClaims {
  lk: string;
  sid: string;
  /** The child listening; empty when a grown-up listens. */
  c: string;
  /** The household a grown-up listens in, for grown-up playback. */
  h?: string;
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
 * a Readli Family or Family Archive plan, the narrator slot where one applies, this child's approval,
 * and a live listening session. Never calls the voice provider: playback only reads stored audio, so
 * it works after the owner deletes their voice or its clone is retired.
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
  const access = storedNarrationAccess(state, input.childId, input.voiceId, store.plan);
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
  const library = playbackLibrary(state, store.plan, input.voiceId, text, child.householdId);
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
  if (claims.h) {
    try {
      requireHouseholdGuardian(state, actor, claims.h);
    } catch {
      throw NOT_AVAILABLE;
    }
    if (!guardianVoiceAccess(state, store.plan, claims.h, claims.v)) throw NOT_AVAILABLE;
  } else {
    try {
      requireChildAccess(state, actor, claims.c);
    } catch {
      throw NOT_AVAILABLE;
    }
    if (!storedNarrationAccess(state, claims.c, claims.v, store.plan).allowed) throw NOT_AVAILABLE;
  }
  if (state.libraries.find((l) => l.key === claims.lk)?.voiceId !== claims.v) throw NOT_AVAILABLE;
  const seg = segmentsOf(state, claims.lk).get(claims.sid);
  const object = seg?.status === "ready" && seg.storageKey ? await store.audio.get(seg.storageKey) : null;
  if (!object) throw NOT_AVAILABLE;
  return object;
}

// ---------------------------------------------------------------------------
// Grown-up listening
// ---------------------------------------------------------------------------

/**
 * A grown-up in the household may listen to a voice the family can use: a live plan, the owner's
 * share and a narrator slot. Unlike a child, no per-child approval is needed.
 */
function guardianVoiceAccess(state: FamilyState, plan: PlanConfig, householdId: string, voiceId: string): boolean {
  return Boolean(activeEntitlement(state, householdId) && readyVoice(state, voiceId) && activeShare(state, voiceId, householdId) && activeSlot(state, voiceId, householdId, plan));
}

export interface ListenVoice {
  voiceId: string;
  name: string;
  avatarUrl: string | null;
  tint: string;
  readySentenceIds: string[];
  /** Every sentence of the book is stored in this voice. */
  complete: boolean;
}

export interface ListenView {
  householdId: string;
  book: { slug: string; title: string; author: string; coverUrl: string | null; tint: string };
  sentences: string[];
  sentenceIds: string[];
  /** Voices this grown-up may hear with at least some of the book prepared, finished books first. */
  voices: ListenVoice[];
}

/** The grown-up player for one book: its text and the prepared audio the household may play. */
export async function listenView(store: FamilyStore, actor: Actor | null, householdId: string, slug: string): Promise<ListenView> {
  const state = await store.read();
  requireHouseholdGuardian(state, actor, householdId);
  const book = findCatalogBook(slug);
  const text = bookText(slug);
  if (!book || !text) throw new PermissionError(404, "not_found", "We couldn't find that book.");
  const voices = householdVoiceIds(state, householdId)
    .filter((id) => guardianVoiceAccess(state, store.plan, householdId, id))
    .map((id): ListenVoice => {
      const owner = state.adults.find((a) => a.id === voiceOwnerOf(state, id));
      const segs = segmentsOf(state, libraryFor(state, store.plan, id, text, householdId).key);
      const readySentenceIds = text.sentences.filter((x) => segs.get(x.id)?.status === "ready" && segs.get(x.id)?.storageKey).map((x) => x.id);
      return { voiceId: id, name: owner?.displayName ?? "A storyteller", avatarUrl: owner?.avatarUrl ?? null, tint: owner?.tint ?? "bg-lavender", readySentenceIds, complete: readySentenceIds.length === text.sentences.length };
    })
    .filter((v) => v.readySentenceIds.length > 0)
    .sort((a, b) => Number(b.complete) - Number(a.complete));
  return {
    householdId,
    book: { slug: book.slug, title: book.title, author: book.author, coverUrl: book.coverUrl, tint: book.tint },
    sentences: text.sentences.map((x) => x.text),
    sentenceIds: text.sentences.map((x) => x.id),
    voices,
  };
}

function voiceOwnerOf(state: FamilyState, voiceId: string): string | undefined {
  return state.voices.find((v) => v.id === voiceId)?.ownerId;
}

/**
 * A short-lived URL for one prepared sentence, for a grown-up listening in the Parent Portal. Only
 * stored audio is served; nothing is generated here.
 */
export async function authorizeGuardianPlayback(
  store: FamilyStore,
  actor: Actor | null,
  input: { householdId: string; voiceId: string; bookSlug: string; sentence: number },
  key: string,
  clock: Clock = now,
): Promise<{ url: string; expiresAt: string }> {
  const state = await store.read();
  requireHouseholdGuardian(state, actor, input.householdId);
  if (!guardianVoiceAccess(state, store.plan, input.householdId, input.voiceId)) throw NOT_AVAILABLE;
  const text = bookText(input.bookSlug);
  const sentence = text?.sentences[input.sentence];
  if (!text || !sentence) throw new PermissionError(400, "bad_sentence", "That page doesn't exist.");
  const library = libraryFor(state, store.plan, input.voiceId, text, input.householdId);
  const seg = segmentsOf(state, library.key).get(sentence.id);
  if (seg?.status !== "ready" || !seg.storageKey) throw new PermissionError(409, "not_prepared", "This part isn't prepared in that voice yet.");
  const exp = clock().getTime() + store.plan.playbackUrlTtlSeconds * 1000;
  const token = signPlayback({ lk: library.key, sid: sentence.id, c: "", h: input.householdId, v: input.voiceId, exp }, key);
  return { url: `/api/narration/audio/${token}`, expiresAt: new Date(exp).toISOString() };
}

// ---------------------------------------------------------------------------
// Deletion
// ---------------------------------------------------------------------------

/**
 * Ends a job that hasn't finished: unfinished sentences are released and their reserved credits go
 * back to the lots that paid, once (settleUnfinished checks the ledger, so repeating this refunds
 * nothing twice). Sentences already delivered stay paid for.
 */
export function stopJob(s: FamilyState, job: NarrationJob, at: string) {
  if (job.status !== "queued" && job.status !== "running") return false;
  job.status = "canceled";
  job.finishedAt = at;
  settleUnfinished(s, job, at);
  return true;
}

/**
 * When a voice's owner deletes it: stops every narration still being prepared in it, in every family,
 * and refunds the credits those jobs hadn't used. Stories already prepared stay, for the families the
 * voice was shared with. Removing the audio itself is only ever a legally required removal
 * (src/lib/lifecycle/legal-removal.ts).
 */
export async function stopVoiceNarration(store: FamilyStore, voiceId: string, clock: Clock = now): Promise<number> {
  const state = await store.read();
  const keys = new Set(state.libraries.filter((l) => l.voiceId === voiceId).map((l) => l.key));
  const at = clock().toISOString();
  let stopped = 0;
  await store.write((s) => {
    for (const job of s.jobs) if (keys.has(job.libraryKey) && stopJob(s, job, at)) stopped += 1;
  });
  return stopped;
}

/** Stops a household's unfinished narration (moving to the Archive) and refunds what it hadn't used. */
export function stopHouseholdNarration(s: FamilyState, householdId: string, at: string): number {
  let stopped = 0;
  for (const job of s.jobs) if (job.householdId === householdId && stopJob(s, job, at)) stopped += 1;
  return stopped;
}
