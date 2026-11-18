import { describe, expect, it } from "vitest";
import { demoFamilyState, DEMO_HOUSEHOLD_ID } from "@/lib/family/demo-family";
import type { Actor, FamilyState } from "@/lib/family/model";
import { DEFAULT_PLAN } from "@/lib/family/plan";
import { MemoryFamilyStore, setHouseholdShare } from "@/lib/family/service";
import type { SynthesizedAudio, VoiceProvider } from "@/lib/voice/provider";
import { toneWav } from "@/lib/voice/stub";
import { creditBalance } from "./credits";
import { libraryFor, narrationFor, requestGeneration, runJob } from "./narration";
import { STUCK_AFTER_MS, SupportError, supportAudiobooks, supportCarryForward, supportPrepare, supportRefund, supportStop } from "./support";
import { bookText, bookTextAt } from "./text";

/** Support tools (Kevin, 2026-11-08): fixing a family's audiobooks from admin, always free for the family. */
const mom: Actor = { kind: "adult", adultId: "sara" };
const H = DEMO_HOUSEHOLD_ID;
const ADMIN = "admin-1";
const GARDEN = "the-secret-garden";
const GARDEN_OLD = "8d91ea7b3ff1"; // "born in India" was removed from chapter 1
const LION = "the-lion-and-the-mouse";

let tick = Date.parse("2026-11-01T00:00:00Z");
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

/** Chapter 1 of The Secret Garden, prepared in June's voice before its text changed. */
async function seedOldChapterOne(state: FamilyState, store: MemoryFamilyStore) {
  const text = bookTextAt(GARDEN, GARDEN_OLD)!;
  const library = { ...libraryFor(state, store.plan, "voice-june", text, H), createdAt: "2026-10-11T00:00:00Z" };
  state.libraries.push(library);
  for (const s of text.sentences.filter((x) => x.chapter === 1)) {
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
  return text;
}

const ledgerFor = (state: FamilyState) => state.ledger.filter((e) => e.householdId === H);
const june = (state: FamilyState, slug: string) =>
  supportAudiobooks(state, DEFAULT_PLAN, H, new Date(tick).toISOString())
    .find((b) => b.slug === slug)!
    .narrations.find((n) => n.voiceId === "voice-june")!;

async function fails(p: Promise<unknown>, message: RegExp) {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(SupportError);
  expect((err as Error).message).toMatch(message);
}

describe("a family's audiobooks as support sees them", () => {
  it("shows what plays now and from which text, per chapter, beside today's text", async () => {
    const { state, store } = family();
    const old = await seedOldChapterOne(state, store);
    const today = bookText(GARDEN)!;
    const view = june(state, GARDEN);
    expect(view.heard).toMatchObject({ revision: GARDEN_OLD, current: false, pinned: true, listenable: true });
    expect(view.heard.ready).toBe(old.chapters[0]!.sentenceIds.length);
    expect(view.today.revision).toBe(today.revision);
    expect(view.chapters[0]).toMatchObject({ number: 1, heard: { readiness: "ready" }, today: { readiness: "not_prepared", ready: 0 } });
    // Every line of chapter 1 but the one that changed can come over for free.
    expect(view.carry).toBe(old.chapters[0]!.sentenceIds.length - 1);
    expect(view.missing).toBe(today.sentences.length - view.carry);
    expect(view.jobs).toEqual([]);
  });

  it("marks a preparation stuck when nothing has been stored for a while", async () => {
    const { state, store } = family();
    const { job } = await requestGeneration(store, mom, H, { voiceId: "voice-june", bookSlug: LION, scope: "book" }, clock);
    expect(june(state, LION).jobs[0]).toMatchObject({ id: job!.id, status: "queued", stuck: false, free: false });
    tick += STUCK_AFTER_MS + 60_000;
    const view = june(state, LION);
    expect(view.jobs[0]!.stuck).toBe(true);
    expect(view.jobs[0]!.held).toBeGreaterThan(0);
  });
});

describe("support fixes", () => {
  it("carries prepared audio to today's text, then prepares the changed line at Readli's cost", async () => {
    const { state, store } = family();
    const old = await seedOldChapterOne(state, store);
    const today = bookText(GARDEN)!;
    const carried = await supportCarryForward(store, H, "voice-june", GARDEN, clock);
    expect(carried).toBe(old.chapters[0]!.sentenceIds.length - 1);
    expect(ledgerFor(state)).toEqual([]);
    await fails(supportCarryForward(store, H, "voice-june", GARDEN, clock), /no prepared audio to carry over/);

    const job = await supportPrepare(store, ADMIN, H, { voiceId: "voice-june", bookSlug: GARDEN, chapter: 1 }, clock);
    expect(job!.sentenceIds).toHaveLength(1);
    expect(job!.requestedBy).toBe(ADMIN);
    expect(Object.values(job!.reservations).every((d) => d.length === 0)).toBe(true);
    const provider = new CountingProvider();
    await runJob(store, provider, job!.id, clock);
    expect(provider.calls).toHaveLength(1);

    // Chapter 1 now plays from today's text, and the family was never charged.
    const heard = narrationFor(state, store.plan, "voice-june", today, H);
    expect(heard.text.revision).toBe(today.revision);
    expect(today.chapters[0]!.sentenceIds.every((id) => heard.status.readySentenceIds.includes(id))).toBe(true);
    expect(ledgerFor(state)).toEqual([]);
    expect(june(state, GARDEN).jobs[0]).toMatchObject({ status: "done", free: true, committed: 0 });
  });

  it("prepares a whole book at Readli's cost and nothing more once it's there", async () => {
    const { state, store } = family();
    const job = await supportPrepare(store, ADMIN, H, { voiceId: "voice-june", bookSlug: LION, chapter: null }, clock);
    expect(job!.sentenceIds).toHaveLength(bookText(LION)!.sentences.length);
    await runJob(store, new CountingProvider(), job!.id, clock);
    expect(ledgerFor(state)).toEqual([]);
    expect(june(state, LION).heard.readiness).toBe("ready");
    expect(await supportPrepare(store, ADMIN, H, { voiceId: "voice-june", bookSlug: LION, chapter: null }, clock)).toBeNull();
  });

  it("never prepares in a voice that isn't shared with the family", async () => {
    const { store } = family();
    await setHouseholdShare(store, { kind: "adult", adultId: "june" }, { voiceId: "voice-june", householdId: H, shared: false, policyVersion: "p" }, clock);
    await fails(supportPrepare(store, ADMIN, H, { voiceId: "voice-june", bookSlug: LION, chapter: null }, clock), /isn't sharing their voice/);
  });

  it("stops a preparation and gives back what it was holding", async () => {
    const { state, store } = family();
    const before = creditBalance(state, store.plan, H, new Date(tick).toISOString()).available;
    const { job } = await requestGeneration(store, mom, H, { voiceId: "voice-june", bookSlug: LION, scope: "book" }, clock);
    expect(creditBalance(state, store.plan, H, new Date(tick).toISOString()).available).toBeLessThan(before);
    const stopped = await supportStop(store, H, job!.id, clock);
    expect(stopped.status).toBe("canceled");
    expect(creditBalance(state, store.plan, H, new Date(tick).toISOString()).available).toBe(before);
    await fails(supportStop(store, H, job!.id, clock), /already stopped/);
  });

  it("refunds what one finished preparation used, once, and keeps the audio", async () => {
    const { state, store } = family();
    const { job } = await requestGeneration(store, mom, H, { voiceId: "voice-june", bookSlug: LION, scope: "book" }, clock);
    await fails(supportRefund(store, H, job!.id, clock), /Stop that preparation first/);
    await runJob(store, new CountingProvider(), job!.id, clock);
    const at = () => new Date(tick).toISOString();
    const before = creditBalance(state, store.plan, H, at()).available;
    const used = ledgerFor(state).filter((e) => e.jobId === job!.id && e.kind === "commit").reduce((n, e) => n + e.credits, 0);
    const { units, note } = await supportRefund(store, H, job!.id, clock);
    expect(units).toBe(used);
    expect(note).toContain(bookText(LION)!.title);
    expect(creditBalance(state, store.plan, H, at()).available).toBe(before + used);
    expect(june(state, LION).jobs[0]!.supportRefund).toBe(used);
    expect(june(state, LION).heard.readiness).toBe("ready");
    await fails(supportRefund(store, H, job!.id, clock), /already refunded/);
  });

  it("has nothing to refund for a preparation Readli paid for", async () => {
    const { store } = family();
    const job = await supportPrepare(store, ADMIN, H, { voiceId: "voice-june", bookSlug: LION, chapter: null }, clock);
    await runJob(store, new CountingProvider(), job!.id, clock);
    await fails(supportRefund(store, H, job!.id, clock), /Nothing was charged/);
  });
});
