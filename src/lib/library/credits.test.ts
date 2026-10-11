import { describe, expect, it } from "vitest";
import { demoFamilyState, DEMO_HOUSEHOLD_ID } from "@/lib/family/demo-family";
import type { Actor, FamilyState } from "@/lib/family/model";
import { DEFAULT_PLAN, type PlanConfig } from "@/lib/family/plan";
import { grantEntitlement, MemoryFamilyStore, PermissionError, startListening } from "@/lib/family/service";
import { creditBalance, includedLotId, spendableLots } from "@/lib/narration/credits";
import { authorizePlayback, grantPromoCredits, kidsReadiness, prepareView, purchaseCredits, quote, requestGeneration, runJob } from "@/lib/narration/narration";
import { bookText } from "@/lib/narration/text";
import type { SynthesizedAudio, VoiceProvider } from "@/lib/voice/provider";
import { toneWav } from "@/lib/voice/stub";
import { familyLibrary } from "./discovery";

/** Book Discovery, Generation Credits & Short-Story Launch amendment: required tests. */
const mom: Actor = { kind: "adult", adultId: "sara" };
const maya: Actor = { kind: "child", childId: "maya" };
const leo: Actor = { kind: "child", childId: "leo" };
const H = DEMO_HOUSEHOLD_ID;
const LONG = "aesops-fables-retold";
const SHORT = "the-lion-and-the-mouse";
const long = bookText(LONG)!;

let tick = Date.parse("2026-10-10T00:00:00Z");
const clock = () => new Date((tick += 1000));
const iso = () => new Date(tick).toISOString();

class Provider implements VoiceProvider {
  calls = 0;
  constructor(private fail: (text: string) => boolean = () => false) {}
  async createInstantVoice() {
    return { voiceId: "x" };
  }
  async synthesize(input: { voiceId: string; text: string }): Promise<SynthesizedAudio> {
    this.calls += 1;
    if (this.fail(input.text)) throw new Error("provider down");
    return { audio: toneWav(1), contentType: "audio/wav", standIn: true };
  }
  async deleteVoice() {}
}

/** The preview household on a small allowance: enough for short stories and single chapters, not the whole long book. */
function family(credits = 3, extra: Partial<PlanConfig> = {}) {
  const state: FamilyState = demoFamilyState();
  const plan = { ...DEFAULT_PLAN, monthlyCredits: credits, simulatedCheckout: true, ...extra };
  return { state, store: new MemoryFamilyStore(state, plan), plan };
}

const book = (voiceId = "voice-june") => ({ voiceId, bookSlug: LONG, scope: "book" as const });
const chapter = (n: number, voiceId = "voice-june") => ({ voiceId, bookSlug: LONG, scope: "chapter" as const, chapter: n });
const balance = (state: FamilyState, plan: PlanConfig) => creditBalance(state, plan, H, iso()).available;

async function rejects(p: Promise<unknown>, status: number, code?: string) {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(PermissionError);
  expect((err as PermissionError).status).toBe(status);
  if (code) expect((err as PermissionError).code).toBe(code);
  return err as PermissionError;
}

describe("generation credits (required tests)", () => {
  it("a book costing more than the household balance can't start generation, but a chapter can", async () => {
    const { state, store, plan } = family();
    const q = quote(state, plan, H, book());
    expect(q.credits).toBeGreaterThan(balance(state, plan));
    const err = await rejects(requestGeneration(store, mom, H, book(), clock), 402, "not_enough_credits");
    expect(err.details).toMatchObject({ needed: q.credits, extra: q.credits - balance(state, plan) });
    expect(state.jobs).toHaveLength(0);
    expect(state.ledger).toHaveLength(0);
    // The book page stays open and labels it, offering chapters and shorter books that fit.
    const view = await prepareView(store, mom, H, LONG, clock);
    const june = view.voices.find((v) => v.voiceId === "voice-june")!;
    expect(june.availability).toBe("needs_credits");
    expect(june.extraCreditsNeeded).toBe(q.credits - balance(state, plan));
    expect(view.chapterGenerationEnabled).toBe(true);
    expect(view.shorterThatFit.length).toBeGreaterThan(0);
    const { job } = await requestGeneration(store, mom, H, chapter(1), clock);
    expect(job?.sentenceIds).toEqual(long.chapters[0]!.sentenceIds);
  });

  it("buying credits lets the parent confirm the same book and narrator, and kids can't buy or generate", async () => {
    const { state, store, plan } = family();
    const need = quote(state, plan, H, book()).credits - balance(state, plan);
    await rejects(purchaseCredits(store, maya, H, "pack-medium", { paymentRef: null }, clock), 403);
    await rejects(requestGeneration(store, maya, H, book(), clock), 403);
    const lot = await purchaseCredits(store, mom, H, "pack-medium", { paymentRef: null }, clock);
    expect(lot.credits).toBeGreaterThanOrEqual(need);
    expect(creditBalance(state, plan, H, iso()).bySource.purchased).toBe(lot.credits);
    const { job } = await requestGeneration(store, mom, H, book(), clock);
    expect(job).not.toBeNull();
    // Promotional and monthly credits are spent before purchased ones.
    const drawn = Object.values(job!.reservations).flat();
    const fromLot = (id: string) => drawn.filter((d) => d.lotId === id).reduce((n, d) => n + d.credits, 0);
    expect(fromLot(includedLotId(state, H, iso())!)).toBe(plan.monthlyCredits * plan.charactersPerCredit);
    expect(fromLot(lot.id)).toBe(need);
  });

  it("cached narration costs nothing to quote, confirm or play", async () => {
    const { state, store, plan } = family(30);
    const provider = new Provider();
    const first = await requestGeneration(store, mom, H, { voiceId: "voice-june", bookSlug: SHORT, scope: "book" }, clock);
    await runJob(store, provider, first.job!.id, clock);
    const before = balance(state, plan);
    const ledger = state.ledger.length;
    const again = await requestGeneration(store, mom, H, { voiceId: "voice-june", bookSlug: SHORT, scope: "book" }, clock);
    expect(again.job).toBeNull();
    expect(again.quote.credits).toBe(0);
    await startListening(store, maya, "maya", clock);
    await authorizePlayback(store, maya, { childId: "maya", voiceId: "voice-june", bookSlug: SHORT, sentence: 0 }, "k", clock);
    expect(state.ledger.length).toBe(ledger);
    expect(balance(state, plan)).toBe(before);
    expect(provider.calls).toBe(bookText(SHORT)!.sentences.length);
  });

  it("a partly prepared book is labeled Partially ready, chapter by chapter", async () => {
    const { store } = family();
    const { job } = await requestGeneration(store, mom, H, chapter(1), clock);
    await runJob(store, new Provider(), job!.id, clock);
    const june = (await prepareView(store, mom, H, LONG, clock)).voices.find((v) => v.voiceId === "voice-june")!;
    expect(june.availability).toBe("partial");
    expect(june.chapters[0]!.readiness).toBe("ready");
    expect(june.chapters.slice(1).every((c) => c.readiness === "not_prepared")).toBe(true);
    // Kids see the same: audio only where it exists.
    const kids = (await kidsReadiness(store, maya, "maya", LONG)).find((r) => r.voiceId === "voice-june")!;
    expect(kids.readiness).toBe("partial");
    expect(kids.readySentenceIds).toEqual(long.chapters[0]!.sentenceIds);
    // It isn't Ready, and isn't in "Already prepared" as if it were whole; it is in the library.
    const lib = await familyLibrary(store, mom, H);
    expect(lib.all.find((b) => b.slug === LONG)!.narrators.find((n) => n.voiceId === "voice-june")!.availability).toBe("partial");
  });

  it("reserved credits can't be spent twice", async () => {
    const { state, store, plan } = family(1);
    const c1 = quote(state, plan, H, chapter(1)).credits;
    const c2 = quote(state, plan, H, chapter(2)).credits;
    await grantPromoCredits(store, H, c1 - balance(state, plan) + 5, 30, "Promo", clock);
    // Enough for chapter 1 only.
    expect(balance(state, plan)).toBeGreaterThanOrEqual(c1);
    expect(balance(state, plan)).toBeLessThan(c1 + c2);
    const results = await Promise.allSettled([requestGeneration(store, mom, H, chapter(1), clock), requestGeneration(store, mom, H, chapter(1), clock)]);
    expect(state.jobs).toHaveLength(1);
    expect(results.filter((r) => r.status === "fulfilled" && r.value.job).length).toBe(1);
    // Chapter 2 doesn't fit in what's left while chapter 1's credits are held.
    await rejects(requestGeneration(store, mom, H, chapter(2), clock), 402, "not_enough_credits");
    const reserved = state.ledger.filter((e) => e.kind === "reserve").reduce((n, e) => n + e.credits, 0);
    expect(reserved).toBe(c1);
    expect(creditBalance(state, plan, H, iso()).held).toBe(c1);
  });

  it("a failed chapter never erases chapters already prepared, and its credits come back", async () => {
    const { state, store, plan } = family(10);
    const one = await requestGeneration(store, mom, H, chapter(1), clock);
    await runJob(store, new Provider(), one.job!.id, clock);
    const before = balance(state, plan);
    const failing = new Provider((t) => long.chapters[1]!.sentenceIds.some((id) => long.sentences.find((s) => s.id === id)!.text === t));
    const two = await requestGeneration(store, mom, H, chapter(2), clock);
    const done = await runJob(store, failing, two.job!.id, clock);
    expect(done.status).toBe("failed");
    const june = (await prepareView(store, mom, H, LONG, clock)).voices.find((v) => v.voiceId === "voice-june")!;
    expect(june.chapters[0]!.readiness).toBe("ready");
    expect(june.chapters[1]!.readiness).toBe("not_prepared");
    expect(balance(state, plan)).toBe(before);
  });

  it("one child's browsing or listening never changes the household balance", async () => {
    const { state, store, plan } = family(30);
    const { job } = await requestGeneration(store, mom, H, { voiceId: "voice-june", bookSlug: SHORT, scope: "book" }, clock);
    await runJob(store, new Provider(), job!.id, clock);
    const before = { balance: balance(state, plan), ledger: state.ledger.length };
    for (const slug of [SHORT, LONG, "winnie-the-pooh"]) await kidsReadiness(store, maya, "maya", slug);
    await startListening(store, maya, "maya", clock);
    for (let i = 0; i < 3; i++) await authorizePlayback(store, maya, { childId: "maya", voiceId: "voice-june", bookSlug: SHORT, sentence: i }, "k", clock);
    await rejects(authorizePlayback(store, maya, { childId: "maya", voiceId: "voice-june", bookSlug: LONG, sentence: 0 }, "k", clock), 409, "not_prepared");
    await kidsReadiness(store, leo, "leo", SHORT);
    expect(balance(state, plan)).toBe(before.balance);
    expect(state.ledger.length).toBe(before.ledger);
    expect(state.jobs).toHaveLength(1);
  });
});

describe("credit lots", () => {
  it("track monthly, promotional and purchased credits separately in exact characters, honoring expiry and rollover", async () => {
    const { state, store, plan } = family(1, { subscriptionRolloverMonths: 0 });
    await grantPromoCredits(store, H, 2, 7, "Promo", clock);
    const b = creditBalance(state, plan, H, iso());
    expect(b.bySource).toEqual({ subscription: 1000, trial: 0, promotional: 2000, purchased: 0 });
    // The billing month runs from the plan's start (Oct 1, 12:00), annual or monthly alike.
    expect(b.renewsAt).toBe("2026-11-01T12:00:00.000Z");
    // Included credits are spent before promotional and purchased ones.
    expect(spendableLots(state, plan, H, iso()).map((l) => l.lot.source)).toEqual(["subscription", "promotional"]);
    // After expiry, promotional credits are gone; next month brings a fresh allowance, with no rollover.
    expect(creditBalance(state, plan, H, "2026-10-20T00:00:00.000Z").bySource.promotional).toBe(0);
    state.ledger.push({ id: "used", householdId: H, lotId: includedLotId(state, H, iso())!, kind: "reserve", credits: 834, jobId: null, sentenceId: null, at: iso() });
    expect(creditBalance(state, plan, H, iso()).bySource.subscription).toBe(166);
    expect(creditBalance(state, plan, H, "2026-11-02T00:00:00.000Z").bySource.subscription).toBe(1000);
    const rolling = { ...plan, subscriptionRolloverMonths: 1 };
    expect(creditBalance(state, rolling, H, "2026-11-02T00:00:00.000Z").bySource.subscription).toBe(1000 + 166);
  });

  it("annual plans refresh 40 credits each month instead of all at once", async () => {
    const { state, store, plan } = family(40, { welcomePromoCredits: 0 });
    state.households.push({ id: "yr", name: "Annual family" });
    tick = Date.parse("2027-01-31T09:00:00Z");
    await grantEntitlement(store, "yr", { source: "subscription", months: 12 }, clock);
    expect(creditBalance(state, plan, "yr", iso()).available).toBe(40_000);
    // Jan 31 renews on the last day of February, then on the 31st again when there is one.
    expect(creditBalance(state, plan, "yr", iso()).renewsAt?.slice(0, 10)).toBe("2027-02-28");
    expect(creditBalance(state, plan, "yr", "2027-03-31T10:00:00.000Z").renewsAt?.slice(0, 10)).toBe("2027-04-30");
    expect(creditBalance(state, plan, "yr", "2027-07-15T00:00:00.000Z").available).toBe(40_000);
    tick = Date.parse("2026-10-10T00:00:00Z");
  });

  it("a new household gets welcome credits once when configured; the allowance is per household, not per child", async () => {
    const { state, store, plan } = family(30, { welcomePromoCredits: 5 });
    state.households.push({ id: "h2", name: "New family" });
    await grantEntitlement(store, "h2", { source: "subscription", months: null }, clock);
    await grantEntitlement(store, "h2", { source: "gift", months: 1 }, clock);
    const lots = state.creditLots.filter((l) => l.householdId === "h2");
    expect(lots).toHaveLength(1);
    expect(lots[0]).toMatchObject({ source: "promotional", credits: 5000 });
    expect(creditBalance(state, plan, H, iso()).allowance).toBe(30_000);
  });

  it("the library keeps every book and leads with short stories", async () => {
    const { store, plan } = family(1);
    const lib = await familyLibrary(store, mom, H);
    expect(lib.all.map((b) => b.slug)).toContain(LONG);
    expect(lib.all[lib.all.length - 1]!.slug).toBe("alices-adventures-in-wonderland");
    const shelf = (id: string) => lib.collections.find((c) => c.id === id)!.books.map((b) => b.slug);
    expect(shelf("longer")).toEqual(expect.arrayContaining([LONG, "winnie-the-pooh", "alices-adventures-in-wonderland"]));
    expect(shelf("quick")).not.toContain(LONG);
    expect(shelf("fits")).not.toContain(LONG);
    expect(shelf("bedtime")).toEqual(plan.bedtimeFavorites);
    expect(lib.recommended.map((b) => b.slug)).toEqual(plan.recommendedShortStories);
  });
});

describe("provider cost", () => {
  it("charges exact characters and records model, characters, provider credits, cost and retries per household", async () => {
    const { state, store, plan } = family(40);
    const failedOnce = new Set<string>();
    const provider = new Provider((text) => (failedOnce.has(text) ? false : (failedOnce.add(text), true)));
    const before = balance(state, plan);
    const { job, quote: q } = await requestGeneration(store, mom, H, { voiceId: "voice-june", bookSlug: SHORT, scope: "book" }, clock);
    await runJob(store, provider, job!.id, clock);
    const characters = q.sentenceIds.reduce((n, id) => n + bookText(SHORT)!.sentences.find((x) => x.id === id)!.text.length, 0);
    expect(q.credits).toBe(characters);
    expect(balance(state, plan)).toBe(before - characters);
    const usage = state.usage.filter((u) => u.jobId === job!.id);
    expect(usage.reduce((n, u) => n + u.characters, 0)).toBe(characters);
    expect(usage.every((u) => u.householdId === H && u.modelId === plan.narrationModelId && u.attempts === 2)).toBe(true);
    expect(usage.reduce((n, u) => n + u.usd, 0)).toBeCloseTo((characters / 1000) * 0.1, 6);
  });
});

describe("free trial", () => {
  it("a trial household gets the trial allowance once for the whole trial, not the monthly one", async () => {
    const { state, store, plan } = family(30, { trialCredits: 10, welcomePromoCredits: 0 });
    state.households.push({ id: "t1", name: "Trial family" });
    await grantEntitlement(store, "t1", { source: "trial", months: null, days: 14 }, clock);
    const b = creditBalance(state, plan, "t1", iso());
    expect(b.bySource).toMatchObject({ trial: 10_000, subscription: 0 });
    expect(b.renewsAt).toBeNull();
    const later = new Date(tick + 20 * 86_400_000).toISOString();
    expect(creditBalance(state, plan, "t1", later).available).toBe(0);
  });
});

describe("public library", () => {
  it("lists every book shortest first, then coming soon, and searches title and author", async () => {
    const { publicLibrary } = await import("./public");
    const { matchesSearch } = await import("./search");
    const books = publicLibrary();
    const ready = books.filter((b) => !b.comingSoon);
    expect(ready.map((b) => b.minutes)).toEqual([...ready.map((b) => b.minutes)].sort((a, b) => a - b));
    const firstSoon = books.findIndex((b) => b.comingSoon);
    if (firstSoon >= 0) expect(books.slice(firstSoon).every((b) => b.comingSoon)).toBe(true);
    expect(books.filter((b) => matchesSearch(b, "rabbit")).map((b) => b.slug)).toEqual(
      expect.arrayContaining(["the-tale-of-peter-rabbit", "the-velveteen-rabbit"]),
    );
    expect(books.filter((b) => matchesSearch(b, "ANDERSEN duckling")).map((b) => b.slug)).toEqual(["the-ugly-duckling"]);
  });
});
