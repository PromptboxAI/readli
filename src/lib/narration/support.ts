import { randomUUID } from "node:crypto";
import type { FamilyState, JobScope, JobStatus, NarrationJob } from "@/lib/family/model";
import { calledIn } from "@/lib/family/names";
import { activeShare, activeSlot, childVoiceAccess, readyVoice } from "@/lib/family/permissions";
import type { PlanConfig } from "@/lib/family/plan";
import type { FamilyStore } from "@/lib/family/service";
import { revisionInfo } from "@/lib/library/revisions";
import { creditsFor } from "./credits";
import {
  activeJob,
  adoptReusable,
  carriedSentences,
  libraryFor,
  libraryStatus,
  libraryText,
  listenable,
  missingByChapter,
  narrationFor,
  reusableAudio,
  settleUnfinished,
  type Readiness,
} from "./narration";
import { bookText, type BookText } from "./text";

/**
 * Support tools (Kevin, 2026-11-08): a family's audiobooks as support sees them, and the fixes support
 * can make without the family doing anything. Every fix is free for the family: carrying audio over,
 * preparing at Readli's cost, stopping a preparation (unused credits go back) and refunding one.
 * Nothing here ever deletes audio.
 */

type Clock = () => Date;
const now: Clock = () => new Date();

/** A support fix that can't be made, with a message an admin can act on. */
export class SupportError extends Error {}

/** A preparation counts as stuck when it is still going and nothing has been stored for this long. */
export const STUCK_AFTER_MS = 15 * 60_000;

/** Lot id for a support refund of one preparation, so the same preparation can never be refunded twice. */
export const refundLotId = (jobId: string) => `refund:${jobId}`;

export interface SupportChapter {
  number: number;
  title: string;
  /** In the text the family hears now. */
  heard: { readiness: Readiness; ready: number; sentences: number } | null;
  /** In today's text, when the family hears an earlier one. */
  today: { readiness: Readiness; ready: number; sentences: number } | null;
}

export interface SupportJob {
  id: string;
  status: JobStatus;
  scope: JobScope;
  chapter: { number: number; title: string } | null;
  revision: string;
  createdAt: string;
  finishedAt: string | null;
  requestedBy: string;
  sentences: number;
  ready: number;
  /** In units (characters). Held while it runs, then committed for what was made. */
  held: number;
  committed: number;
  refunded: number;
  /** Prepared at Readli's cost: nothing was reserved from the family. */
  free: boolean;
  /** Units support already gave back for this preparation, or 0. */
  supportRefund: number;
  error: string | null;
  lastStoredAt: string | null;
  stuck: boolean;
}

export interface SupportNarration {
  voiceId: string;
  narrator: string;
  voiceStatus: "ready" | "processing" | "deleted";
  /** The storyteller's consent to read for this family, right now. */
  shared: boolean;
  inSlot: boolean;
  approvedFor: string[];
  heard: { revision: string; current: boolean; pinned: boolean; readiness: Readiness; ready: number; total: number; listenable: boolean; firstSeen: string | null };
  today: { revision: string; readiness: Readiness; ready: number; total: number; preparing: number };
  chapters: SupportChapter[];
  /** Sentences of today's text this voice already has audio for elsewhere: carrying them over is free. */
  carry: number;
  /** Sentences of today's text with no audio anywhere and nothing preparing them. */
  missing: number;
  missingCredits: number;
  jobs: SupportJob[];
}

export interface SupportBook {
  slug: string;
  title: string;
  todayRevision: string;
  narrations: SupportNarration[];
}

const lastStored = (state: FamilyState, job: NarrationJob): string | null => {
  const ids = new Set(job.sentenceIds);
  const at = state.segments.reduce((max, x) => (x.libraryKey === job.libraryKey && ids.has(x.sentenceId) && x.readyAt && x.readyAt > max ? x.readyAt : max), "");
  return at || null;
};

function jobView(state: FamilyState, job: NarrationJob, householdId: string, at: string): SupportJob {
  const library = state.libraries.find((l) => l.key === job.libraryKey);
  const text = library ? (libraryText(library) ?? bookText(library.bookSlug)) : null;
  const ids = new Set(job.sentenceIds);
  const segs = state.segments.filter((x) => x.libraryKey === job.libraryKey && ids.has(x.sentenceId));
  const entries = state.ledger.filter((e) => e.jobId === job.id);
  const sum = (kind: string) => entries.filter((e) => e.kind === kind).reduce((n, e) => n + e.credits, 0);
  const running = job.status === "queued" || job.status === "running";
  const chapter = job.scope === "chapter" && text ? text.chapters.find((c) => c.sentenceIds.some((id) => ids.has(id))) : undefined;
  const stored = lastStored(state, job);
  const since = Date.parse(stored ?? job.createdAt);
  const requester = state.adults.find((a) => a.id === job.requestedBy);
  const free = Object.values(job.reservations).every((d) => d.length === 0);
  return {
    id: job.id,
    status: job.status,
    scope: job.scope,
    chapter: chapter ? { number: chapter.number, title: chapter.title } : null,
    revision: library?.textRevision ?? "",
    createdAt: job.createdAt,
    finishedAt: job.finishedAt,
    // Support preparations are asked for by an admin, who isn't in the family.
    requestedBy: calledIn(state, requester, householdId)?.displayName ?? (free ? "Readli support" : "someone no longer in the family"),
    sentences: job.sentenceIds.length,
    ready: segs.filter((x) => x.status === "ready" && x.storageKey).length,
    held: running ? Math.max(0, sum("reserve") - sum("refund") - sum("commit")) : 0,
    committed: sum("commit"),
    refunded: sum("refund"),
    free,
    supportRefund: state.creditLots.find((l) => l.id === refundLotId(job.id))?.credits ?? 0,
    error: segs.find((x) => x.status === "failed" && x.error)?.error ?? null,
    lastStoredAt: stored,
    stuck: running && Date.parse(at) - since > STUCK_AFTER_MS,
  };
}

/** Voices whose narration of some book this family can reach: its own libraries, or shared ones of a voice it was ever given. */
function narrationsOf(state: FamilyState, householdId: string): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  const add = (slug: string, voiceId: string) => out.set(slug, (out.get(slug) ?? new Set()).add(voiceId));
  const everShared = new Set(state.shares.filter((s) => s.householdId === householdId).map((s) => s.voiceId));
  for (const l of state.libraries) {
    if (!state.voices.some((v) => v.id === l.voiceId)) continue;
    if (l.scope === householdId || (l.scope === "shared" && everShared.has(l.voiceId))) add(l.bookSlug, l.voiceId);
  }
  for (const j of state.jobs) {
    if (j.householdId !== householdId) continue;
    const l = state.libraries.find((x) => x.key === j.libraryKey);
    if (l && state.voices.some((v) => v.id === l.voiceId)) add(l.bookSlug, l.voiceId);
  }
  return out;
}

/**
 * Every audiobook a family has or has asked for, the way the family's book page sees it, per narrator
 * and chapter: what plays now and from which text, what today's text has, what's preparing, and each
 * preparation with what it held, used and gave back.
 */
export function supportAudiobooks(state: FamilyState, plan: PlanConfig, householdId: string, at = now().toISOString()): SupportBook[] {
  const kids = state.children.filter((c) => c.householdId === householdId && c.deletedAt === null);
  const books: SupportBook[] = [];
  for (const [slug, voiceIds] of narrationsOf(state, householdId)) {
    const today = bookText(slug);
    if (!today) continue;
    const narrations: SupportNarration[] = [];
    for (const voiceId of voiceIds) {
      const voice = state.voices.find((v) => v.id === voiceId)!;
      const heard = narrationFor(state, plan, voiceId, today, householdId);
      const target = libraryFor(state, plan, voiceId, today, householdId);
      const todayStatus = target.key === heard.library.key ? heard.status : libraryStatus(state, target, today);
      const heardChapters = missingByChapter(state, plan, heard.library, heard.text);
      const todayChapters = target.key === heard.library.key ? [] : missingByChapter(state, plan, target, today);
      const numbers = [...new Set([...today.chapters.map((c) => c.number), ...heard.text.chapters.map((c) => c.number)])].sort((a, b) => a - b);
      const chapters = numbers.map((number) => {
        const h = heardChapters.find((c) => c.number === number);
        const t = todayChapters.find((c) => c.number === number);
        const title = today.chapters.find((c) => c.number === number)?.title ?? heard.text.chapters.find((c) => c.number === number)?.title ?? `Chapter ${number}`;
        return {
          number,
          title,
          heard: h ? { readiness: h.readiness, ready: h.ready, sentences: h.sentences } : null,
          today: t ? { readiness: t.readiness, ready: t.ready, sentences: t.sentences } : null,
        };
      });
      const reusable = reusableAudio(state, target, today);
      const segs = new Map(state.segments.filter((x) => x.libraryKey === target.key).map((x) => [x.sentenceId, x]));
      let missing = 0;
      let missingCredits = 0;
      for (const s of today.sentences) {
        const seg = segs.get(s.id);
        if ((seg?.status === "ready" && seg.storageKey) || (seg && activeJob(state, seg.jobId)) || reusable.has(s.id)) continue;
        missing += 1;
        missingCredits += creditsFor(s.text.length);
      }
      const keys = new Set(state.libraries.filter((l) => l.voiceId === voiceId && l.bookSlug === slug).map((l) => l.key));
      const jobs = state.jobs
        .filter((j) => j.householdId === householdId && keys.has(j.libraryKey))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((j) => jobView(state, j, householdId, at));
      narrations.push({
        voiceId,
        narrator: calledIn(state, state.adults.find((a) => a.id === voice.ownerId), householdId)?.displayName ?? "A storyteller",
        voiceStatus: voice.deletedAt ? "deleted" : voice.status,
        shared: Boolean(readyVoice(state, voiceId) && activeShare(state, voiceId, householdId)),
        inSlot: activeSlot(state, voiceId, householdId, plan) !== null,
        approvedFor: kids.filter((c) => childVoiceAccess(state, c.id, voiceId, plan).allowed).map((c) => c.nickname),
        heard: {
          revision: heard.text.revision,
          current: heard.text.revision === today.revision,
          pinned: heard.pinned,
          readiness: heard.status.readiness,
          ready: heard.status.ready,
          total: heard.status.total,
          listenable: listenable(heard),
          firstSeen: revisionInfo(slug, heard.text.revision)?.firstSeen ?? null,
        },
        today: { revision: today.revision, readiness: todayStatus.readiness, ready: todayStatus.ready, total: todayStatus.total, preparing: todayStatus.inProgress },
        chapters,
        carry: reusable.size,
        missing,
        missingCredits,
        jobs,
      });
    }
    narrations.sort((a, b) => a.narrator.localeCompare(b.narrator));
    books.push({ slug, title: today.title, todayRevision: today.revision, narrations });
  }
  return books.sort((a, b) => a.title.localeCompare(b.title));
}

function requireConsent(state: FamilyState, householdId: string, voiceId: string) {
  if (!readyVoice(state, voiceId)) throw new SupportError("That voice isn't ready or was deleted, so nothing can be prepared in it.");
  if (!activeShare(state, voiceId, householdId)) throw new SupportError("That storyteller isn't sharing their voice with this family right now, so nothing can be prepared in it.");
}

function todayOf(slug: string): BookText {
  const text = bookText(slug);
  if (!text) throw new SupportError("That book isn't in the library any more.");
  return text;
}

/**
 * Points today's text at every sentence this voice already has audio for, said the same way, in an
 * earlier text of the book. Nothing is generated or charged. Returns how many sentences came over.
 */
export async function supportCarryForward(store: FamilyStore, householdId: string, voiceId: string, slug: string, clock: Clock = now): Promise<number> {
  const state = await store.read();
  if (!state.voices.some((v) => v.id === voiceId)) throw new SupportError("That voice isn't in this family.");
  const text = todayOf(slug);
  const at = clock().toISOString();
  let carried = 0;
  await store.write((s) => {
    const target = libraryFor(s, store.plan, voiceId, text, householdId);
    if (reusableAudio(s, target, text).size === 0) return;
    if (!s.libraries.some((l) => l.key === target.key)) s.libraries.push({ ...target, createdAt: at });
    carried = adoptReusable(s, target, text, null, at);
  });
  if (carried === 0) throw new SupportError("There's no prepared audio to carry over: today's text already has everything this voice said the same way.");
  return carried;
}

/**
 * Prepares a book, or one chapter of it, in today's text at Readli's cost. Audio the voice already has
 * comes along first, as it does for the family. Chapters the family's earlier audiobook finished come
 * along with a chapter, the same as when the family prepares one. Needs the storyteller's consent, never credits.
 */
export async function supportPrepare(
  store: FamilyStore,
  adminId: string,
  householdId: string,
  req: { voiceId: string; bookSlug: string; chapter: number | null },
  clock: Clock = now,
): Promise<NarrationJob | null> {
  const state = await store.read();
  requireConsent(state, householdId, req.voiceId);
  const text = todayOf(req.bookSlug);
  if (req.chapter !== null && !text.chapters.some((c) => c.number === req.chapter)) throw new SupportError("That chapter isn't in today's text.");
  const at = clock().toISOString();
  let job: NarrationJob | null = null;
  await store.write((s) => {
    const library = libraryFor(s, store.plan, req.voiceId, text, householdId);
    if (!s.libraries.some((l) => l.key === library.key)) s.libraries.push({ ...library, createdAt: at });
    adoptReusable(s, library, text, null, at);
    const carried = req.chapter === null ? new Set<string>() : carriedSentences(narrationFor(s, store.plan, req.voiceId, text, householdId), text);
    const chapterIds = new Set(text.chapters.find((c) => c.number === req.chapter)?.sentenceIds ?? []);
    const segs = new Map(s.segments.filter((x) => x.libraryKey === library.key).map((x) => [x.sentenceId, x]));
    const wanted = text.sentences.filter((x) => {
      if (req.chapter !== null && !chapterIds.has(x.id) && !carried.has(x.id)) return false;
      const seg = segs.get(x.id);
      return !(seg?.status === "ready" && seg.storageKey) && !(seg && activeJob(s, seg.jobId));
    });
    if (wanted.length === 0) return;
    job = {
      id: randomUUID(),
      libraryKey: library.key,
      householdId,
      requestedBy: adminId,
      scope: req.chapter === null ? "book" : "chapter",
      sentenceIds: wanted.map((x) => x.id),
      reservations: Object.fromEntries(wanted.map((x) => [x.id, []])),
      status: "queued",
      createdAt: at,
      finishedAt: null,
    };
    for (const x of wanted) {
      const seg = segs.get(x.id);
      if (seg) Object.assign(seg, { status: "pending", jobId: job.id, error: null, attempts: 0 });
      else
        s.segments.push({
          libraryKey: library.key,
          sentenceId: x.id,
          ordinal: x.ordinal,
          status: "pending",
          jobId: job.id,
          storageKey: null,
          characters: x.text.length,
          durationMs: null,
          providerCredits: null,
          attempts: 0,
          error: null,
          readyAt: null,
        });
    }
    s.jobs.push(job);
  });
  return job;
}

/** Stops a preparation the way the family's Stop does: unfinished sentences are released and unused credits go back. */
export async function supportStop(store: FamilyStore, householdId: string, jobId: string, clock: Clock = now): Promise<NarrationJob> {
  const state = await store.read();
  const job = state.jobs.find((j) => j.id === jobId && j.householdId === householdId);
  if (!job) throw new SupportError("That preparation isn't in this family.");
  if (job.status !== "queued" && job.status !== "running") throw new SupportError("That preparation has already stopped.");
  const at = clock().toISOString();
  await store.write((s) => {
    job.status = "canceled";
    job.finishedAt = at;
    settleUnfinished(s, job, at);
  });
  return job;
}

/**
 * Gives a family back the credits one finished preparation used, as credits that never expire, with a
 * note the family sees. The audio stays. A preparation can be refunded once.
 */
export async function supportRefund(store: FamilyStore, householdId: string, jobId: string, clock: Clock = now): Promise<{ units: number; note: string }> {
  const state = await store.read();
  const job = state.jobs.find((j) => j.id === jobId && j.householdId === householdId);
  if (!job) throw new SupportError("That preparation isn't in this family.");
  if (job.status === "queued" || job.status === "running") throw new SupportError("Stop that preparation first. Unused credits go back on their own when it stops.");
  if (state.creditLots.some((l) => l.id === refundLotId(job.id))) throw new SupportError("That preparation was already refunded.");
  const units = state.ledger.filter((e) => e.jobId === job.id && e.kind === "commit").reduce((n, e) => n + e.credits, 0);
  if (units <= 0) throw new SupportError("Nothing was charged for that preparation, so there's nothing to refund.");
  const library = state.libraries.find((l) => l.key === job.libraryKey);
  const title = library ? (bookText(library.bookSlug)?.title ?? "a book") : "a book";
  const voice = library ? state.voices.find((v) => v.id === library.voiceId) : undefined;
  const narrator = calledIn(state, state.adults.find((a) => a.id === voice?.ownerId), householdId)?.displayName;
  const note = `Refund from Readli: ${title}${narrator ? ` read by ${narrator}` : ""}`;
  const at = clock().toISOString();
  await store.write((s) => {
    s.creditLots.push({ id: refundLotId(job.id), householdId, source: "promotional", credits: units, grantedAt: at, expiresAt: null, note });
  });
  return { units, note };
}
