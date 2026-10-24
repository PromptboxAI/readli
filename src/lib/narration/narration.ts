import { createHash, createHmac, randomUUID } from "node:crypto";
import { sameHash } from "@/lib/server/guest-token";
import { voiceSettings } from "@/lib/voice/elevenlabs";
import type { VoiceProvider } from "@/lib/voice/provider";
import type { Actor, CreditLot, FamilyState, NarrationJob, NarrationLibrary, NarrationSegment } from "@/lib/family/model";
import { activeChild, activeEntitlement, activeShare, activeSlot, childVoiceAccess, isActiveMember, liveSlots, narratorSlotCount, readyVoice } from "@/lib/family/permissions";
import { calledIn } from "@/lib/family/names";
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
import { creditBalance, creditsFor, creditUnits, draw, spendableLots, type CreditBalance } from "./credits";
import { CATALOG, findCatalogBook } from "@/lib/library/catalog";
import { THE_END } from "@/lib/content/the-end";
import { revisionInfo } from "@/lib/library/revisions";
import { mapPosition, spokenForm } from "./positions";
import { bookCharacters, bookText, bookTextAt, type BookText, withoutTheEnd } from "./text";
import type { ByteRange } from "./storage";
import { chapterTrack, chapterTrackPlan, tracksFolder, type ChapterTrack, type TrackPlan } from "./tracks";
import { JoinError } from "@/lib/audio/join";

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

/**
 * The closing "The End." when the rest of the story is stored and that line isn't. Audio prepared before
 * every story gained it simply finishes without it (the players stop there), so the book is still Ready.
 */
function unpreparedEnd(segs: Map<string, NarrationSegment>, state: FamilyState, text: BookText): string | null {
  const end = text.sentences.at(-1);
  if (end?.text !== THE_END) return null;
  const stored = (id: string) => {
    const seg = segs.get(id);
    return seg?.status === "ready" && Boolean(seg.storageKey);
  };
  const seg = segs.get(end.id);
  if (stored(end.id) || (seg && activeJob(state, seg.jobId))) return null;
  return text.sentences.every((s) => s === end || stored(s.id)) ? end.id : null;
}

/** Ready only counts segments whose audio is stored; a book is Ready only when every segment is. */
export function libraryStatus(state: FamilyState, library: NarrationLibrary, text: BookText): LibraryStatus {
  const segs = segmentsOf(state, library.key);
  const skip = unpreparedEnd(segs, state, text);
  let ready = 0;
  let inProgress = 0;
  let missingCharacters = 0;
  const readySentenceIds: string[] = [];
  for (const s of text.sentences) {
    if (s.id === skip) continue;
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
  const total = text.sentences.length - (skip ? 1 : 0);
  const readiness: Readiness = ready === total ? "ready" : inProgress > 0 ? "preparing" : ready > 0 ? "partial" : "not_prepared";
  return { readiness, readySentenceIds, total, ready, inProgress, missingCharacters };
}

// ---------------------------------------------------------------------------
// Versioned audiobooks (Kevin, 2026-10-21)
// ---------------------------------------------------------------------------

/** One voice's narration of a book as a family hears it, read along with the text it was made from. */
export interface Narration {
  library: NarrationLibrary;
  text: BookText;
  status: LibraryStatus;
  /** A finished narration of an earlier text or recording, kept because today's isn't finished in this voice. */
  pinned: boolean;
}

/** The text a narration was prepared from: the same book, edition and revision, or null if it was never built. */
export function libraryText(library: NarrationLibrary): BookText | null {
  const text = bookTextAt(library.bookSlug, library.textRevision);
  return text && text.edition === library.edition ? text : null;
}

function lastReadyAt(state: FamilyState, libraryKey: string): string {
  return state.segments.reduce((at, x) => (x.libraryKey === libraryKey && x.readyAt && x.readyAt > at ? x.readyAt : at), "");
}

/**
 * Which narration of a book a family hears in one voice. Today's text when it is finished in this voice;
 * otherwise the most recently finished narration of an earlier text or an earlier recording of the voice,
 * which keeps playing (with its own words) until the family chooses an update and it is finished;
 * otherwise today's text, for new or partial preparation. Editing a book never takes a finished
 * audiobook away, and an update never replaces a working version before every sentence is stored.
 */
export function narrationFor(state: FamilyState, plan: PlanConfig, voiceId: string, today: BookText, householdId: string): Narration {
  const target = libraryFor(state, plan, voiceId, today, householdId);
  const status = libraryStatus(state, target, today);
  if (status.readiness === "ready") return { library: target, text: today, status, pinned: false };
  const earlier: Narration[] = [];
  for (const l of state.libraries) {
    if (l.voiceId !== voiceId || l.bookSlug !== today.slug || l.key === target.key || (l.scope !== "shared" && l.scope !== householdId)) continue;
    const text = libraryText(l);
    const done = text ? libraryStatus(state, l, text) : null;
    if (text && done?.readiness === "ready") earlier.push({ library: l, text, status: done, pinned: true });
  }
  earlier.sort((a, b) => lastReadyAt(state, b.library.key).localeCompare(lastReadyAt(state, a.library.key)));
  return earlier[0] ?? { library: target, text: today, status, pinned: false };
}

/**
 * Audio this voice already has for sentences of `text` that `target` is missing: the same recording,
 * model, settings and sharing, a narration of the same book, and the sentence said the same way.
 * Each sentence is generated on its own, so reused and new sentences join exactly as they always have.
 */
function reusableAudio(state: FamilyState, target: NarrationLibrary, text: BookText): Map<string, NarrationSegment> {
  const stored = new Map<string, NarrationSegment>();
  for (const l of state.libraries) {
    if (l.key === target.key || l.voiceId !== target.voiceId || l.voiceVersion !== target.voiceVersion || l.bookSlug !== target.bookSlug) continue;
    if (l.modelId !== target.modelId || l.configHash !== target.configHash || l.scope !== target.scope) continue;
    const t = libraryText(l);
    if (!t) continue;
    const segs = segmentsOf(state, l.key);
    for (const x of t.sentences) {
      const seg = segs.get(x.id);
      if (seg?.status === "ready" && seg.storageKey) stored.set(spokenForm(x.text), seg);
    }
  }
  const own = segmentsOf(state, target.key);
  const out = new Map<string, NarrationSegment>();
  if (!stored.size) return out;
  for (const x of text.sentences) {
    const seg = own.get(x.id);
    if ((seg?.status === "ready" && seg.storageKey) || (seg && activeJob(state, seg.jobId))) continue;
    const from = stored.get(spokenForm(x.text));
    if (from) out.set(x.id, from);
  }
  return out;
}

/** Points the target's missing sentences at audio the voice already has for them (no generation, no credits). */
function adoptReusable(s: FamilyState, target: NarrationLibrary, text: BookText, ids: Set<string> | null, at: string): number {
  let n = 0;
  const byId = new Map(text.sentences.map((x) => [x.id, x]));
  for (const [id, from] of reusableAudio(s, target, text)) {
    if (ids && !ids.has(id)) continue;
    const sentence = byId.get(id)!;
    const reused = { status: "ready" as const, storageKey: from.storageKey, durationMs: from.durationMs, providerCredits: null, jobId: null, error: null, readyAt: at };
    const existing = s.segments.find((x) => x.libraryKey === target.key && x.sentenceId === id);
    if (existing) Object.assign(existing, reused);
    else s.segments.push({ libraryKey: target.key, sentenceId: id, ordinal: sentence.ordinal, characters: sentence.text.length, attempts: 0, ...reused });
    n += 1;
  }
  return n;
}

/** Today's text is a free Readli correction for a family whose finished narration is of an earlier text. */
function freeCorrection(state: FamilyState, plan: PlanConfig, voiceId: string, today: BookText, householdId: string): boolean {
  if (!revisionInfo(today.slug, today.revision)?.correction) return false;
  const heard = narrationFor(state, plan, voiceId, today, householdId);
  return heard.pinned && heard.text.revision !== today.revision;
}

export interface BookUpdate {
  revision: string;
  /** Credits the update costs this family; 0 for a Readli correction or when every changed line is already stored. */
  credits: number;
  free: boolean;
  /** Lines the update reads differently: what the current audiobook says, and what the update says. */
  before: string[];
  after: string[];
  changed: number;
}

/** What changed between a family's audiobook and today's text, and what updating would cost. */
function bookUpdate(state: FamilyState, plan: PlanConfig, householdId: string, voiceId: string, heard: Narration, today: BookText): BookUpdate | null {
  if (!heard.pinned || heard.text.revision === today.revision) return null;
  const said = new Set(heard.text.sentences.map((x) => spokenForm(x.text)));
  const says = new Set(today.sentences.map((x) => spokenForm(x.text)));
  const after = today.sentences.filter((x) => !said.has(spokenForm(x.text))).map((x) => x.text);
  const before = heard.text.sentences.filter((x) => !says.has(spokenForm(x.text))).map((x) => x.text);
  const q = quote(state, plan, householdId, { voiceId, bookSlug: today.slug, scope: "book" });
  return { revision: today.revision, credits: q.credits, free: q.free, before: before.slice(0, 12), after: after.slice(0, 12), changed: Math.max(before.length, after.length) };
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
  if (!activeEntitlement(state, householdId)) throw new PermissionError(402, "no_family_plan", "Narration credits come with Readli Family.");
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
    const text = library ? (libraryText(library) ?? bookText(library.bookSlug)) : null;
    const owner = library ? calledIn(state, state.adults.find((a) => a.id === state.voices.find((v) => v.id === library.voiceId)?.ownerId), householdId) : null;
    const entries = state.ledger.filter((e) => e.jobId === job.id);
    const sum = (kind: string) => entries.filter((e) => e.kind === kind).reduce((n, e) => n + e.credits, 0);
    const spent = job.status === "queued" || job.status === "running" ? sum("reserve") - sum("refund") : sum("commit");
    const label = { queued: "Preparing", running: "Preparing", done: "Ready", failed: "Stopped, unused credits returned", canceled: "Stopped, unused credits returned" }[job.status];
    rows.push({ at: job.createdAt, text: `${text?.title ?? "A book"} read by ${owner?.displayName ?? "a storyteller"}`, credits: -spent, status: label });
  }
  return rows.sort((a, b) => b.at.localeCompare(a.at));
}

function requirePreparable(state: FamilyState, plan: PlanConfig, householdId: string, voiceId: string) {
  if (!activeEntitlement(state, householdId)) throw new PermissionError(402, "no_family_plan", "Preparing narration needs Readli Family.");
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
  /** Today's text differs from the finished audiobook this family hears; offered, never applied for them. */
  update: BookUpdate | null;
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
  const skip = unpreparedEnd(segs, state, text);
  const byId = new Map(text.sentences.map((x) => [x.id, x]));
  return text.chapters.map((c) => {
    let ready = 0;
    let preparing = 0;
    let credits = 0;
    const ids = c.sentenceIds.filter((id) => id !== skip);
    for (const id of ids) {
      const seg = segs.get(id);
      if (seg?.status === "ready" && seg.storageKey) ready += 1;
      else if (seg && activeJob(state, seg.jobId)) preparing += 1;
      else credits += creditsFor(byId.get(id)!.text.length);
    }
    const total = ids.length;
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
  if (!activeEntitlement(state, householdId)) return "Needs Readli Family";
  if (!readyVoice(state, voiceId) || !activeShare(state, voiceId, householdId)) {
    return yours ? "Share your voice with this family first" : "This storyteller hasn't shared their voice with your family";
  }
  if (!activeSlot(state, voiceId, householdId, plan)) return "Add this storyteller to a narrator slot first";
  if (approvedFor.length === 0) return "Not approved for any child yet";
  return null;
}

function voiceView(state: FamilyState, plan: PlanConfig, householdId: string, text: BookText, voiceId: string, available: number, viewerId?: string): PrepareVoiceView {
  const v = state.voices.find((x) => x.id === voiceId)!;
  const owner = calledIn(state, state.adults.find((a) => a.id === v.ownerId), householdId)!;
  const kids = state.children.filter((c) => c.householdId === householdId && c.deletedAt === null);
  const heard = narrationFor(state, plan, v.id, text, householdId);
  const { library, status } = heard;
  const target = libraryFor(state, plan, v.id, text, householdId);
  const chapters = missingByChapter(state, plan, library, heard.text);
  const missingCredits = chapters.reduce((n, c) => n + c.credits, 0);
  // An update being prepared runs on today's text while the finished audiobook keeps playing.
  const job = state.jobs.find((j) => (j.libraryKey === library.key || j.libraryKey === target.key) && j.householdId === householdId && (j.status === "queued" || j.status === "running"));
  const approved = new Set(kids.filter((c) => childVoiceAccess(state, c.id, v.id, plan).allowed).map((c) => c.id));
  const approvedFor = kids.filter((c) => approved.has(c.id)).map((c) => c.nickname);
  const yours = viewerId !== undefined && v.ownerId === viewerId;
  const reason = unavailableReason(state, plan, householdId, v.id, approvedFor, yours);
  const last = state.jobs
    .filter((j) => j.libraryKey === library.key && j.householdId === householdId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const failedSeg = last?.status === "failed" ? state.segments.find((x) => x.libraryKey === library.key && x.status === "failed" && x.error) : undefined;
  const availability: Availability = reason
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
    shared: Boolean(activeShare(state, v.id, householdId)),
    inSlot: activeSlot(state, v.id, householdId, plan) !== null,
    approvedFor,
    status,
    readinessLabel: READINESS_LABELS[status.readiness],
    availability,
    availabilityLabel: AVAILABILITY_LABELS[availability],
    unavailableReason: reason,
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
    update: reason ? null : bookUpdate(state, plan, householdId, v.id, heard, text),
  };
}

/**
 * Narrators this household could use: every ready voice shared with it, plus (on the prepare page)
 * the viewer's own ready voice, which they can share with the family in place.
 */
function householdVoiceIds(state: FamilyState, householdId: string, viewerId?: string): string[] {
  return state.voices
    .filter(
      (v) =>
        v.status === "ready" &&
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
  /** A Readli correction of a book this family already has: generated without spending their credits. */
  free: boolean;
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
  // Lines this voice already said the same way, in an earlier text of the book, are reused for free.
  const reusable = reusableAudio(state, library, text);
  const free = freeCorrection(state, plan, req.voiceId, text, householdId);
  const missing: string[] = [];
  let characters = 0;
  let credits = 0;
  let reusedReady = 0;
  let alreadyQueued = 0;
  for (const s of requestedSentences(text, req)) {
    const seg = segs.get(s.id);
    if ((seg?.status === "ready" && seg.storageKey) || reusable.has(s.id)) reusedReady += 1;
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
    credits: free ? 0 : credits,
    estimateSeconds: characters ? estimateSeconds(characters, library.modelId) : 0,
    reusedReady,
    alreadyQueued,
    free,
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
    const lots = spendableLots(s, store.plan, householdId, at);
    const available = lots.reduce((n, l) => n + l.left, 0);
    if (q.credits > available) {
      const tip = store.plan.chapterGenerationEnabled && text.chapters.length > 1 ? "Get more credits or prepare a chapter at a time." : "Get more credits or try a shorter story.";
      throw new PermissionError(402, "not_enough_credits", `Not enough Readli credits for this. ${tip}`, {
        needed: q.credits,
        available,
        extra: q.credits - available,
      });
    }
    const library = libraryFor(s, store.plan, req.voiceId, text, householdId);
    const wanted = new Set(requestedSentences(text, req).map((x) => x.id));
    const reuse = reusableAudio(s, library, text);
    if (q.sentenceIds.length === 0 && ![...reuse.keys()].some((id) => wanted.has(id))) return;
    if (!s.libraries.some((l) => l.key === library.key)) s.libraries.push({ ...library, createdAt: at });
    adoptReusable(s, library, text, wanted, at);
    if (q.sentenceIds.length === 0) return;
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
      // A Readli correction is prepared at Readli's cost: nothing is reserved, committed or refunded.
      const draws = q.free ? [] : draw(lots, creditsFor(sentence.text.length))!;
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
export async function runJob(store: FamilyStore, provider: VoiceProvider, jobId: string, clock: Clock = now, deadline = Infinity): Promise<NarrationJob> {
  const state = await store.read();
  const job = state.jobs.find((j) => j.id === jobId);
  if (!job) throw new Error(`no job ${jobId}`);
  if (job.status !== "queued" && job.status !== "running") return job;
  const library = state.libraries.find((l) => l.key === job.libraryKey)!;
  // The text the job was confirmed for, even if the book's text has changed since.
  const text = libraryText(library) ?? bookText(library.bookSlug)!;
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
    // The owner may have revoked, or the voice been deleted, since the job was confirmed.
    if (!voice || voice.deletedAt || !activeShare(state, voice.id, job.householdId)) break;
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
    const owner = voice ? calledIn(s, s.adults.find((a) => a.id === voice.ownerId), job.householdId) : null;
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
  /** The text this narrator's audiobook reads, so the words shown are the words heard. */
  revision: string;
}

/** The read-along text of each revision narrators read, keyed by revision; `current` is today's. */
export interface BookTexts {
  current: string;
  /** Each text's sentences, their ids, and roughly how long each takes to read aloud (for the time bar). */
  texts: Record<string, { sentences: string[]; sentenceIds: string[]; seconds: number[] }>;
}

/** Texts for these revisions of a book, leaving out the ones the player already has. */
export function bookTexts(slug: string, revisions: string[], modelId: string, have: string[] = []): BookTexts {
  const today = bookText(slug)!;
  const texts: BookTexts["texts"] = {};
  for (const r of new Set([today.revision, ...revisions])) {
    if (have.includes(r)) continue;
    const t = bookTextAt(slug, r);
    if (t) texts[r] = { sentences: t.sentences.map((x) => x.text), sentenceIds: t.sentences.map((x) => x.id), seconds: t.sentences.map((x) => estimateSeconds(x.text.length, modelId)) };
  }
  return { current: today.revision, texts };
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
      const heard = narrationFor(state, store.plan, v.id, text, child.householdId);
      return { voiceId: v.id, readySentenceIds: heard.status.readySentenceIds, readiness: heard.status.readiness, revision: heard.text.revision };
    });
}

/**
 * The narration a player is showing. A player names the text on screen; while it does, that text's
 * narration keeps playing even if an update finished meanwhile, so listening is never interrupted.
 */
function narrationShown(state: FamilyState, plan: PlanConfig, voiceId: string, today: BookText, householdId: string, revision?: string): Narration {
  const heard = narrationFor(state, plan, voiceId, today, householdId);
  if (revision === undefined || heard.text.revision === revision) return heard;
  let best: Narration | null = null;
  for (const l of state.libraries) {
    if (l.voiceId !== voiceId || l.bookSlug !== today.slug || l.textRevision !== revision || (l.scope !== "shared" && l.scope !== householdId)) continue;
    const text = libraryText(l);
    const status = text ? libraryStatus(state, l, text) : null;
    if (text && status && (!best || status.ready > best.status.ready)) best = { library: l, text, status, pinned: true };
  }
  if (best) return best;
  throw new PermissionError(409, "book_updated", "This story has been updated. Loading it again.");
}

/**
 * Where a child picks up, counted in the text their narrator's audiobook reads. A place saved in that
 * text is used as is; one saved in another text moves to the same sentence, or the nearest unchanged
 * one before it. A place saved before texts were versioned could belong to any text the family has had;
 * when those texts disagree about where it is, the child starts at the beginning of that chapter.
 */
export function resumePlace(state: FamilyState, householdId: string, place: { sentence: number; textRevision?: string | null }, heard: Narration): { sentence: number; ambiguous: boolean } {
  const slug = heard.text.slug;
  const revisions = place.textRevision
    ? [place.textRevision]
    : [bookText(slug)!.revision, ...state.libraries.filter((l) => l.bookSlug === slug && (l.scope === "shared" || l.scope === householdId)).map((l) => l.textRevision)];
  const to = heard.text.sentences.map((x) => x.text);
  const spots = new Set<number>();
  for (const r of new Set(revisions)) {
    const from = r === heard.text.revision ? heard.text : bookTextAt(slug, r);
    if (from) spots.add(from === heard.text ? Math.min(place.sentence, to.length - 1) : mapPosition(from.sentences.map((x) => x.text), to, place.sentence));
  }
  if (spots.size <= 1) return { sentence: [...spots][0] ?? 0, ambiguous: false };
  const chapter = heard.text.sentences[Math.min(...spots)]!.chapter;
  return { sentence: heard.text.sentences.findIndex((x) => x.chapter === chapter), ambiguous: true };
}

/** A child's saved place and narrator in a book, counted in the text that narrator reads. */
export async function kidsResume(store: FamilyStore, actor: Actor | null, childId: string, slug: string, voiceId: string | null) {
  const state = await store.read();
  requireChildAccess(state, actor, childId);
  const child = activeChild(state, childId)!;
  const place = state.progress.find((p) => p.childId === childId && p.bookSlug === slug);
  const today = bookText(slug);
  if (!place || !today || !voiceId || !state.voices.some((v) => v.id === voiceId)) return { sentence: 0, voiceId };
  return { sentence: resumePlace(state, child.householdId, place, narrationFor(state, store.plan, voiceId, today, child.householdId)).sentence, voiceId };
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
  /** For a chapter track: where the track's audio is stored. `sid` is empty then. */
  t?: string;
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
  input: { childId: string; voiceId: string; bookSlug: string; sentence: number; revision?: string },
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
  const today = bookText(input.bookSlug);
  if (!today) throw new PermissionError(400, "bad_sentence", "That page doesn't exist.");
  const { library, text } = narrationShown(state, store.plan, input.voiceId, today, child.householdId, input.revision);
  const sentence = text.sentences[input.sentence];
  if (!sentence) throw new PermissionError(400, "bad_sentence", "That page doesn't exist.");
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
export async function readPlayback(store: FamilyStore, actor: Actor | null, token: string, key: string, at = Date.now(), range?: ByteRange) {
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
    if (!childVoiceAccess(state, claims.c, claims.v, store.plan).allowed) throw NOT_AVAILABLE;
  }
  if (claims.t) {
    // A chapter track lives as long as its narration does; deleting the voice deletes both.
    const object = state.libraries.some((l) => l.key === claims.lk) ? await store.audio.get(claims.t, range) : null;
    if (!object) throw NOT_AVAILABLE;
    return object;
  }
  const seg = segmentsOf(state, claims.lk).get(claims.sid);
  const object = seg?.status === "ready" && seg.storageKey ? await store.audio.get(seg.storageKey, range) : null;
  if (!object) throw NOT_AVAILABLE;
  return object;
}

// ---------------------------------------------------------------------------
// Chapter tracks
// ---------------------------------------------------------------------------

/** A chapter track a player may play: its URL and where each sentence starts in it. */
export interface TrackGrant {
  url: string;
  expiresAt: string;
  chapter: number;
  /** The text the track reads (a key of the player's texts). */
  revision: string;
  contentType: string;
  durationMs: number;
  sentences: { index: number; startMs: number; durationMs: number }[];
}

/**
 * A track URL lasts the track's whole length plus this, since the browser keeps asking for parts of it
 * while it plays. Every request still re-checks permission, so a revocation stops it straight away.
 */
const TRACK_URL_GRACE_MS = 30 * 60_000;

const CHAPTER_NOT_READY = () => new PermissionError(409, "not_prepared", "This chapter isn't fully prepared in that voice yet.");

/** The plan for a chapter of the narration a player is showing, or a not-prepared error. */
function trackPlanFor(state: FamilyState, plan: PlanConfig, voiceId: string, slug: string, householdId: string, chapter: number, revision?: string) {
  const today = bookText(slug);
  if (!today) throw new PermissionError(400, "bad_chapter", "That chapter doesn't exist.");
  const { library, text } = narrationShown(state, plan, voiceId, today, householdId, revision);
  if (!text.chapters.some((c) => c.number === chapter)) throw new PermissionError(400, "bad_chapter", "That chapter doesn't exist.");
  const trackPlan = chapterTrackPlan(state, library, text, chapter);
  if (!trackPlan) throw CHAPTER_NOT_READY();
  return { library, text, trackPlan };
}

/** Builds (or reads) the track; clips that can't be joined are reported as not prepared, so the player keeps going sentence by sentence. */
async function trackFor(store: FamilyStore, trackPlan: TrackPlan): Promise<ChapterTrack> {
  try {
    return await chapterTrack(store.audio, trackPlan);
  } catch (err) {
    if (err instanceof JoinError) {
      console.warn(`Readli: chapter track ${trackPlan.id} couldn't be assembled: ${err.message}`);
      throw new PermissionError(409, "track_unavailable", "This chapter plays sentence by sentence for now.");
    }
    throw err;
  }
}

function grant(track: ChapterTrack, revision: string, claims: Omit<PlaybackClaims, "exp" | "sid" | "t">, audioKey: string, key: string, at: number): TrackGrant {
  const exp = at + track.durationMs + TRACK_URL_GRACE_MS;
  const token = signPlayback({ ...claims, sid: "", t: audioKey, exp }, key);
  return {
    url: `/api/narration/audio/${token}`,
    expiresAt: new Date(exp).toISOString(),
    chapter: track.chapter,
    revision,
    contentType: track.contentType,
    durationMs: track.durationMs,
    sentences: track.sentences.map(({ index, startMs, durationMs }) => ({ index, startMs, durationMs })),
  };
}

/**
 * A URL for one fully prepared chapter as a single continuous track, for a child, after the same gates
 * as a sentence: owner share, reading entitlement, narrator slot, this child's approval and a live
 * listening session. Assembling the track only reads stored audio: no voice provider, no credits.
 */
export async function authorizeChapterTrack(
  store: FamilyStore,
  actor: Actor | null,
  input: { childId: string; voiceId: string; bookSlug: string; chapter: number; revision?: string },
  key: string,
  clock: Clock = now,
): Promise<TrackGrant> {
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
  const { library, text, trackPlan } = trackPlanFor(state, store.plan, input.voiceId, input.bookSlug, child.householdId, input.chapter, input.revision);
  const track = await trackFor(store, trackPlan);
  await store.write((s) => {
    const session = liveSession(s, input.childId, store.plan, at.toISOString());
    if (session) session.lastSeenAt = at.toISOString();
    // The whole chapter is delivered, so each of its sentences counts as played, as when they came one by one.
    for (const c of trackPlan.clips) s.plays.push({ libraryKey: library.key, sentenceId: c.sentenceId, householdId: child.householdId, childId: input.childId, at: at.toISOString() });
  });
  return grant(track, text.revision, { lk: library.key, c: input.childId, v: input.voiceId }, trackPlan.audioKey, key, at.getTime());
}

/** The same for a grown-up listening in the Parent Portal: a live plan, the owner's share and a narrator slot. */
export async function authorizeGuardianChapterTrack(
  store: FamilyStore,
  actor: Actor | null,
  input: { householdId: string; voiceId: string; bookSlug: string; chapter: number; revision?: string },
  key: string,
  clock: Clock = now,
): Promise<TrackGrant> {
  const state = await store.read();
  requireHouseholdGuardian(state, actor, input.householdId);
  if (!guardianVoiceAccess(state, store.plan, input.householdId, input.voiceId)) throw NOT_AVAILABLE;
  const { library, text, trackPlan } = trackPlanFor(state, store.plan, input.voiceId, input.bookSlug, input.householdId, input.chapter, input.revision);
  const track = await trackFor(store, trackPlan);
  return grant(track, text.revision, { lk: library.key, c: "", h: input.householdId, v: input.voiceId }, trackPlan.audioKey, key, clock().getTime());
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
  /** The text this voice's audiobook reads (a key of `texts`). */
  revision: string;
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
  /** Today's text (`sentences` above) and any earlier text a voice's audiobook reads. */
  texts: BookTexts;
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
      const owner = calledIn(state, state.adults.find((a) => a.id === voiceOwnerOf(state, id)), householdId);
      const heard = narrationFor(state, store.plan, id, text, householdId);
      const readySentenceIds = heard.status.readySentenceIds;
      return {
        voiceId: id,
        name: owner?.displayName ?? "A storyteller",
        avatarUrl: owner?.avatarUrl ?? null,
        tint: owner?.tint ?? "bg-lavender",
        revision: heard.text.revision,
        readySentenceIds,
        complete: heard.status.readiness === "ready",
      };
    })
    .filter((v) => v.readySentenceIds.length > 0)
    .sort((a, b) => Number(b.complete) - Number(a.complete));
  return {
    householdId,
    book: { slug: book.slug, title: book.title, author: book.author, coverUrl: book.coverUrl, tint: book.tint },
    sentences: text.sentences.map((x) => x.text),
    sentenceIds: text.sentences.map((x) => x.id),
    voices,
    texts: bookTexts(slug, voices.map((v) => v.revision), store.plan.narrationModelId),
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
  input: { householdId: string; voiceId: string; bookSlug: string; sentence: number; revision?: string },
  key: string,
  clock: Clock = now,
): Promise<{ url: string; expiresAt: string }> {
  const state = await store.read();
  requireHouseholdGuardian(state, actor, input.householdId);
  if (!guardianVoiceAccess(state, store.plan, input.householdId, input.voiceId)) throw NOT_AVAILABLE;
  const today = bookText(input.bookSlug);
  if (!today) throw new PermissionError(400, "bad_sentence", "That page doesn't exist.");
  const { library, text } = narrationShown(state, store.plan, input.voiceId, today, input.householdId, input.revision);
  const sentence = text.sentences[input.sentence];
  if (!sentence) throw new PermissionError(400, "bad_sentence", "That page doesn't exist.");
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
 * Honors a voice owner's deletion: removes that voice's narration audio and segment records for
 * every household. A household merely removing a narrator never calls this; shared audio stays for
 * other households with their own authorization.
 */
export async function deleteVoiceNarrations(store: FamilyStore, voiceId: string, clock: Clock = now) {
  const state = await store.read();
  const keys = new Set(state.libraries.filter((l) => l.voiceId === voiceId).map((l) => l.key));
  // Audio another narration still points at (a reused sentence) is never deleted from under it.
  const stillUsed = new Set(state.segments.filter((s) => !keys.has(s.libraryKey) && s.storageKey).map((s) => s.storageKey!));
  const storageKeys = [...new Set(state.segments.filter((s) => keys.has(s.libraryKey) && s.storageKey).map((s) => s.storageKey!))].filter((k) => !stillUsed.has(k));
  // Chapter tracks join that voice's clips, so they go with them.
  for (const k of keys) storageKeys.push(...(await store.audio.list(tracksFolder(k))));
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
