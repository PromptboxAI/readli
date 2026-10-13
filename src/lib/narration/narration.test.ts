import { describe, expect, it } from "vitest";
import { demoFamilyState, DEMO_HOUSEHOLD_ID } from "@/lib/family/demo-family";
import type { Actor, FamilyState } from "@/lib/family/model";
import { DEFAULT_PLAN, type PlanConfig } from "@/lib/family/plan";
import {
  activateNarrator,
  grantEntitlement,
  MemoryFamilyStore,
  PermissionError,
  releaseNarrator,
  setChildApprovals,
  setHouseholdShare,
  startListening,
} from "@/lib/family/service";
import type { SynthesizedAudio, VoiceProvider } from "@/lib/voice/provider";
import { toneWav } from "@/lib/voice/stub";
import { ELEVENLABS_PLANS, modelCost, usdPerMinute } from "./costs";
import {
  authorizePlayback,
  cancelGeneration,
  deleteVoiceNarrations,
  kidsReadiness,
  libraryFor,
  libraryStatus,
  prepareView,
  readPlayback,
  requestGeneration,
  runJob,
} from "./narration";
import { creditBalance } from "./credits";
import { bookText } from "./text";

/** Voice Narration Libraries, Pre-Generation & Instant Narrator Switching amendment: required tests. */
const mom: Actor = { kind: "adult", adultId: "sara" };
const kim: Actor = { kind: "adult", adultId: "kim" };
const maya: Actor = { kind: "child", childId: "maya" };
const leo: Actor = { kind: "child", childId: "leo" };
const ivy: Actor = { kind: "child", childId: "ivy" };
const H = DEMO_HOUSEHOLD_ID;
const H2 = "home-two";
const KEY = "playback-test-key";
const BOOK = "the-lion-and-the-mouse";
const text = bookText(BOOK)!;

let tick = Date.parse("2026-10-10T00:00:00Z");
const clock = () => new Date((tick += 1000));

/** Counts every provider call; can be told to fail some sentences. */
class CountingProvider implements VoiceProvider {
  calls: string[] = [];
  constructor(private failWhen: (text: string) => boolean = () => false) {}
  async createInstantVoice(): Promise<{ voiceId: string }> {
    return { voiceId: "x" };
  }
  async synthesize(input: { voiceId: string; text: string }): Promise<SynthesizedAudio> {
    this.calls.push(input.text);
    if (this.failWhen(input.text)) throw new Error("provider down");
    return { audio: toneWav(1), contentType: "audio/wav", standIn: true };
  }
  async deleteVoice() {}
}

function family(plan: PlanConfig = DEFAULT_PLAN) {
  const state: FamilyState = demoFamilyState();
  return { state, store: new MemoryFamilyStore(state, plan) };
}

/** A second paying household where Grandma June is also a member; her voice is shared there too. */
async function addSecondHousehold(state: FamilyState, store: MemoryFamilyStore) {
  state.households.push({ id: H2, name: "Kim's family" });
  state.adults.push({ id: "kim", displayName: "Kim", relationship: "June's daughter-in-law", avatarUrl: null, tint: "bg-mint" });
  state.members.push(
    { householdId: H2, adultId: "kim", role: "guardian", joinedAt: "2026-10-01T00:00:00Z", removedAt: null },
    { householdId: H2, adultId: "june", role: "member", joinedAt: "2026-10-01T00:00:00Z", removedAt: null },
  );
  state.children.push({ id: "ivy", householdId: H2, nickname: "Ivy", tint: "bg-sky", guardianIds: ["kim"], deletedAt: null });
  await grantEntitlement(store, H2, { source: "subscription", months: null }, clock);
  await setHouseholdShare(store, { kind: "adult", adultId: "june" }, { voiceId: "voice-june", householdId: H2, shared: true, policyVersion: "p" }, clock);
  await activateNarrator(store, kim, H2, "voice-june", clock);
  await setChildApprovals(store, kim, "ivy", [{ voiceId: "voice-june", approved: true }], clock);
}

/** Mom prepares the whole book in Grandma June's voice and the worker finishes it. */
async function prepareJune(store: MemoryFamilyStore, provider = new CountingProvider(), actor = mom, home = H) {
  const { job } = await requestGeneration(store, actor, home, { voiceId: "voice-june", bookSlug: BOOK, scope: "book" }, clock);
  if (job) await runJob(store, provider, job.id, clock);
  return { job, provider };
}

async function play(store: MemoryFamilyStore, child: Actor & { kind: "child" }, sentence: number, voiceId = "voice-june") {
  await startListening(store, child, child.childId, clock);
  const { url } = await authorizePlayback(store, child, { childId: child.childId, voiceId, bookSlug: BOOK, sentence }, KEY, clock);
  return url.split("/").pop()!;
}

async function rejects(p: Promise<unknown>, status: number, code?: string) {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(PermissionError);
  expect((err as PermissionError).status).toBe(status);
  if (code) expect((err as PermissionError).code).toBe(code);
}

const library = (state: FamilyState, home = H, voiceId = "voice-june", plan = DEFAULT_PLAN) => libraryFor(state, plan, voiceId, text, home);
const charged = (state: FamilyState, home: string) => {
  const sum = (kind: string) => state.ledger.filter((e) => e.householdId === home && e.kind === kind).reduce((n, e) => n + e.credits, 0);
  return sum("reserve") - sum("refund");
};

describe("narration libraries (required tests)", () => {
  it("replaying prepared narration never calls the voice provider", async () => {
    const { state, store } = family();
    const { provider } = await prepareJune(store);
    const generated = provider.calls.length;
    expect(generated).toBe(text.sentences.length);
    for (let i = 0; i < 3; i++) {
      const token = await play(store, maya, 0);
      expect((await readPlayback(store, maya, token, KEY, tick)).audio.byteLength).toBeGreaterThan(0);
    }
    // Asking to prepare it again is free and generates nothing.
    const again = await requestGeneration(store, mom, H, { voiceId: "voice-june", bookSlug: BOOK, scope: "book" }, clock);
    expect(again.job).toBeNull();
    expect(again.quote.estimateSeconds).toBe(0);
    expect(provider.calls.length).toBe(generated);
    expect(state.plays.length).toBe(3);
  });

  it("two children play the same stored audio independently", async () => {
    const { state, store } = family();
    await setChildApprovals(store, mom, "leo", [{ voiceId: "voice-june", approved: true }], clock);
    await prepareJune(store);
    const a = await play(store, maya, 0);
    const b = await play(store, leo, 2);
    expect(a).not.toBe(b);
    expect((await readPlayback(store, maya, a, KEY, tick)).audio.byteLength).toBeGreaterThan(0);
    expect((await readPlayback(store, leo, b, KEY, tick)).audio.byteLength).toBeGreaterThan(0);
    // Each token belongs to its child.
    await rejects(readPlayback(store, maya, b, KEY, tick), 403);
    expect(new Set(state.plays.map((p) => p.childId))).toEqual(new Set(["maya", "leo"]));
    expect(state.sessions.filter((s) => s.endedAt === null).map((s) => s.childId).sort()).toEqual(["leo", "maya"]);
  });

  it("two households reuse one narration without generating or paying again", async () => {
    const { state, store } = family();
    await addSecondHousehold(state, store);
    const { provider } = await prepareJune(store);
    const before = provider.calls.length;
    expect(library(state, H).key).toBe(library(state, H2).key);
    const second = await requestGeneration(store, kim, H2, { voiceId: "voice-june", bookSlug: BOOK, scope: "book" }, clock);
    expect(second.job).toBeNull();
    expect(charged(state, H2)).toBe(0);
    const token = await play(store, ivy, 1);
    expect((await readPlayback(store, ivy, token, KEY, tick)).audio.byteLength).toBeGreaterThan(0);
    expect(provider.calls.length).toBe(before);
    // Without a license for cross-household reuse, each household has its own library.
    const unlicensed = { ...DEFAULT_PLAN, crossHouseholdReuse: false };
    expect(library(state, H, "voice-june", unlicensed).key).not.toBe(library(state, H2, "voice-june", unlicensed).key);
  });

  it("switching narrators keeps the exact sentence", async () => {
    const { state, store } = family();
    await prepareJune(store);
    // Mom's narration of the same book, prepared too.
    const { job } = await requestGeneration(store, mom, H, { voiceId: "voice-sara", bookSlug: BOOK, scope: "book" }, clock);
    await runJob(store, new CountingProvider(), job!.id, clock);
    const june = await play(store, maya, 4);
    const sara = await play(store, maya, 4, "voice-sara");
    const claims = (t: string) => JSON.parse(Buffer.from(t.split(".")[0]!, "base64url").toString()) as { sid: string; v: string };
    expect(claims(june).sid).toBe(text.sentences[4]!.id);
    expect(claims(sara).sid).toBe(claims(june).sid);
    expect(claims(sara).v).toBe("voice-sara");
    expect(state.plays.map((p) => p.sentenceId)).toEqual([text.sentences[4]!.id, text.sentences[4]!.id]);
  });

  it("unprepared narration is never labeled Ready, and partial preparation exposes only stored sentences", async () => {
    const { state, store } = family();
    expect(libraryStatus(state, library(state), text).readiness).toBe("not_prepared");
    // The provider fails on the third sentence every time.
    const failing = new CountingProvider((t) => t === text.sentences[2]!.text);
    const { job } = await prepareJune(store, failing);
    expect(job!.status).toBe("failed");
    const status = libraryStatus(state, library(state), text);
    expect(status.readiness).toBe("partial");
    expect(status.readySentenceIds).not.toContain(text.sentences[2]!.id);
    expect(status.ready).toBe(text.sentences.length - 1);
    // Retries were capped.
    expect(failing.calls.filter((t) => t === text.sentences[2]!.text)).toHaveLength(DEFAULT_PLAN.maxSegmentAttempts);
    const kids = await kidsReadiness(store, maya, "maya", BOOK);
    expect(kids.find((k) => k.voiceId === "voice-june")!.readiness).toBe("partial");
    await play(store, maya, 1);
    await rejects(play(store, maya, 2), 409, "not_prepared");
    // The failed sentence was refunded; only stored sentences were paid for.
    const paidFor = new Set(state.ledger.filter((e) => e.kind === "commit").map((e) => e.sentenceId));
    expect(paidFor.has(text.sentences[2]!.id)).toBe(false);
    // While a job is queued nothing is playable or Ready.
    const { state: s2, store: st2 } = family();
    await requestGeneration(st2, mom, H, { voiceId: "voice-june", bookSlug: BOOK, scope: "book" }, clock);
    expect(libraryStatus(s2, library(s2), text).readiness).toBe("preparing");
    await rejects(play(st2, maya, 0), 409, "not_prepared");
  });

  it("revocation blocks cached audio for that household, but not for others", async () => {
    const { state, store } = family();
    await addSecondHousehold(state, store);
    await prepareJune(store);
    const mayaToken = await play(store, maya, 0);
    const ivyToken = await play(store, ivy, 0);
    // Mom's household removes June from its narrator slot: Maya's still-valid URL stops working.
    await releaseNarrator(store, mom, H, "voice-june", clock);
    await rejects(readPlayback(store, maya, mayaToken, KEY, tick), 403);
    await rejects(play(store, maya, 0), 403);
    // Kim's household keeps access to the same stored audio.
    expect((await readPlayback(store, ivy, ivyToken, KEY, tick)).audio.byteLength).toBeGreaterThan(0);
    expect(state.segments.some((s) => s.libraryKey === library(state).key && s.status === "ready")).toBe(true);
    // Expired URLs are refused regardless.
    await rejects(readPlayback(store, ivy, ivyToken, KEY, tick + DEFAULT_PLAN.playbackUrlTtlSeconds * 1000 + 1), 403);
    // June deletes her voice's narration: gone for everyone.
    const storageKey = state.segments.find((s) => s.libraryKey === library(state).key)!.storageKey!;
    await deleteVoiceNarrations(store, "voice-june", clock);
    await rejects(readPlayback(store, ivy, ivyToken, KEY, tick), 403);
    expect(await store.audio.get(storageKey)).toBeNull();
    expect(state.segments.some((s) => s.libraryKey === library(state).key)).toBe(false);
  });

  it("duplicate concurrent requests create one job and one charge", async () => {
    const { state, store } = family();
    await addSecondHousehold(state, store);
    const req = { voiceId: "voice-june", bookSlug: BOOK, scope: "book" as const };
    const results = await Promise.all([
      requestGeneration(store, mom, H, req, clock),
      requestGeneration(store, mom, H, req, clock),
      requestGeneration(store, kim, H2, req, clock),
    ]);
    const jobs = results.filter((r) => r.job);
    expect(jobs).toHaveLength(1);
    expect(state.jobs).toHaveLength(1);
    const reserves = state.ledger.filter((e) => e.kind === "reserve");
    expect(reserves).toHaveLength(text.sentences.length);
    expect(new Set(reserves.map((e) => e.sentenceId)).size).toBe(text.sentences.length);
    expect(charged(state, H2)).toBe(0);
  });

  it("a job's credits are never consumed twice, even if the worker runs it again", async () => {
    const { state, store } = family();
    const provider = new CountingProvider();
    const { job } = await prepareJune(store, provider);
    const after = { ...creditBalance(state, DEFAULT_PLAN, H, new Date(tick).toISOString()) };
    await runJob(store, provider, job!.id, clock);
    job!.status = "running"; // as if a crashed worker resumed it
    await runJob(store, provider, job!.id, clock);
    expect(provider.calls.length).toBe(text.sentences.length);
    const commits = state.ledger.filter((e) => e.kind === "commit");
    expect(new Set(commits.map((e) => e.sentenceId)).size).toBe(commits.length);
    expect(creditBalance(state, DEFAULT_PLAN, H, new Date(tick).toISOString()).available).toBe(after.available);
    // Committed never exceeds what was reserved.
    expect(commits.reduce((n, e) => n + e.credits, 0)).toBeLessThanOrEqual(state.ledger.filter((e) => e.kind === "reserve").reduce((n, e) => n + e.credits, 0));
  });

  it("canceling refunds what wasn't generated, and a household can't overspend its allowance", async () => {
    const { state, store } = family();
    const { job } = await requestGeneration(store, mom, H, { voiceId: "voice-june", bookSlug: BOOK, scope: "book" }, clock);
    const held = creditBalance(state, DEFAULT_PLAN, H, new Date(tick).toISOString());
    expect(held.held).toBeGreaterThan(0);
    await cancelGeneration(store, mom, job!.id, clock);
    const back = creditBalance(state, DEFAULT_PLAN, H, new Date(tick).toISOString());
    expect(back.available).toBe(DEFAULT_PLAN.monthlyCredits * DEFAULT_PLAN.charactersPerCredit);
    expect(libraryStatus(state, library(state), text).readiness).toBe("not_prepared");
    // With no allowance left, a request is refused before anything is claimed.
    const tight = family({ ...DEFAULT_PLAN, monthlyCredits: 0 });
    await rejects(requestGeneration(tight.store, mom, H, { voiceId: "voice-june", bookSlug: BOOK, scope: "book" }, clock), 402, "not_enough_credits");
    expect(tight.state.jobs).toHaveLength(0);
    // A child can't prepare narration.
    await rejects(requestGeneration(store, maya, H, { voiceId: "voice-june", bookSlug: BOOK, scope: "book" }, clock), 403);
  });
});

describe("ElevenLabs cost model", () => {
  it("uses the corrected plan prices, not the old $2.40/hour estimate", () => {
    const pro = ELEVENLABS_PLANS.find((p) => p.name === "Pro")!;
    expect(pro.monthlyUsd).toBe(99);
    expect(pro.credits).toBe(600_000);
    const perMinute = usdPerMinute(pro, modelCost("eleven_v3"));
    expect(perMinute).toBeGreaterThan(0.1);
    expect(perMinute * 60).toBeGreaterThan(2.4);
  });
});

describe("each voice keeps its own reading model", () => {
  class ModelProvider extends CountingProvider {
    models: (string | undefined)[] = [];
    override async synthesize(input: { voiceId: string; text: string; modelId?: string }) {
      this.models.push(input.modelId);
      return super.synthesize(input);
    }
  }
  const june = (state: FamilyState) => state.voices.find((v) => v.id === "voice-june")!;

  it("reads with the voice's pinned model, not the plan's newer one", async () => {
    const { state, store } = family({ ...DEFAULT_PLAN, narrationModelId: "eleven_v5" });
    june(state).modelId = "eleven_v4";
    const provider = new ModelProvider();
    await prepareJune(store, provider);
    expect(new Set(provider.models)).toEqual(new Set(["eleven_v4"]));
    expect(library(state, H, "voice-june", store.plan).modelId).toBe("eleven_v4");
  });

  it("after switching to a new model, finished books keep playing and new books use the new model", async () => {
    const { state, store } = family();
    june(state).modelId = "eleven_v4";
    await prepareJune(store);
    const before = library(state).key;

    june(state).modelId = "eleven_v5";
    expect(library(state).key).toBe(before);
    expect(libraryStatus(state, library(state), text).readiness).toBe("ready");
    const again = await requestGeneration(store, mom, H, { voiceId: "voice-june", bookSlug: BOOK, scope: "book" }, clock);
    expect(again.job).toBeNull();

    expect(libraryFor(state, store.plan, "voice-june", bookText("the-little-red-hen")!, H).modelId).toBe("eleven_v5");
  });

  it("a book only partly prepared on the old model is finished on the new one", async () => {
    const { state, store } = family();
    june(state).modelId = "eleven_v4";
    await prepareJune(store, new CountingProvider((t) => t === text.sentences.at(-1)!.text));
    june(state).modelId = "eleven_v5";
    expect(library(state).modelId).toBe("eleven_v5");
  });
});

describe("prepare page", () => {
  it("links an unapproved narrator in a slot to where a parent approves them", async () => {
    const { state, store } = family();
    state.approvals = state.approvals.filter((a) => a.voiceId !== "voice-ben");
    const ben = (await prepareView(store, mom, H, BOOK, clock)).voices.find((v) => v.voiceId === "voice-ben")!;
    expect(ben.inSlot).toBe(true);
    expect(ben.availability).toBe("unavailable");
    expect(ben.fix).toEqual({ label: "Approve for a child", href: "/family/kids" });
  });

  it("points an approved narrator nowhere, and a household with no plan to the plans", async () => {
    const { state, store } = family();
    expect((await prepareView(store, mom, H, BOOK, clock)).voices.find((v) => v.voiceId === "voice-sara")!.fix).toBeNull();
    for (const e of state.entitlements) e.endsAt = "2026-01-01T00:00:00Z";
    expect((await prepareView(store, mom, H, BOOK, clock)).voices.find((v) => v.voiceId === "voice-sara")!.fix?.href).toBe("/family/billing");
  });
});
