import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { ProviderRefCipher } from "@/lib/server/provider-ref";
import type { VoiceProvider } from "@/lib/voice/provider";
import { AccountError, deleteAccount, deletionBlockers, exportAccountData, updateDisplayName } from "./privacy";

type Row = Record<string, unknown>;

/** Just enough of the Supabase client for the account's own reads, writes, storage and sign-in. */
function fakeDb(tables: Record<string, Row[]>, files: Record<string, string[]> = {}) {
  const removed: Record<string, string[]> = {};
  const auth = { deleted: [] as string[], metadata: {} as Record<string, unknown> };
  const t = (name: string) => (tables[name] ??= []);
  const from = (name: string) => {
    const filters: ((r: Row) => boolean)[] = [];
    let op: { kind: "select" } | { kind: "update"; values: Row } | { kind: "delete" } = { kind: "select" };
    const result = () => {
      const hit = t(name).filter((r) => filters.every((f) => f(r)));
      if (op.kind === "update") for (const r of hit) Object.assign(r, op.values);
      if (op.kind === "delete") tables[name] = t(name).filter((r) => !hit.includes(r));
      return { data: op.kind === "select" ? hit.map((r) => ({ ...r })) : null, error: null };
    };
    const q = {
      select: () => q,
      eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), q),
      in: (k: string, v: unknown[]) => (filters.push((r) => v.includes(r[k])), q),
      is: (k: string, v: unknown) => (filters.push((r) => (r[k] ?? null) === v), q),
      update: (values: Row) => ((op = { kind: "update", values }), q),
      delete: () => ((op = { kind: "delete" }), q),
      upsert: (row: Row, opts: { onConflict: string }) => {
        const old = t(name).find((x) => x[opts.onConflict] === row[opts.onConflict]);
        if (old) Object.assign(old, row);
        else t(name).push({ ...row });
        return Promise.resolve({ data: null, error: null });
      },
      then: (resolve: (v: unknown) => void) => resolve(result()),
    };
    return q;
  };
  const db = {
    from,
    storage: {
      from: (bucket: string) => ({
        remove: async (keys: string[]) => ((removed[bucket] ??= []).push(...keys), { data: [], error: null }),
        list: async (folder: string) => ({
          data: (files[bucket] ?? []).filter((k) => k.startsWith(`${folder}/`)).map((k) => ({ id: k, name: k.slice(folder.length + 1) })),
          error: null,
        }),
      }),
    },
    auth: {
      admin: {
        deleteUser: async (id: string) => (auth.deleted.push(id), { data: {}, error: null }),
        updateUserById: async (id: string, attrs: { user_metadata: Row }) => ((auth.metadata[id] = attrs.user_metadata), { data: {}, error: null }),
      },
    },
  } as unknown as SupabaseClient;
  return { db, tables, removed, auth };
}

const ME = "11111111-1111-4111-8111-111111111111";
const PARTNER = "22222222-2222-4222-8222-222222222222";
const refs = new ProviderRefCipher("test-secret");

function recordingProvider() {
  const deleted: string[] = [];
  const provider = { deleteVoice: async (id: string) => void deleted.push(id) } as unknown as VoiceProvider;
  return { provider, deleted };
}

/** Sara's account: her own family with one kid, a cloned voice with narration, and her recordings. */
function sarasData(extra: Partial<Record<string, Row[]>> = {}): Record<string, Row[]> {
  return {
    adult_profiles: [{ user_id: ME, display_name: "Sara" }],
    households: [{ id: "home", name: "The Rivera family" }],
    household_members: [{ household_id: "home", user_id: ME, role: "guardian", removed_at: null }],
    child_profiles: [{ id: "maya", household_id: "home", nickname: "Maya", deleted_at: null }],
    child_guardians: [{ child_id: "maya", user_id: ME, removed_at: null }],
    voice_profiles: [{ id: "v1", owner_id: ME, display_name: "Mom", provider_voice_id_encrypted: refs.encrypt("eleven-123"), status: "ready" }],
    narration_libraries: [{ key: "lib1", voice_id: "v1" }],
    narration_segments: [
      { library_key: "lib1", sentence_id: "s1", storage_key: "lib1/s1.mp3" },
      { library_key: "lib1", sentence_id: "s2", storage_key: null },
    ],
    narration_assets: [{ voice_id: "v1", storage_key: "old/a.mp3" }],
    voice_training_sessions: [{ id: "rec1", owner_id: ME }],
    voice_training_segments: [{ session_id: "rec1", storage_key: "rec1/0.webm" }],
    child_voice_approvals: [],
    gifts: [],
    gift_plans: [{ id: "sponsored_monthly", kind: "recurring" }],
    ...extra,
  };
}

describe("deleting an account", () => {
  it("removes the voice from the provider, then the audio, the family and the sign-in", async () => {
    const files = { "voice-recordings": [`${ME}/take.webm`, `${ME}/failed-clone.webm`, `${PARTNER}/theirs.webm`] };
    const { db, tables, removed, auth } = fakeDb(sarasData({ voice_training_segments: [{ session_id: "rec1", storage_key: `${ME}/take.webm` }] }), files);
    const { provider, deleted } = recordingProvider();
    const result = await deleteAccount({ db, provider, refs }, ME);

    expect(result).toEqual({ deleted: true, blockers: [], voicesRemoved: 1, audioFilesRemoved: 4 });
    expect(deleted).toEqual(["eleven-123"]);
    expect(removed).toEqual({
      narrations: ["lib1/s1.mp3"],
      "generated-audio": ["old/a.mp3"],
      "voice-recordings": [`${ME}/take.webm`, `${ME}/failed-clone.webm`],
    });
    expect(tables.households).toEqual([]);
    expect(auth.deleted).toEqual([ME]);
  });

  it("won't leave a shared family's kids without a guardian, and deletes nothing", async () => {
    const data = sarasData({
      household_members: [
        { household_id: "home", user_id: ME, role: "guardian", removed_at: null },
        { household_id: "home", user_id: PARTNER, role: "member", removed_at: null },
      ],
    });
    const { db, removed, auth } = fakeDb(data);
    const { provider, deleted } = recordingProvider();
    const result = await deleteAccount({ db, provider, refs }, ME);

    expect(result.deleted).toBe(false);
    expect(result.blockers).toEqual([{ kind: "only_guardian", householdId: "home", householdName: "The Rivera family" }]);
    expect(deleted).toEqual([]);
    expect(removed).toEqual({});
    expect(auth.deleted).toEqual([]);
  });

  it("asks to stop a monthly gift first", async () => {
    const { db } = fakeDb(
      sarasData({ gifts: [{ id: "g1", giver_id: ME, plan_id: "sponsored_monthly", recipient_name: "Grandma", status: "active", renewals_stopped: false }] }),
    );
    expect(await deletionBlockers(db, ME)).toEqual([{ kind: "sponsoring", giftId: "g1", recipientName: "Grandma" }]);
  });

  it("leaves a shared family to the other guardian and ends the approvals it gave", async () => {
    const data = sarasData({
      household_members: [
        { household_id: "home", user_id: ME, role: "guardian", removed_at: null },
        { household_id: "home", user_id: PARTNER, role: "guardian", removed_at: null },
      ],
      child_guardians: [
        { child_id: "maya", user_id: ME, removed_at: null },
        { child_id: "maya", user_id: PARTNER, removed_at: null },
      ],
      child_voice_approvals: [
        { id: "a1", voice_id: "grandpa", child_id: "maya", approved_by: ME, revoked_at: null },
        { id: "a2", voice_id: "grandma", child_id: "maya", approved_by: PARTNER, revoked_at: null },
      ],
    });
    const { db, tables, auth } = fakeDb(data);
    const result = await deleteAccount({ db, ...recordingProvider(), refs }, ME);

    expect(result.deleted).toBe(true);
    expect(tables.households).toHaveLength(1);
    expect(tables.child_voice_approvals.find((a) => a.id === "a1")).toMatchObject({ revoke_reason: "guardian_removed" });
    expect(tables.child_voice_approvals.find((a) => a.id === "a2")).toMatchObject({ revoked_at: null });
    expect(auth.deleted).toEqual([ME]);
  });

  it("stops before touching anything when the voice service isn't configured", async () => {
    const { db, removed, auth } = fakeDb(sarasData());
    await expect(deleteAccount({ db, provider: null, refs }, ME)).rejects.toBeInstanceOf(AccountError);
    expect(removed).toEqual({});
    expect(auth.deleted).toEqual([]);
  });

  it("stops when the provider can't delete the voice, so it can be retried", async () => {
    const { db, removed, auth, tables } = fakeDb(sarasData());
    const provider = { deleteVoice: async () => Promise.reject(new Error("provider down")) } as unknown as VoiceProvider;
    await expect(deleteAccount({ db, provider, refs }, ME)).rejects.toThrow("provider down");
    expect(removed).toEqual({});
    expect(tables.households).toHaveLength(1);
    expect(auth.deleted).toEqual([]);
  });
});

describe("account name", () => {
  it("saves a tidied name to the profile and the sign-in", async () => {
    const { db, tables, auth } = fakeDb(sarasData());
    expect(await updateDisplayName(db, ME, "  Sara   Rivera ")).toBe("Sara Rivera");
    expect(tables.adult_profiles).toEqual([{ user_id: ME, display_name: "Sara Rivera" }]);
    expect(auth.metadata[ME]).toEqual({ full_name: "Sara Rivera" });
  });

  it("rejects an empty or very long name", async () => {
    const { db } = fakeDb(sarasData());
    await expect(updateDisplayName(db, ME, "   ")).rejects.toBeInstanceOf(AccountError);
    await expect(updateDisplayName(db, ME, "x".repeat(61))).rejects.toBeInstanceOf(AccountError);
  });
});

describe("downloading my data", () => {
  it("includes the account's own data and kids, and never the provider voice id", async () => {
    const data = sarasData({
      household_members: [
        { household_id: "home", user_id: ME, role: "guardian", relationship_label: "Mom", removed_at: null },
        { household_id: "home", user_id: PARTNER, role: "guardian", relationship_label: "Dad", removed_at: null },
      ],
      adult_profiles: [
        { user_id: ME, display_name: "Sara" },
        { user_id: PARTNER, display_name: "Leo" },
      ],
      child_favorites: [{ child_id: "maya", book_slug: "peter-rabbit" }],
      voice_household_shares: [{ voice_id: "v1", household_id: "home", policy_version: "p1", granted_at: "2026-10-01", revoked_at: null }],
    });
    const { db } = fakeDb(data);
    const out = await exportAccountData(db, { id: ME, email: "sara@example.com", name: "Sara" });
    const text = JSON.stringify(out);

    expect(out.account).toMatchObject({ email: "sara@example.com", display_name: "Sara" });
    expect(out.families).toEqual([{ family: "The Rivera family", role: "guardian", relationship_label: "Mom", joined_at: null, removed_at: null }]);
    expect(out.kidsYouLookAfter[0]).toMatchObject({ nickname: "Maya", favourites: [{ book_slug: "peter-rabbit", created_at: null }] });
    expect(out.voices[0]!.sharedWith).toEqual([{ family: "The Rivera family", policy_version: "p1", granted_at: "2026-10-01", revoked_at: null }]);
    expect(text).not.toContain("provider_voice_id_encrypted");
    expect(text).not.toContain("Leo");
  });
});
