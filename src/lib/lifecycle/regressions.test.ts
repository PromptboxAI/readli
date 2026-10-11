import { describe, expect, it } from "vitest";
import { demoFamilyState, DEMO_HOUSEHOLD_ID } from "@/lib/family/demo-family";
import type { Actor, FamilyState } from "@/lib/family/model";
import { childVoiceAccess, storedNarrationAccess } from "@/lib/family/permissions";
import { DEFAULT_PLAN } from "@/lib/family/plan";
import { switchPlanTier } from "@/lib/family/plan-change";
import { activateNarrator, grantEntitlement, MemoryFamilyStore, PermissionError, setChildApprovals, setHouseholdShare, startListening } from "@/lib/family/service";
import { authorizePlayback, libraryFor, playbackLibrary, readPlayback, requestGeneration, runJob, stopJob, stopVoiceNarration } from "@/lib/narration/narration";
import { bookText } from "@/lib/narration/text";
import type { SynthesizedAudio, VoiceProvider } from "@/lib/voice/provider";
import { toneWav } from "@/lib/voice/stub";
import { removeFromFamilyStore } from "./legal-removal";

/**
 * Kevin's review of PRs #53 and #54 (2026-10-11), item 8: the app, database, billing and legal
 * documents describe one set of rules. These follow a voice through families, deletion, replacement,
 * the Archive, cancellation and legal removal, checking that finished stories survive everything but
 * a legally required removal.
 */
const mom: Actor = { kind: "adult", adultId: "sara" };
const kim: Actor = { kind: "adult", adultId: "kim" };
const maya = { kind: "child" as const, childId: "maya" };
const ivy = { kind: "child" as const, childId: "ivy" };
const H = DEMO_HOUSEHOLD_ID;
const H2 = "home-two";
const KEY = "regression-key";
const BOOK = "the-lion-and-the-mouse";
const text = bookText(BOOK)!;
const PLAN = { ...DEFAULT_PLAN, simulatedCheckout: true };

let tick = Date.parse("2026-10-10T00:00:00Z");
const clock = () => new Date((tick += 1000));

class Provider implements VoiceProvider {
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

async function setup() {
  const state: FamilyState = demoFamilyState();
  const store = new MemoryFamilyStore(state, PLAN);
  // A second family, on its own plan, that Grandma June also belongs to and shares her voice with.
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
  return { state, store };
}

async function prepare(store: MemoryFamilyStore, actor = mom, home = H) {
  const { job } = await requestGeneration(store, actor, home, { voiceId: "voice-june", bookSlug: BOOK, scope: "book" }, clock);
  if (job) await runJob(store, new Provider(), job.id, clock);
  return job;
}

async function plays(store: MemoryFamilyStore, child: typeof maya): Promise<boolean> {
  try {
    await startListening(store, child, child.childId, clock);
    const { url } = await authorizePlayback(store, child, { childId: child.childId, voiceId: "voice-june", bookSlug: BOOK, sentence: 0 }, KEY, clock);
    const audio = await readPlayback(store, child, url.split("/").pop()!, KEY, tick);
    return audio.audio.byteLength > 0;
  } catch (err) {
    if (err instanceof PermissionError) return false;
    throw err;
  }
}

async function rejects(p: Promise<unknown>, code: string) {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(PermissionError);
  expect((err as PermissionError).code).toBe(code);
}

const withdraw = (store: MemoryFamilyStore) =>
  store.write((s) => {
    const v = s.voices.find((x) => x.id === "voice-june")!;
    const at = clock().toISOString();
    Object.assign(v, { status: "withdrawn", withdrawnAt: at, cloneRetiredAt: at });
  });

const charged = (state: FamilyState, home: string) => {
  const sum = (kind: string) => state.ledger.filter((e) => e.householdId === home && e.kind === kind).reduce((n, e) => n + e.credits, 0);
  return sum("reserve") - sum("refund");
};

describe("finished stories survive the voice lifecycle", () => {
  it("a voice shared with several households plays in each, but only Family households make new stories", async () => {
    const { store } = await setup();
    await prepare(store);
    expect(await plays(store, maya)).toBe(true);
    expect(await plays(store, ivy)).toBe(true);
    await switchPlanTier(store, kim, H2, "archive", clock);
    const s = await store.read();
    expect(storedNarrationAccess(s, "ivy", "voice-june", PLAN).allowed).toBe(true);
    expect(childVoiceAccess(s, "ivy", "voice-june", PLAN).allowed).toBe(false);
    expect(childVoiceAccess(s, "maya", "voice-june", PLAN).allowed).toBe(true);
  });

  it("deleting a voice stops new stories and unfinished jobs but keeps finished stories in every family", async () => {
    const { state, store } = await setup();
    await prepare(store);
    const { job } = await requestGeneration(store, kim, H2, { voiceId: "voice-june", bookSlug: "the-little-red-hen", scope: "book" }, clock);
    expect(job?.status).toBe("queued");
    await withdraw(store);
    expect(await stopVoiceNarration(store, "voice-june", clock)).toBe(1);
    expect(charged(await store.read(), H2)).toBe(0);
    expect(await plays(store, maya)).toBe(true);
    expect(await plays(store, ivy)).toBe(true);
    await rejects(requestGeneration(store, mom, H, { voiceId: "voice-june", bookSlug: "the-little-red-hen", scope: "book" }, clock), "voice_withdrawn");
    expect(state.segments.some((x) => x.status === "ready")).toBe(true);
  });

  it("re-recording keeps finished books in the voice version they were made with", async () => {
    const { store } = await setup();
    await prepare(store);
    const before = await store.read();
    const original = libraryFor(before, PLAN, "voice-june", text, H);
    await store.write((s) => void (s.voices.find((v) => v.id === "voice-june")!.version += 1));
    const after = await store.read();
    expect(libraryFor(after, PLAN, "voice-june", text, H).key).not.toBe(original.key);
    expect(playbackLibrary(after, PLAN, "voice-june", text, H).key).toBe(original.key);
    expect(await plays(store, maya)).toBe(true);
  });

  it("the Archive keeps stories without new generation, and moving back restores generation", async () => {
    const { store } = await setup();
    await prepare(store);
    const { job } = await requestGeneration(store, mom, H, { voiceId: "voice-june", bookSlug: "the-little-red-hen", scope: "book" }, clock);
    const change = await switchPlanTier(store, mom, H, "archive", clock);
    expect(change).toEqual({ from: "family", tier: "archive", stoppedJobs: 1 });
    expect((await store.read()).jobs.find((j) => j.id === job!.id)?.status).toBe("canceled");
    expect(await plays(store, maya)).toBe(true);
    await rejects(requestGeneration(store, mom, H, { voiceId: "voice-june", bookSlug: "the-little-red-hen", scope: "book" }, clock), "no_family_plan");
    await switchPlanTier(store, mom, H, "family", clock);
    const again = await requestGeneration(store, mom, H, { voiceId: "voice-june", bookSlug: "the-little-red-hen", scope: "book" }, clock);
    expect(again.job?.status).toBe("queued");
  });

  it("stopping a job refunds undelivered credits once, and never refunds delivered narration", async () => {
    const { state, store } = await setup();
    const done = await prepare(store);
    const spent = charged(state, H);
    expect(spent).toBeGreaterThan(0);
    const { job } = await requestGeneration(store, mom, H, { voiceId: "voice-june", bookSlug: "the-little-red-hen", scope: "book" }, clock);
    await store.write((s) => {
      const j = s.jobs.find((x) => x.id === job!.id)!;
      expect(stopJob(s, j, clock().toISOString())).toBe(true);
      expect(stopJob(s, j, clock().toISOString())).toBe(false);
      // The finished job can't be "stopped" into a refund.
      expect(stopJob(s, s.jobs.find((x) => x.id === done!.id)!, clock().toISOString())).toBe(false);
    });
    expect(charged(await store.read(), H)).toBe(spent);
  });

  it("nothing streams once a household's paid access ends", async () => {
    const { store } = await setup();
    await prepare(store);
    await store.write((s) => {
      for (const e of s.entitlements) if (e.householdId === H2) Object.assign(e, { status: "canceled", endsAt: clock().toISOString() });
    });
    expect(await plays(store, ivy)).toBe(false);
    expect(await plays(store, maya)).toBe(true);
  });

  it("legal removal of one book previews first, then removes only that book for every family", async () => {
    const { state, store } = await setup();
    await prepare(store);
    const req = { voiceId: "voice-june", bookSlug: BOOK, reason: "Court order to remove this narration", reference: "case 42", requestedBy: "admin@readli.ai" };
    const dry = await removeFromFamilyStore(store, req, { dryRun: true }, clock);
    expect(dry.plan.segments).toBeGreaterThan(0);
    expect(dry.audit).toMatchObject({ action: "legal_removal", dryRun: true });
    expect(await plays(store, maya)).toBe(true);
    const real = await removeFromFamilyStore(store, req, { dryRun: false }, clock);
    expect(real.plan.storageKeys).toEqual(dry.plan.storageKeys);
    expect(await plays(store, maya)).toBe(false);
    expect(await plays(store, ivy)).toBe(false);
    // The voice itself stays: only that book went.
    expect(state.voices.find((v) => v.id === "voice-june")?.status).toBe("ready");
  });
});
