import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { ProviderRefCipher } from "@/lib/server/provider-ref";
import type { VoiceProvider } from "@/lib/voice/provider";
import { fakeSupabase } from "@/lib/testing/fake-supabase";
import { AccountError, deleteAccount, deletionBlockers, exportAccountData, updateDisplayName } from "./privacy";

type Row = Record<string, unknown>;

function fakeDb(tables: Record<string, Row[]>, files: Record<string, string[]> = {}) {
  return fakeSupabase(tables, { files });
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
    narration_libraries: [
      { key: "lib1", voice_id: "v1", scope: "home" },
      { key: "lib-shared", voice_id: "v1", scope: "shared" },
    ],
    narration_segments: [
      { library_key: "lib1", sentence_id: "s1", storage_key: "lib1/s1.mp3" },
      { library_key: "lib1", sentence_id: "s2", storage_key: null },
      { library_key: "lib-shared", sentence_id: "s1", storage_key: "shared/s1.mp3" },
    ],
    narration_assets: [{ voice_id: "v1", child_id: "maya", storage_key: "old/a.mp3" }],
    household_entitlements: [{ household_id: "home", status: "canceled", ends_at: "2026-09-01T00:00:00Z", provider_subscription_ref: "sub_1" }],
    narration_credit_lots: [],
    voice_training_sessions: [{ id: "rec1", owner_id: ME }],
    voice_training_segments: [{ session_id: "rec1", storage_key: "rec1/0.webm" }],
    child_voice_approvals: [],
    gifts: [],
    gift_plans: [{ id: "sponsored_monthly", kind: "recurring" }],
    ...extra,
  };
}

describe("deleting an account", () => {
  it("retires the clone, withdraws the voice, deletes recordings and cleans their own family, but keeps stories other families have", async () => {
    const files = {
      "voice-recordings": [`${ME}/take.webm`, `${ME}/failed-clone.webm`, `${PARTNER}/theirs.webm`],
      "profile-photos": [`${ME}/me.jpg`, `${PARTNER}/them.jpg`],
    };
    const { db, tables, removed, auth, rpcs } = fakeDb(sarasData({ voice_training_segments: [{ session_id: "rec1", storage_key: `${ME}/take.webm` }] }), files);
    const { provider, deleted } = recordingProvider();
    const result = await deleteAccount({ db, provider, refs }, ME);

    expect(result).toEqual({ deleted: true, blockers: [], voicesRemoved: 1, audioFilesRemoved: 4 });
    expect(deleted).toEqual(["eleven-123"]);
    expect(removed).toEqual({
      "voice-recordings": [`${ME}/take.webm`, `${ME}/failed-clone.webm`],
      "profile-photos": [`${ME}/me.jpg`],
      narrations: ["lib1/s1.mp3"],
      "generated-audio": ["old/a.mp3"],
    });
    // The voice stays as a withdrawn record so the shared stories made in it keep playing elsewhere.
    expect(tables.voice_profiles![0]).toMatchObject({ status: "withdrawn", provider_voice_id_encrypted: null });
    expect(tables.voice_profiles![0]!.owner_deleted_at).toBeTruthy();
    expect(tables.narration_segments!.map((x) => x.storage_key)).toEqual(["shared/s1.mp3"]);
    expect(rpcs.map((r) => r.name)).toEqual(["stop_voice_narration", "stop_household_narration"]);
    // The family record, its plan history and the audit trail stay; its kids profile goes.
    expect(tables.households).toHaveLength(1);
    expect(tables.households![0]!.cleaned_at).toBeTruthy();
    expect(tables.household_entitlements).toHaveLength(1);
    expect(tables.child_profiles).toEqual([]);
    expect(tables.voice_recording_deletions).toEqual([expect.objectContaining({ reason: "account_deletion", status: "completed", files_removed: 2 })]);
    expect(tables.lifecycle_audit_log!.map((x) => x.action)).toEqual(["account_deleted", "voice_withdrawn"]);
    expect(auth.deleted).toEqual([ME]);
  });

  it("doesn't wait for a renewing plan: it cancels it first and queues the unused paid time for a refund", async () => {
    const { db, tables, auth } = fakeDb(sarasData({ household_entitlements: [{ household_id: "home", status: "active", ends_at: null, provider_subscription_ref: "sub_1" }] }));
    expect(await deletionBlockers(db, ME)).toEqual([]);
    const cancelled: string[] = [];
    const billing = { cancel: async (ref: string) => (cancelled.push(ref), { customer: "cus_1" }), balance: async () => -1250 };
    const result = await deleteAccount({ db, ...recordingProvider(), refs, billing }, ME);
    expect(result.deleted).toBe(true);
    expect(cancelled).toEqual(["sub_1"]);
    expect(tables.lifecycle_exceptions).toEqual([expect.objectContaining({ kind: "billing_credit_refund", household_id: "home", detail: expect.objectContaining({ credit_cents: 1250 }) })]);
    expect(tables.lifecycle_audit_log![0]!.detail).toMatchObject({ plans_ended: [{ householdId: "home", subscription: "sub_1", creditCents: 1250 }] });
    expect(auth.deleted).toEqual([ME]);
  });

  it("deletes nothing if it can't reach billing to stop a renewing plan", async () => {
    const { db, auth, removed } = fakeDb(sarasData({ household_entitlements: [{ household_id: "home", status: "active", ends_at: null, provider_subscription_ref: "sub_1" }] }));
    const { provider, deleted } = recordingProvider();
    await expect(deleteAccount({ db, provider, refs, billing: null }, ME)).rejects.toMatchObject({ code: "billing_off" });
    expect(deleted).toEqual([]);
    expect(removed).toEqual({});
    expect(auth.deleted).toEqual([]);
  });

  it("keeps unspent purchased credits and sends them to the exception queue", async () => {
    const { db, tables } = fakeDb(
      sarasData({
        narration_credit_lots: [{ id: "lot1", household_id: "home", source: "purchased", credits: 20, granted_at: "2026-09-01T00:00:00Z", payment_ref: "pi_1" }],
        revenue_events: [{ provider_ref: "pi_1", kind: "credit_pack", amount_cents: 699 }],
        narration_credit_ledger: [{ household_id: "home", lot_id: "lot1", kind: "reserve", credits: 5 }],
      }),
    );
    await deleteAccount({ db, ...recordingProvider(), refs }, ME);
    expect(tables.narration_credit_lots).toHaveLength(1);
    expect(tables.lifecycle_exceptions).toEqual([expect.objectContaining({ kind: "purchased_credits_unreconciled", household_id: "home", detail: expect.objectContaining({ credits: 15, unused_value_cents: 524 }) })]);
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

  it("stops a monthly gift renewing instead of blocking; the recipient keeps the paid month", async () => {
    const { db, tables, auth } = fakeDb(
      sarasData({ gifts: [{ id: "g1", giver_id: ME, plan_id: "sponsored_monthly", recipient_name: "Grandma", status: "active", renewals_stopped: false }] }),
    );
    expect(await deletionBlockers(db, ME)).toEqual([]);
    await deleteAccount({ db, ...recordingProvider(), refs }, ME);
    expect(tables.gifts![0]).toMatchObject({ status: "active", renewals_stopped: true });
    expect(auth.deleted).toEqual([ME]);
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
    expect(tables.child_voice_approvals!.find((a) => a.id === "a1")).toMatchObject({ revoke_reason: "guardian_removed" });
    expect(tables.child_voice_approvals!.find((a) => a.id === "a2")).toMatchObject({ revoked_at: null });
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
