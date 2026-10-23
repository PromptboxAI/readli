import { describe, expect, it } from "vitest";
import { demoFamilyState, DEMO_HOUSEHOLD_ID } from "@/lib/family/demo-family";
import type { Actor, FamilyState } from "@/lib/family/model";
import { DEFAULT_PLAN } from "@/lib/family/plan";
import { MemoryFamilyStore, PermissionError, saveChildProgress, startListening } from "@/lib/family/service";
import { CATALOG } from "@/lib/library/catalog";
import { revisionInfo, revisionsOf } from "@/lib/library/revisions";
import type { SynthesizedAudio, VoiceProvider } from "@/lib/voice/provider";
import { toneWav } from "@/lib/voice/stub";
import {
  authorizeGuardianPlayback,
  authorizePlayback,
  bookTexts,
  deleteVoiceNarrations,
  kidsReadiness,
  kidsResume,
  libraryFor,
  listenView,
  narrationFor,
  prepareView,
  quote,
  readPlayback,
  requestGeneration,
  resumePlace,
  runJob,
} from "./narration";
import { mapPosition, spokenForm } from "./positions";
import { revisionAudit } from "./revision-audit";
import { bookText, bookTextAt } from "./text";

/** Versioned Audiobooks (Kevin, 2026-10-21): required regression tests. */
const mom: Actor = { kind: "adult", adultId: "sara" };
const maya: Actor & { kind: "child" } = { kind: "child", childId: "maya" };
const H = DEMO_HOUSEHOLD_ID;
const KEY = "playback-test-key";

// Real published revisions, rebuilt from git history (src/lib/library/revisions).
const GOLDILOCKS = "goldilocks-and-the-three-bears";
const GOLDILOCKS_OLD = "d04c4d1afbb1"; // the ending was rewritten, and later the narration fixes made it a correction
const OWL = "the-owl-and-the-pussy-cat";
const OWL_OLD = "39fd1d8bcca2"; // "Pussy" became "Kitty", marked a Readli correction
const LION = "the-lion-and-the-mouse";
const LION_OLD = "1b359a189a29"; // a different edition altogether
const PIGS = "the-three-little-pigs";
const PIGS_OLD = "b95bb8109234"; // 89 sentences, then 90

let tick = Date.parse("2026-10-21T00:00:00Z");
const clock = () => new Date((tick += 1000));

class CountingProvider implements VoiceProvider {
  calls: string[] = [];
  async createInstantVoice(): Promise<{ voiceId: string }> {
    return { voiceId: "x" };
  }
  async synthesize(input: { voiceId: string; text: string }): Promise<SynthesizedAudio> {
    this.calls.push(input.text);
    return { audio: toneWav(1), contentType: "audio/wav", standIn: true };
  }
  async deleteVoice() {}
}

function family() {
  const state: FamilyState = demoFamilyState();
  return { state, store: new MemoryFamilyStore(state, DEFAULT_PLAN) };
}

/** A family's finished audiobook of an earlier text, as it was stored before the book changed. */
async function seedFinished(state: FamilyState, store: MemoryFamilyStore, slug: string, revision: string, voiceId = "voice-june") {
  const text = bookTextAt(slug, revision)!;
  const library = { ...libraryFor(state, store.plan, voiceId, text, H), createdAt: "2026-10-11T00:00:00Z" };
  state.libraries.push(library);
  for (const s of text.sentences) {
    const storageKey = `seed/${library.key}/${s.id}`;
    await store.audio.put(storageKey, toneWav(1), "audio/wav");
    state.segments.push({
      libraryKey: library.key,
      sentenceId: s.id,
      ordinal: s.ordinal,
      status: "ready",
      jobId: null,
      storageKey,
      characters: s.text.length,
      durationMs: 1000,
      providerCredits: 1,
      attempts: 1,
      error: null,
      readyAt: "2026-10-11T00:00:00Z",
    });
  }
  return { text, library };
}

const charged = (state: FamilyState) => {
  const sum = (kind: string) => state.ledger.filter((e) => e.householdId === H && e.kind === kind).reduce((n, e) => n + e.credits, 0);
  return sum("reserve") - sum("refund");
};

const changedLines = (from: string, to: string, slug: string) => {
  const said = new Set(bookTextAt(slug, from)!.sentences.map((s) => spokenForm(s.text)));
  return bookTextAt(slug, to)!.sentences.filter((s) => !said.has(spokenForm(s.text)));
};

async function rejects(p: Promise<unknown>, status: number, code: string) {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(PermissionError);
  expect((err as PermissionError).status).toBe(status);
  expect((err as PermissionError).code).toBe(code);
}

describe("published revisions are immutable snapshots", () => {
  it("rebuilds every earlier revision with the same fingerprint, and today's matches the catalog", () => {
    for (const book of CATALOG) {
      const revisions = revisionsOf(book.slug);
      expect(revisions.filter((r) => r.current), book.slug).toHaveLength(1);
      // A book's text changed without archiving the old one: run `node scripts/revisions/archive.mjs`.
      expect(revisions.find((r) => r.current)?.revision, `${book.slug}: archive its revisions`).toBe(bookText(book.slug)!.revision);
      for (const r of revisions) {
        const text = bookTextAt(book.slug, r.revision);
        expect(text, `${book.slug}:${r.revision}`).not.toBeNull();
        expect(text!.revision).toBe(r.revision);
        expect(text!.edition).toBe(r.edition);
        // Sentence ids belong to their revision, so two texts never share an id.
        expect(text!.sentences.every((s) => s.id.startsWith(`${book.slug}.${r.revision}.`))).toBe(true);
      }
    }
  });

  it("knows nothing of a revision that was never built", () => {
    expect(bookTextAt(OWL, "000000000000")).toBeNull();
    expect(revisionInfo(OWL, "000000000000")).toBeNull();
  });

  it("restores the original Owl text exactly, and marks today's as a Readli correction", () => {
    const old = bookTextAt(OWL, OWL_OLD)!;
    expect(old.sentences[0]!.text).toContain("Pussy-Cat");
    expect(bookText(OWL)!.sentences[0]!.text).toContain("Kitty-Cat");
    expect(revisionInfo(OWL, bookText(OWL)!.revision)!.correction).toBe(true);
    expect(revisionInfo(OWL, OWL_OLD)!.correction).toBeFalsy();
  });
});

describe("what counts as a spoken change", () => {
  it("ignores spacing and the style of quotes, apostrophes and ellipses", () => {
    expect(spokenForm("“Who’s been   sitting in my chair…”")).toBe(spokenForm('"Who\'s been sitting in my chair..."'));
    expect(spokenForm("A line\nwrapped")).toBe(spokenForm("A line wrapped"));
  });

  it("counts words, commas and full stops", () => {
    expect(spokenForm("She ran home.")).not.toBe(spokenForm("She ran home"));
    expect(spokenForm("So, she ran.")).not.toBe(spokenForm("So she ran."));
    expect(spokenForm("Dinah looked puzzled.")).not.toBe(spokenForm("Dinah looked troubled."));
  });
});

describe("existing audiobooks keep playing", () => {
  it("a finished audiobook of an earlier text stays Ready, with its own words, and nothing is generated or charged", async () => {
    const { state, store } = family();
    const { text: old } = await seedFinished(state, store, GOLDILOCKS, GOLDILOCKS_OLD);
    const before = { jobs: state.jobs.length, ledger: state.ledger.length };

    const june = (await prepareView(store, mom, H, GOLDILOCKS, clock)).voices.find((v) => v.voiceId === "voice-june")!;
    expect(june.availability).toBe("ready");
    expect(june.missingCredits).toBe(0);
    const kids = (await kidsReadiness(store, maya, "maya", GOLDILOCKS)).find((r) => r.voiceId === "voice-june")!;
    expect(kids.readiness).toBe("ready");
    expect(kids.revision).toBe(GOLDILOCKS_OLD);
    // The read-along is the narrated text, not today's.
    const texts = bookTexts(GOLDILOCKS, [kids.revision], store.plan.narrationModelId);
    expect(texts.texts[GOLDILOCKS_OLD]!.sentences).toEqual(old.sentences.map((s) => s.text));

    await startListening(store, maya, "maya", clock);
    const last = old.sentences.length - 2;
    const { url } = await authorizePlayback(store, maya, { childId: "maya", voiceId: "voice-june", bookSlug: GOLDILOCKS, sentence: last, revision: GOLDILOCKS_OLD }, KEY, clock);
    expect((await readPlayback(store, maya, url.split("/").pop()!, KEY, tick)).audio.byteLength).toBeGreaterThan(0);
    const listen = await listenView(store, mom, H, GOLDILOCKS);
    expect(listen.voices.find((v) => v.voiceId === "voice-june")).toMatchObject({ revision: GOLDILOCKS_OLD, complete: true });
    await authorizeGuardianPlayback(store, mom, { householdId: H, voiceId: "voice-june", bookSlug: GOLDILOCKS, sentence: 0, revision: GOLDILOCKS_OLD }, KEY, clock);

    expect(state.jobs.length).toBe(before.jobs);
    expect(state.ledger.length).toBe(before.ledger);
  });

  it("offers the update with what changed and the real cost, only lines that changed are charged", async () => {
    const { state, store } = family();
    await seedFinished(state, store, PIGS, PIGS_OLD);
    const changed = changedLines(PIGS_OLD, bookText(PIGS)!.revision, PIGS);
    expect(changed.length).toBeGreaterThan(0);

    const june = (await prepareView(store, mom, H, PIGS, clock)).voices.find((v) => v.voiceId === "voice-june")!;
    expect(june.update).not.toBeNull();
    expect(june.update!.free).toBe(false);
    expect(june.update!.after).toEqual(changed.map((s) => s.text));

    const q = quote(state, store.plan, H, { voiceId: "voice-june", bookSlug: PIGS, scope: "book" });
    expect(q.sentenceIds).toEqual(changed.map((s) => s.id));
    expect(q.reusedReady).toBe(bookText(PIGS)!.sentences.length - changed.length);
    expect(june.update!.credits).toBe(q.credits);
    expect(q.credits).toBeGreaterThan(0);
  });

  it("Goldilocks' rewritten lines are a free Readli correction for families with the earlier text", async () => {
    const { state, store } = family();
    await seedFinished(state, store, GOLDILOCKS, GOLDILOCKS_OLD);
    const changed = changedLines(GOLDILOCKS_OLD, bookText(GOLDILOCKS)!.revision, GOLDILOCKS);
    const june = (await prepareView(store, mom, H, GOLDILOCKS, clock)).voices.find((v) => v.voiceId === "voice-june")!;
    expect(june.update).toMatchObject({ free: true, credits: 0 });
    expect(june.update!.after).toEqual(changed.map((s) => s.text));
    const q = quote(state, store.plan, H, { voiceId: "voice-june", bookSlug: GOLDILOCKS, scope: "book" });
    expect(q.sentenceIds).toEqual(changed.map((s) => s.id));
  });

  it("an update generates only the changed lines, keeps the old audiobook until it is finished, and then takes over", async () => {
    const { state, store } = family();
    const { library: oldLibrary } = await seedFinished(state, store, PIGS, PIGS_OLD);
    const today = bookText(PIGS)!;
    const changed = changedLines(PIGS_OLD, today.revision, PIGS);
    const oldKeys = state.segments.filter((s) => s.libraryKey === oldLibrary.key).map((s) => s.storageKey);

    const { job, quote: q } = await requestGeneration(store, mom, H, { voiceId: "voice-june", bookSlug: PIGS, scope: "book" }, clock);
    expect(job).not.toBeNull();
    expect(charged(state)).toBe(q.credits);
    // While the update is being made, the family still hears the finished audiobook.
    expect(narrationFor(state, store.plan, "voice-june", today, H).text.revision).toBe(PIGS_OLD);

    const provider = new CountingProvider();
    await runJob(store, provider, job!.id, clock);
    expect(provider.calls.length).toBe(changed.length);
    const heard = narrationFor(state, store.plan, "voice-june", today, H);
    expect(heard.text.revision).toBe(today.revision);
    expect(heard.status.readiness).toBe("ready");
    // Reused sentences point at the same stored file; nothing was copied or deleted.
    const reused = state.segments.filter((s) => s.libraryKey === heard.library.key && oldKeys.includes(s.storageKey));
    expect(reused.length).toBe(today.sentences.length - changed.length);
    for (const k of oldKeys) expect(await store.audio.exists(k!)).toBe(true);
    expect(state.segments.filter((s) => s.libraryKey === oldLibrary.key).every((s) => s.status === "ready")).toBe(true);

    // A player still showing the old text keeps playing it; it is never cut off mid-story.
    await startListening(store, maya, "maya", clock);
    await authorizePlayback(store, maya, { childId: "maya", voiceId: "voice-june", bookSlug: PIGS, sentence: 3, revision: PIGS_OLD }, KEY, clock);
    // Asking again costs nothing and makes nothing.
    const again = await requestGeneration(store, mom, H, { voiceId: "voice-june", bookSlug: PIGS, scope: "book" }, clock);
    expect(again.job).toBeNull();
    expect(again.quote.credits).toBe(0);
  });

  it("an added closing line is the only thing prepared", async () => {
    const { state, store } = family();
    await seedFinished(state, store, PIGS, PIGS_OLD);
    const changed = changedLines(PIGS_OLD, bookText(PIGS)!.revision, PIGS);
    const q = quote(state, store.plan, H, { voiceId: "voice-june", bookSlug: PIGS, scope: "book" });
    expect(q.sentenceIds).toEqual(changed.map((s) => s.id));
    expect(q.reusedReady).toBe(bookText(PIGS)!.sentences.length - changed.length);
  });

  it("a Readli correction (the Owl) is free for families who have the original, and paid for nobody else", async () => {
    const { state, store } = family();
    await seedFinished(state, store, OWL, OWL_OLD);
    const june = (await prepareView(store, mom, H, OWL, clock)).voices.find((v) => v.voiceId === "voice-june")!;
    expect(june.availability).toBe("ready");
    expect(june.update).toMatchObject({ free: true, credits: 0 });
    const ledger = state.ledger.length;
    const { job, quote: q } = await requestGeneration(store, mom, H, { voiceId: "voice-june", bookSlug: OWL, scope: "book" }, clock);
    expect(q.free).toBe(true);
    expect(q.credits).toBe(0);
    expect(job).not.toBeNull();
    expect(state.ledger.length).toBe(ledger);
    await runJob(store, new CountingProvider(), job!.id, clock);
    expect(state.ledger.length).toBe(ledger);
    expect(narrationFor(state, store.plan, "voice-june", bookText(OWL)!, H).text.revision).toBe(bookText(OWL)!.revision);

    // A family who never had the Owl pays as for any new book.
    const fresh = family();
    expect(quote(fresh.state, fresh.store.plan, H, { voiceId: "voice-june", bookSlug: OWL, scope: "book" })).toMatchObject({ free: false });
  });

  it("a new edition keeps the old audiobook and reuses nothing it doesn't say the same way", async () => {
    const { state, store } = family();
    await seedFinished(state, store, LION, LION_OLD);
    const today = bookText(LION)!;
    expect(narrationFor(state, store.plan, "voice-june", today, H)).toMatchObject({ pinned: true, text: { revision: LION_OLD } });
    const q = quote(state, store.plan, H, { voiceId: "voice-june", bookSlug: LION, scope: "book" });
    expect(q.sentenceIds.length).toBe(changedLines(LION_OLD, today.revision, LION).length);
  });

  it("a re-recorded voice keeps its old audiobooks playable and never reuses the old recording's audio", async () => {
    const { state, store } = family();
    await seedFinished(state, store, GOLDILOCKS, bookText(GOLDILOCKS)!.revision);
    state.voices.find((v) => v.id === "voice-june")!.version += 1;
    const today = bookText(GOLDILOCKS)!;
    const heard = narrationFor(state, store.plan, "voice-june", today, H);
    expect(heard.pinned).toBe(true);
    expect(heard.status.readiness).toBe("ready");
    // The new recording prepares every sentence; the old recording's audio is never mixed in.
    const q = quote(state, store.plan, H, { voiceId: "voice-june", bookSlug: GOLDILOCKS, scope: "book" });
    expect(q.sentenceIds.length).toBe(today.sentences.length);
    expect(q.reusedReady).toBe(0);
  });

  it("a partly prepared earlier text is not pinned; preparation continues on today's text", async () => {
    const { state, store } = family();
    const { library } = await seedFinished(state, store, GOLDILOCKS, GOLDILOCKS_OLD);
    state.segments = state.segments.filter((s) => s.libraryKey !== library.key || s.ordinal < 10);
    const heard = narrationFor(state, store.plan, "voice-june", bookText(GOLDILOCKS)!, H);
    expect(heard.pinned).toBe(false);
    expect(heard.text.revision).toBe(bookText(GOLDILOCKS)!.revision);
    // The ten lines already said the same way are free.
    const q = quote(state, store.plan, H, { voiceId: "voice-june", bookSlug: GOLDILOCKS, scope: "book" });
    expect(q.reusedReady).toBe(10);
  });

  it("an earlier text with no snapshot is never guessed at", async () => {
    const { state, store } = family();
    const { library } = await seedFinished(state, store, GOLDILOCKS, GOLDILOCKS_OLD);
    library.textRevision = "000000000000";
    const heard = narrationFor(state, store.plan, "voice-june", bookText(GOLDILOCKS)!, H);
    expect(heard.pinned).toBe(false);
    expect(revisionAudit(state).totals.unknown).toBe(1);
  });

  it("a player asking for a text the family has no audiobook of is told the story was updated", async () => {
    const { state, store } = family();
    await seedFinished(state, store, GOLDILOCKS, GOLDILOCKS_OLD);
    await startListening(store, maya, "maya", clock);
    await rejects(
      authorizePlayback(store, maya, { childId: "maya", voiceId: "voice-june", bookSlug: GOLDILOCKS, sentence: 0, revision: PIGS_OLD }, KEY, clock),
      409,
      "book_updated",
    );
  });
});

describe("reading places across revisions", () => {
  it("maps a place to the same sentence, or the nearest unchanged one before it", () => {
    const from = ["One.", "Two.", "Three.", "Four."];
    const to = ["One.", "Two!", "Three.", "Four.", "Five."];
    expect(mapPosition(from, to, 2)).toBe(2);
    expect(mapPosition(from, to, 1)).toBe(0);
    expect(mapPosition(from, ["Zero.", ...from], 3)).toBe(4);
    expect(mapPosition(["A."], ["B."], 0)).toBe(0);
  });

  it("keeps a child's place when their audiobook moves to the updated text", async () => {
    const { state, store } = family();
    await seedFinished(state, store, GOLDILOCKS, GOLDILOCKS_OLD);
    await saveChildProgress(store, maya, { childId: "maya", bookSlug: GOLDILOCKS, sentence: 20, voiceId: "voice-june", textRevision: GOLDILOCKS_OLD }, clock);
    expect((await kidsResume(store, maya, "maya", GOLDILOCKS, "voice-june")).sentence).toBe(20);
    const { job } = await requestGeneration(store, mom, H, { voiceId: "voice-june", bookSlug: GOLDILOCKS, scope: "book" }, clock);
    await runJob(store, new CountingProvider(), job!.id, clock);
    const old = bookTextAt(GOLDILOCKS, GOLDILOCKS_OLD)!.sentences[20]!.text;
    const at = (await kidsResume(store, maya, "maya", GOLDILOCKS, "voice-june")).sentence;
    expect(spokenForm(bookText(GOLDILOCKS)!.sentences[at]!.text)).toBe(spokenForm(old));
  });

  it("a place saved before versioning, where the family's texts disagree, starts that chapter again and is reported", async () => {
    const { state, store } = family();
    await seedFinished(state, store, PIGS, PIGS_OLD);
    const today = bookText(PIGS)!;
    const old = bookTextAt(PIGS, PIGS_OLD)!;
    const heard = narrationFor(state, store.plan, "voice-june", today, H);
    expect(heard.text.revision).toBe(PIGS_OLD);
    // A place where the two texts don't line up.
    const words = (t: typeof old) => t.sentences.map((x) => x.text);
    const at = old.sentences.findIndex((_, i) => mapPosition(words(today), words(old), i) !== i);
    expect(at).toBeGreaterThan(0);
    state.progress.push({ childId: "maya", bookSlug: PIGS, sentence: at, voiceId: "voice-june", textRevision: null, updatedAt: "2026-10-12T00:00:00Z" });
    const place = resumePlace(state, H, state.progress.at(-1)!, heard);
    expect(place.ambiguous).toBe(true);
    expect(heard.text.sentences[place.sentence - 1]?.chapter ?? 0).not.toBe(heard.text.sentences[place.sentence]!.chapter);
    expect(revisionAudit(state).totals.progressAmbiguous).toBe(1);
  });

  it("a place saved before versioning, where every text agrees, is kept as is", async () => {
    const { state, store } = family();
    await seedFinished(state, store, GOLDILOCKS, bookText(GOLDILOCKS)!.revision);
    state.progress.push({ childId: "maya", bookSlug: GOLDILOCKS, sentence: 7, voiceId: "voice-june", textRevision: null, updatedAt: "2026-10-12T00:00:00Z" });
    expect((await kidsResume(store, maya, "maya", GOLDILOCKS, "voice-june")).sentence).toBe(7);
  });
});

describe("storage cleanup never removes shared audio", () => {
  it("keeps a stored file another narration still points at", async () => {
    const { state, store } = family();
    const { library } = await seedFinished(state, store, GOLDILOCKS, GOLDILOCKS_OLD);
    const shared = state.segments.find((s) => s.libraryKey === library.key)!;
    // Another voice's narration points at the same stored file (as a future archive copy would).
    state.segments.push({ ...shared, libraryKey: "voice-other:v1:archive" });
    await deleteVoiceNarrations(store, "voice-june", clock);
    expect(await store.audio.exists(shared.storageKey!)).toBe(true);
  });
});

describe("the historical-data audit", () => {
  it("reports which text each audiobook reads and how reading places will resume", async () => {
    const { state, store } = family();
    await seedFinished(state, store, GOLDILOCKS, GOLDILOCKS_OLD);
    await seedFinished(state, store, OWL, bookText(OWL)!.revision);
    state.progress.push({ childId: "maya", bookSlug: OWL, sentence: 2, voiceId: "voice-june", textRevision: bookText(OWL)!.revision, updatedAt: "2026-10-12T00:00:00Z" });
    const audit = revisionAudit(state);
    expect(audit.totals).toMatchObject({ earlier: 1, earlierFinished: 1, unknown: 0, readyWithoutAudio: 0 });
    expect(audit.totals.current).toBeGreaterThanOrEqual(1);
    expect(audit.libraries.every((l) => l.recoverable)).toBe(true);
    expect(audit.totals.progressVersioned).toBeGreaterThanOrEqual(1);
  });
});
