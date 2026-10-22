// @vitest-environment node
import { describe, expect, it } from "vitest";
import { DEFAULT_GENERATION_LIMITS as L } from "@/lib/family/plan";
import { spendPause } from "@/lib/narration/spend-guard";
import { fakeSupabase } from "@/lib/testing/fake-supabase";
import { cloneMayRemain } from "./recordings";

/** Kevin's answers of 2026-10-12: when a story voice may outlive its recordings, and the spending safeguard. */
describe("deleting original recordings (action A)", () => {
  const voice = { id: "v1", owner_id: "sara", status: "ready", provider_voice_id_encrypted: "enc" };

  it("keeps the story voice only while it's shared and the service permission is in force", async () => {
    const shared = fakeSupabase({ voice_profiles: [voice], voice_rights_current: [{ contributor_id: "sara", service_rights: true }], voice_household_shares: [{ id: "s1", voice_id: "v1", revoked_at: null }] });
    expect(await cloneMayRemain(shared.db, "sara")).toEqual({ voiceId: "v1", keep: true });

    const unshared = fakeSupabase({ voice_profiles: [voice], voice_rights_current: [{ contributor_id: "sara", service_rights: true }], voice_household_shares: [{ id: "s1", voice_id: "v1", revoked_at: "2026-10-01" }] });
    expect(await cloneMayRemain(unshared.db, "sara")).toEqual({ voiceId: "v1", keep: false });

    const withdrawn = fakeSupabase({ voice_profiles: [voice], voice_rights_current: [{ contributor_id: "sara", service_rights: false }], voice_household_shares: [{ id: "s1", voice_id: "v1", revoked_at: null }] });
    expect(await cloneMayRemain(withdrawn.db, "sara")).toEqual({ voiceId: "v1", keep: false });

    expect(await cloneMayRemain(fakeSupabase().db, "sara")).toEqual({ voiceId: null, keep: false });
  });
});

describe("the daily spending safeguard", () => {
  const at = (usd: number, characters: number) => fakeSupabase({}, { rpc: { narration_spend_since: () => [{ usd, characters }] } });

  it("pauses new requests at the spend or character cap and tells the admin once", async () => {
    expect(await spendPause(at(L.dailySpendUsd - 1, 10).db, L)).toBeNull();
    const over = at(L.dailySpendUsd, 10);
    expect(await spendPause(over.db, L)).toMatchObject({ code: "spend_paused" });
    await spendPause(over.db, L);
    expect(over.tables.lifecycle_exceptions).toEqual([expect.objectContaining({ kind: "generation_spend_cap", status: "open" })]);
    expect(await spendPause(at(0, L.dailyCharactersAllHouseholds).db, L)).toMatchObject({ code: "spend_paused" });
    expect(await spendPause(at(0, 10).db, { ...L, dailyCharactersAllHouseholds: 5 })).toMatchObject({ code: "spend_paused" });
  });
});
