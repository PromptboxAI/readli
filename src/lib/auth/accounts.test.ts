import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { AccountFamilyStore } from "@/lib/family/account-store";
import { AccountNarrationProvider } from "@/lib/narration/account-provider";
import { creditBalance } from "@/lib/narration/credits";
import { authorizePlayback, kidsReadiness, readPlayback, requestGeneration, runPendingJobs } from "@/lib/narration/narration";
import { MemoryNarrationStorage } from "@/lib/narration/storage";
import type { AccountVoiceDeps } from "@/lib/voice/account-voices";
import { toneWav } from "@/lib/voice/stub";
import { DEFAULT_PLAN } from "@/lib/family/plan";
import {
  activateNarrator,
  createChildProfile,
  createHousehold,
  grantEntitlement,
  myVoices,
  narratorsFor,
  releaseNarrator,
  saveChildProgress,
  setChildApprovals,
  setFavorite,
  setHouseholdShare,
  startListening,
} from "@/lib/family/service";
import { decodeKidsProfile, encodeKidsProfile } from "@/lib/family/session";
import { displayName, safeNext } from "./supabase";

type Row = Record<string, unknown>;

/** Just enough of the Supabase query builder to check what the account store saves. */
function fakeDb(tables: Record<string, Row[]> = {}) {
  const t = (name: string) => (tables[name] ??= []);
  const builder = (name: string) => {
    let filters: [string, unknown, "eq" | "in" | "gte" | "free"][] = [];
    let op: { kind: "select" } | { kind: "update"; values: Row } | { kind: "delete" } = { kind: "select" };
    const match = (r: Row) =>
      filters.every(([k, v, how]) =>
        how === "eq"
          ? (r[k] ?? null) === v
          : how === "gte"
            ? String(r[k]) >= String(v)
            : how === "free"
              ? !r[k] || String(r[k]) < new Date().toISOString()
              : (v as unknown[]).includes(r[k]),
      );
    const run = () => {
      const hit = t(name).filter(match);
      if (op.kind === "update") for (const r of hit) Object.assign(r, op.values);
      if (op.kind === "update") return { data: hit.map((r) => ({ ...r })), error: null };
      if (op.kind === "delete") tables[name] = t(name).filter((r) => !match(r));
      return { data: op.kind === "select" ? t(name).filter(match).map((r) => ({ ...r })) : null, error: null };
    };
    const q = {
      select: () => q,
      eq: (k: string, v: unknown) => ((filters = [...filters, [k, v, "eq"]]), q),
      in: (k: string, v: unknown[]) => ((filters = [...filters, [k, v, "in"]]), q),
      is: (k: string, v: unknown) => ((filters = [...filters, [k, v, "eq"]]), q),
      gte: (k: string, v: unknown) => ((filters = [...filters, [k, v, "gte"]]), q),
      // Only the job lease uses or(); a lease is free unless it ends in the future.
      or: () => ((filters = [...filters, ["lease_until", null, "free"]]), q),
      update: (values: Row) => ((op = { kind: "update", values }), q),
      delete: () => ((op = { kind: "delete" }), q),
      insert: (rows: Row | Row[]) => {
        for (const r of [rows].flat()) t(name).push({ removed_at: null, deleted_at: null, ...r });
        return Promise.resolve({ data: null, error: null });
      },
      upsert: (rows: Row | Row[], opts: { onConflict: string; ignoreDuplicates?: boolean }) => {
        const keys = opts.onConflict.split(",");
        for (const r of [rows].flat()) {
          const old = t(name).find((x) => keys.every((k) => x[k] === r[k]));
          if (old && !opts.ignoreDuplicates) Object.assign(old, r);
          if (!old) t(name).push({ removed_at: null, ...r });
        }
        return Promise.resolve({ data: null, error: null });
      },
      then: (resolve: (v: unknown) => void) => resolve(run()),
    };
    return q;
  };
  return { db: { from: builder } as unknown as SupabaseClient, tables };
}

const ME = { id: "11111111-1111-4111-8111-111111111111", name: "Sara" };
const ADULT = { kind: "adult" as const, adultId: ME.id };

describe("real family accounts", () => {
  it("saves a new family, its plan, a kids profile and a favourite, and reads them back", async () => {
    const { db, tables } = fakeDb();
    const store = new AccountFamilyStore(db, ME, DEFAULT_PLAN);
    const home = await createHousehold(store, ADULT, "The Rivera family");
    expect(tables.adult_profiles).toEqual([{ removed_at: null, user_id: ME.id, display_name: "Sara" }]);
    expect(tables.households).toMatchObject([{ id: home, name: "The Rivera family", created_by: ME.id }]);
    expect(tables.household_members).toMatchObject([{ household_id: home, user_id: ME.id, role: "guardian" }]);

    await expect(createChildProfile(store, ADULT, home, "Maya")).rejects.toMatchObject({ code: "no_family_plan" });
    await grantEntitlement(store, home, { source: "gift", months: 12 });
    const maya = await createChildProfile(store, ADULT, home, "Maya");
    expect(tables.child_profiles).toMatchObject([{ id: maya, household_id: home, nickname: "Maya" }]);
    expect(tables.child_guardians).toMatchObject([{ child_id: maya, user_id: ME.id, removed_at: null }]);
    await setFavorite(store, { kind: "child", childId: maya }, maya, "peter-rabbit", true);
    expect(tables.child_favorites).toMatchObject([{ child_id: maya, book_slug: "peter-rabbit" }]);

    const again = await new AccountFamilyStore(db, ME, DEFAULT_PLAN).read();
    expect(again.households).toEqual([{ id: home, name: "The Rivera family" }]);
    expect(again.children.map((c) => [c.nickname, c.guardianIds])).toEqual([["Maya", [ME.id]]]);
    expect(again.favorites).toEqual([{ childId: maya, bookSlug: "peter-rabbit" }]);
    expect(again.entitlements).toHaveLength(1);
  });

  it("saves a shared family voice, its narrator slot and a child's approval, and reads them back", async () => {
    const GRAN = { id: "33333333-3333-4333-8333-333333333333", name: "Gran" };
    const VOICE = "44444444-4444-4444-8444-444444444444";
    const { db, tables } = fakeDb({
      voice_profiles: [{ id: VOICE, owner_id: GRAN.id, display_name: "Gran", version: 2, status: "ready", created_at: "2026-10-01T00:00:00Z", deleted_at: null }],
    });
    const store = new AccountFamilyStore(db, ME, DEFAULT_PLAN);
    const home = await createHousehold(store, ADULT, "The Rivera family");
    await grantEntitlement(store, home, { source: "gift", months: 12 });
    const maya = await createChildProfile(store, ADULT, home, "Maya");
    tables.household_members!.push({ household_id: home, user_id: GRAN.id, role: "member", joined_at: "2026-10-02T00:00:00Z", removed_at: null });
    tables.adult_profiles!.push({ user_id: GRAN.id, display_name: "Gran" });

    const gran = { kind: "adult" as const, adultId: GRAN.id };
    const granStore = new AccountFamilyStore(db, GRAN, DEFAULT_PLAN);
    expect((await myVoices(granStore, gran))[0]).toMatchObject({ voiceId: VOICE, households: [{ id: home, shared: false }] });
    await setHouseholdShare(granStore, gran, { voiceId: VOICE, householdId: home, shared: true, policyVersion: "v1" });
    expect(tables.voice_household_shares).toMatchObject([{ voice_id: VOICE, household_id: home, granted_by: GRAN.id, revoked_at: null }]);

    const parent = new AccountFamilyStore(db, ME, DEFAULT_PLAN);
    await activateNarrator(parent, ADULT, home, VOICE);
    await setChildApprovals(parent, ADULT, maya, [{ voiceId: VOICE, approved: true }]);
    await startListening(parent, { kind: "child", childId: maya }, maya);
    await saveChildProgress(parent, { kind: "child", childId: maya }, { childId: maya, bookSlug: "peter-rabbit", sentence: 4, voiceId: VOICE });
    expect(tables.narrator_slot_assignments).toMatchObject([{ household_id: home, voice_id: VOICE, activated_by: ME.id, released_at: null }]);
    expect(tables.child_voice_approvals).toMatchObject([{ voice_id: VOICE, child_id: maya, approved_by: ME.id, revoked_at: null }]);
    expect(tables.listening_sessions).toMatchObject([{ household_id: home, child_id: maya, ended_at: null }]);
    expect(tables.child_book_progress).toMatchObject([{ child_id: maya, voice_id: VOICE, sentence: 4 }]);
    expect(tables.permission_audit_log!.map((e) => e.action)).toEqual(
      expect.arrayContaining(["voice_shared", "narrator_activated", "child_voice_approved", "child_profile_created", "entitlement_granted"]),
    );
    expect(tables.voice_profiles).toHaveLength(1);

    const fresh = new AccountFamilyStore(db, ME, DEFAULT_PLAN);
    expect((await fresh.read()).voices).toMatchObject([{ id: VOICE, ownerId: GRAN.id, version: 2, status: "ready" }]);
    expect(await narratorsFor(fresh, { kind: "child", childId: maya }, maya)).toMatchObject([{ voiceId: VOICE, name: "Gran" }]);

    await releaseNarrator(fresh, ADULT, home, VOICE);
    expect(tables.narrator_slot_assignments![0]).toMatchObject({ released_by: ME.id });
    expect(tables.child_voice_approvals![0]).toMatchObject({ revoke_reason: "slot_released" });
    const afterRelease = await new AccountFamilyStore(db, ME, DEFAULT_PLAN).read();
    expect(afterRelease.audit.map((e) => e.action)).toEqual(["narrator_released"]);
    expect(await narratorsFor(new AccountFamilyStore(db, ME, DEFAULT_PLAN), { kind: "child", childId: maya }, maya)).toEqual([]);

    await setHouseholdShare(new AccountFamilyStore(db, GRAN, DEFAULT_PLAN), gran, { voiceId: VOICE, householdId: home, shared: false, policyVersion: "v1" });
    expect(tables.voice_household_shares![0]).toMatchObject({ revoked_by: GRAN.id });
    expect(tables.voice_household_shares![0]!.revoked_at).not.toBeNull();
  });

  it("prepares a book in the storyteller's real voice, saves it with the credits it used, and plays it to an approved child", async () => {
    const GRAN = { id: "33333333-3333-4333-8333-333333333333", name: "Gran" };
    const VOICE = "44444444-4444-4444-8444-444444444444";
    const { db, tables } = fakeDb({
      voice_profiles: [{ id: VOICE, owner_id: GRAN.id, display_name: "Gran", version: 1, status: "ready", created_at: "2026-10-01T00:00:00Z", deleted_at: null }],
    });
    const audio = new MemoryNarrationStorage();
    const store = new AccountFamilyStore(db, ME, DEFAULT_PLAN, audio);
    const home = await createHousehold(store, ADULT, "The Rivera family");
    await grantEntitlement(store, home, { source: "subscription", months: null });
    const maya = await createChildProfile(store, ADULT, home, "Maya");
    tables.household_members!.push({ household_id: home, user_id: GRAN.id, role: "member", joined_at: "2026-10-02T00:00:00Z", removed_at: null });
    tables.adult_profiles!.push({ user_id: GRAN.id, display_name: "Gran" });
    const gran = { kind: "adult" as const, adultId: GRAN.id };
    await setHouseholdShare(new AccountFamilyStore(db, GRAN, DEFAULT_PLAN, audio), gran, { voiceId: VOICE, householdId: home, shared: true, policyVersion: "v1" });
    const parent = new AccountFamilyStore(db, ME, DEFAULT_PLAN, audio);
    await activateNarrator(parent, ADULT, home, VOICE);
    await setChildApprovals(parent, ADULT, maya, [{ voiceId: VOICE, approved: true }]);

    const asked: string[] = [];
    const deps = {
      store: { providerVoiceId: async (id: string) => (id === VOICE ? "eleven-gran" : null) },
      provider: {
        synthesize: async ({ voiceId }: { voiceId: string }) => (asked.push(voiceId), { audio: toneWav(1), contentType: "audio/wav", standIn: false }),
      },
    } as unknown as AccountVoiceDeps;
    const book = { voiceId: VOICE, bookSlug: "the-lion-and-the-mouse", scope: "book" as const };
    const { job, quote } = await requestGeneration(new AccountFamilyStore(db, ME, DEFAULT_PLAN, audio), ADULT, home, book);
    expect(tables.narration_jobs).toMatchObject([{ id: job!.id, household_id: home, status: "queued" }]);
    expect(tables.narration_credit_ledger!.filter((e) => e.kind === "reserve").reduce((n, e) => n + Number(e.credits), 0)).toBe(quote.credits);

    // A fresh worker (as on the next request) picks the job up, leased so no one else runs it too.
    const worker = new AccountFamilyStore(db, ME, DEFAULT_PLAN, audio);
    await runPendingJobs(worker, new AccountNarrationProvider(deps), { householdId: home, budgetMs: 60_000 });
    expect(new Set(asked)).toEqual(new Set(["eleven-gran"]));
    expect(tables.narration_jobs![0]).toMatchObject({ status: "done", lease_until: null });
    expect(tables.narration_segments!.every((x) => x.status === "ready" && x.storage_key)).toBe(true);
    expect(tables.narration_provider_usage!.reduce((n, u) => n + Number(u.characters), 0)).toBe(quote.credits);
    expect(tables.narration_provider_usage!.every((u) => u.household_id === home && u.job_id === job!.id)).toBe(true);
    expect(tables.family_notifications!.at(-1)!.text).toContain("is ready");

    const again = new AccountFamilyStore(db, ME, DEFAULT_PLAN, audio);
    const state = await again.read();
    expect(creditBalance(state, DEFAULT_PLAN, home).available).toBe(DEFAULT_PLAN.monthlyCredits * DEFAULT_PLAN.charactersPerCredit - quote.credits);
    const kid = { kind: "child" as const, childId: maya };
    const [ready] = await kidsReadiness(again, kid, maya, "the-lion-and-the-mouse");
    expect(ready).toMatchObject({ voiceId: VOICE, readiness: "ready" });
    await startListening(again, kid, maya);
    const { url } = await authorizePlayback(again, kid, { childId: maya, bookSlug: "the-lion-and-the-mouse", voiceId: VOICE, sentence: 0 }, "k");
    const token = url.split("/").pop()!;
    expect((await readPlayback(new AccountFamilyStore(db, ME, DEFAULT_PLAN, audio), kid, token, "k")).contentType).toBe("audio/wav");
    expect(tables.narration_plays).toHaveLength(1);
  });

  it("a second family request returns the grown-up's existing family", async () => {
    const { db, tables } = fakeDb();
    const store = new AccountFamilyStore(db, ME, DEFAULT_PLAN);
    const first = await createHousehold(store, ADULT, "Ours");
    expect(await createHousehold(store, ADULT, "Another")).toBe(first);
    expect(tables.households).toHaveLength(1);
  });

  it("another grown-up sees none of this family", async () => {
    const { db } = fakeDb();
    await createHousehold(new AccountFamilyStore(db, ME, DEFAULT_PLAN), ADULT, "Ours");
    const other = await new AccountFamilyStore(db, { id: "22222222-2222-4222-8222-222222222222", name: "Stranger" }, DEFAULT_PLAN).read();
    expect(other.households).toEqual([]);
    expect(other.members).toEqual([]);
  });

  it("a kids profile cookie only works for the grown-up who opened it", () => {
    const value = encodeKidsProfile(ME.id, "kid-1", "k");
    expect(decodeKidsProfile(value, ME.id, "k")).toBe("kid-1");
    expect(decodeKidsProfile(value, "someone-else", "k")).toBeNull();
    expect(decodeKidsProfile(value.replace("kid-1", "kid-2"), ME.id, "k")).toBeNull();
  });

  it("sign-in only continues to same-site pages", () => {
    expect(safeNext("/family/books")).toBe("/family/books");
    expect(safeNext("https://evil.example")).toBe("/family");
    expect(safeNext("//evil.example")).toBe("/family");
    expect(safeNext("/\\evil.example")).toBe("/family");
    expect(safeNext(null)).toBe("/family");
  });

  it("names a new grown-up from Google, their sign-up name or their email", () => {
    expect(displayName({ email: "sara@example.com", user_metadata: { full_name: "Sara Rivera" } })).toBe("Sara Rivera");
    expect(displayName({ email: "sara@example.com", user_metadata: {} })).toBe("sara");
  });
});
