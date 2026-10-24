import { describe, expect, it } from "vitest";
import { THE_END, THE_END_PAUSE_MS } from "@/lib/content/the-end";
import { demoFamilyState, DEMO_HOUSEHOLD_ID } from "@/lib/family/demo-family";
import type { Actor, FamilyState } from "@/lib/family/model";
import { DEFAULT_PLAN } from "@/lib/family/plan";
import { MemoryFamilyStore, PermissionError, releaseNarrator, startListening } from "@/lib/family/service";
import type { SynthesizedAudio, VoiceProvider } from "@/lib/voice/provider";
import { toneWav } from "@/lib/voice/stub";
import { authorizeChapterTrack, authorizeGuardianChapterTrack, deleteVoiceNarrations, libraryFor, readPlayback, requestGeneration, runJob } from "./narration";
import { MemoryNarrationStorage } from "./storage";
import { bookText } from "./text";
import { tracksFolder } from "./tracks";

const mom: Actor = { kind: "adult", adultId: "sara" };
const maya = { kind: "child", childId: "maya" } as const;
const leo = { kind: "child", childId: "leo" } as const;
const H = DEMO_HOUSEHOLD_ID;
const KEY = "track-test-key";
const BOOK = "the-lion-and-the-mouse";
const text = bookText(BOOK)!;
const chapter = text.chapters[0]!;

let tick = Date.parse("2026-10-24T00:00:00Z");
const clock = () => new Date((tick += 1000));

/** Each sentence is a one-second stand-in tone; counts every call so tests can prove none are made. */
class CountingProvider implements VoiceProvider {
  calls = 0;
  async createInstantVoice() {
    return { voiceId: "x" };
  }
  async synthesize(): Promise<SynthesizedAudio> {
    this.calls += 1;
    return { audio: toneWav(1), contentType: "audio/wav", standIn: true };
  }
  async deleteVoice() {}
}

/** Counts writes, to show a track is assembled once and then reused. */
class CountingStorage extends MemoryNarrationStorage {
  puts: string[] = [];
  async put(key: string, audio: ArrayBuffer, contentType: string) {
    this.puts.push(key);
    return super.put(key, audio, contentType);
  }
}

function family() {
  const state: FamilyState = demoFamilyState();
  const audio = new CountingStorage();
  return { state, audio, store: new MemoryFamilyStore(state, DEFAULT_PLAN, audio) };
}

async function prepareJune(store: MemoryFamilyStore) {
  const provider = new CountingProvider();
  const { job } = await requestGeneration(store, mom, H, { voiceId: "voice-june", bookSlug: BOOK, scope: "book" }, clock);
  if (job) await runJob(store, provider, job.id, clock);
  return provider;
}

async function childTrack(store: MemoryFamilyStore, child: typeof maya | typeof leo = maya, number = chapter.number) {
  await startListening(store, child, child.childId, clock);
  return authorizeChapterTrack(store, child, { childId: child.childId, voiceId: "voice-june", bookSlug: BOOK, chapter: number }, KEY, clock);
}

const tokenOf = (url: string) => url.split("/").pop()!;
const ledgerSize = (state: FamilyState) => state.ledger.length;

async function rejects(p: Promise<unknown>, status: number, code?: string) {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(PermissionError);
  expect((err as PermissionError).status).toBe(status);
  if (code) expect((err as PermissionError).code).toBe(code);
}

describe("chapter tracks", () => {
  it("joins a prepared chapter from stored audio without generating anything or using credits", async () => {
    const { state, store } = family();
    const provider = await prepareJune(store);
    const generated = provider.calls;
    const ledger = ledgerSize(state);
    const plays = state.plays.length;

    const track = await childTrack(store);
    expect(provider.calls).toBe(generated);
    expect(ledgerSize(state)).toBe(ledger);

    // One entry per sentence of the chapter, in order, counted the way the players count sentences.
    const indexes = chapter.sentenceIds.map((id) => text.sentences.findIndex((s) => s.id === id));
    expect(track.sentences.map((s) => s.index)).toEqual(indexes);
    expect(track.revision).toBe(text.revision);
    expect(track.contentType).toBe("audio/wav");
    // Each stand-in sentence is exactly one second; "The End." waits its pause first.
    const endsWithTheEnd = text.sentences.at(-1)!.text === THE_END && chapter === text.chapters.at(-1);
    track.sentences.forEach((s, i) => {
      const pause = endsWithTheEnd && i === track.sentences.length - 1 ? THE_END_PAUSE_MS : 0;
      expect(s.startMs).toBe(i * 1000 + pause);
      expect(s.durationMs).toBe(1000);
    });
    expect(track.durationMs).toBe(track.sentences.length * 1000 + (endsWithTheEnd ? THE_END_PAUSE_MS : 0));
    // The whole chapter counts as played, as it did sentence by sentence.
    expect(state.plays.length - plays).toBe(chapter.sentenceIds.length);

    const whole = await readPlayback(store, maya, tokenOf(track.url), KEY, tick);
    expect(whole.contentType).toBe("audio/wav");
    expect(whole.audio.byteLength).toBe(44 + (track.durationMs / 1000) * 16_000 * 2);
  });

  it("serves byte ranges of a track, so phones can seek in it", async () => {
    const { store } = family();
    await prepareJune(store);
    const track = await childTrack(store);
    const part = await readPlayback(store, maya, tokenOf(track.url), KEY, tick, { start: 100, end: 199 });
    expect(part.audio.byteLength).toBe(100);
    const rest = await readPlayback(store, maya, tokenOf(track.url), KEY, tick, { start: 1000, end: null });
    expect(part.size).toBe(rest.size);
    expect(rest.audio.byteLength).toBe(rest.size - 1000);
  });

  it("is assembled once and reused, and rebuilt when a sentence is prepared again", async () => {
    const { state, audio, store } = family();
    await prepareJune(store);
    const first = await childTrack(store);
    const built = audio.puts.length;
    const again = await authorizeGuardianChapterTrack(store, mom, { householdId: H, voiceId: "voice-june", bookSlug: BOOK, chapter: chapter.number }, KEY, clock);
    expect(audio.puts.length).toBe(built);
    expect(tokenOf(again.url)).not.toBe(tokenOf(first.url));
    expect(again.sentences).toEqual(first.sentences);

    const library = libraryFor(state, DEFAULT_PLAN, "voice-june", text, H);
    const seg = state.segments.find((s) => s.libraryKey === library.key && s.sentenceId === chapter.sentenceIds[0])!;
    seg.readyAt = "2026-10-24T12:00:00Z";
    await childTrack(store);
    expect(audio.puts.length).toBe(built + 2);
    expect((await audio.list(tracksFolder(library.key))).length).toBe(4);
  });

  it("is refused for a chapter that isn't fully prepared", async () => {
    const { state, store } = family();
    await rejects(childTrack(store), 409, "not_prepared");
    await prepareJune(store);
    const library = libraryFor(state, DEFAULT_PLAN, "voice-june", text, H);
    state.segments.find((s) => s.libraryKey === library.key && s.sentenceId === chapter.sentenceIds.at(-1))!.status = "failed";
    await rejects(childTrack(store), 409, "not_prepared");
    await rejects(childTrack(store, maya, 999), 400, "bad_chapter");
  });

  it("falls back to sentence by sentence when stored clips can't be joined", async () => {
    const { state, store } = family();
    await prepareJune(store);
    const library = libraryFor(state, DEFAULT_PLAN, "voice-june", text, H);
    const seg = state.segments.find((s) => s.libraryKey === library.key && s.sentenceId === chapter.sentenceIds[0])!;
    await store.audio.put(seg.storageKey!, new Uint8Array([0xff, 0xfb, 0x90, 0x44, ...new Array(500).fill(0)]).buffer, "audio/mpeg");
    await rejects(childTrack(store), 409, "track_unavailable");
  });

  it("checks the same gates as sentence playback", async () => {
    const { state, store } = family();
    await prepareJune(store);
    // No listening session yet.
    await rejects(authorizeChapterTrack(store, maya, { childId: "maya", voiceId: "voice-june", bookSlug: BOOK, chapter: chapter.number }, KEY, clock), 409, "no_listening_session");
    // A child without approval for this voice.
    expect(state.approvals.some((a) => a.voiceId === "voice-june" && a.childId === "leo")).toBe(false);
    await rejects(childTrack(store, leo), 403);
    // One child can't use another's link.
    const track = await childTrack(store);
    await rejects(readPlayback(store, leo, tokenOf(track.url), KEY, tick), 403);
  });

  it("lets a grown-up play a track with no child approval, and keeps children off a grown-up's link", async () => {
    const { state, store } = family();
    state.approvals = state.approvals.filter((a) => a.voiceId !== "voice-june");
    await prepareJune(store);
    const track = await authorizeGuardianChapterTrack(store, mom, { householdId: H, voiceId: "voice-june", bookSlug: BOOK, chapter: chapter.number }, KEY, clock);
    expect((await readPlayback(store, mom, tokenOf(track.url), KEY, tick)).audio.byteLength).toBeGreaterThan(0);
    await rejects(readPlayback(store, maya, tokenOf(track.url), KEY, tick), 403);
    await rejects(authorizeGuardianChapterTrack(store, maya, { householdId: H, voiceId: "voice-june", bookSlug: BOOK, chapter: chapter.number }, KEY, clock), 403);
  });

  it("lasts as long as the track plus a grace period, and a revocation stops it at once", async () => {
    const { store } = family();
    await prepareJune(store);
    const track = await childTrack(store);
    const token = tokenOf(track.url);
    expect(Date.parse(track.expiresAt) - tick).toBeGreaterThan(track.durationMs + 29 * 60_000);
    await rejects(readPlayback(store, maya, token, KEY, Date.parse(track.expiresAt) + 1), 403);
    await releaseNarrator(store, mom, H, "voice-june", clock);
    await rejects(readPlayback(store, maya, token, KEY, tick), 403);
  });

  it("is deleted with the voice's narration", async () => {
    const { state, store } = family();
    await prepareJune(store);
    const track = await childTrack(store);
    const library = libraryFor(state, DEFAULT_PLAN, "voice-june", text, H);
    expect(await store.audio.list(tracksFolder(library.key))).toHaveLength(2);
    await deleteVoiceNarrations(store, "voice-june", clock);
    expect(await store.audio.list(tracksFolder(library.key))).toHaveLength(0);
    await rejects(readPlayback(store, maya, tokenOf(track.url), KEY, tick), 403);
  });
});
