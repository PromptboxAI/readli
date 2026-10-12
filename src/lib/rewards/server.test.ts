import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { attributeReferral, ensureReferralCode, newReferralCode, normalizeReferralCode, recordReferralPaidCycle, referralLink, rewardsState, useRewardMonth } from "./server";

type Row = Record<string, unknown>;

/** Enough of the Supabase query builder for the rewards queries. */
function fakeDb(tables: Record<string, Row[]> = {}, rpc: (name: string, args: Row) => unknown = () => null) {
  const calls: { name: string; args: Row }[] = [];
  const t = (name: string) => (tables[name] ??= []);
  const from = (name: string) => {
    const filters: ((r: Row) => boolean)[] = [];
    let insert: Row | null = null;
    const q = {
      select: () => q,
      order: () => q,
      limit: () => q,
      eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), q),
      neq: (k: string, v: unknown) => (filters.push((r) => r[k] !== v), q),
      is: (k: string, v: unknown) => (filters.push((r) => (r[k] ?? null) === v), q),
      in: (k: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[k])), q),
      insert: (row: Row) => ((insert = row), q),
      then: (resolve: (v: unknown) => void) => {
        if (insert) {
          t(name).push(insert);
          return resolve({ data: null, error: null });
        }
        resolve({ data: t(name).filter((r) => filters.every((f) => f(r))), error: null });
      },
    };
    return q;
  };
  const db = { from, rpc: async (name: string, args: Row) => (calls.push({ name, args }), { data: rpc(name, args), error: null }) };
  return { db: db as unknown as SupabaseClient, tables, calls };
}

describe("Readli Rewards for real accounts", () => {
  it("make readable referral codes and links", () => {
    expect(newReferralCode()).toMatch(/^[a-z0-9]{8}$/);
    expect(normalizeReferralCode(" ABCdef12 ")).toBe("abcdef12");
    expect(normalizeReferralCode("bad code!")).toBeNull();
    expect(referralLink("https://readli.ai/", "abcdef12")).toBe("https://readli.ai/r/abcdef12");
  });

  it("give each grown-up one referral code", async () => {
    const { db, tables } = fakeDb();
    const first = await ensureReferralCode(db, "u1");
    expect(await ensureReferralCode(db, "u1")).toBe(first);
    expect(tables.referral_codes).toHaveLength(1);
  });

  it("leave attribution and paid months to the database", async () => {
    const { db, calls } = fakeDb({}, (name) => (name === "attribute_referral" ? "attributed" : true));
    expect(await attributeReferral(db, "nope!", "u2")).toBe("unknown_code");
    expect(calls).toHaveLength(0);
    expect(await attributeReferral(db, "ABCDEF12", "u2")).toBe("attributed");
    expect(await recordReferralPaidCycle(db, "h2")).toBe(true);
    expect(await useRewardMonth(db, "h1")).toBe(true);
    expect(calls).toEqual([
      { name: "attribute_referral", args: { p_code: "abcdef12", p_user: "u2" } },
      { name: "record_referral_paid_cycle", args: { p_household: "h2" } },
      { name: "use_reward_month", args: { p_household: "h1" } },
    ]);
  });

  it("show real progress, pending referrals and free months", async () => {
    const now = new Date("2026-10-11T12:00:00Z");
    const { db } = fakeDb({
      household_members: [{ household_id: "h1", user_id: "u1", role: "guardian", removed_at: null }],
      child_profiles: [{ id: "c1", household_id: "h1" }],
      child_favorites: [{ child_id: "c1", book_slug: "b" }],
      household_invitations: [{ id: "i1", household_id: "h1" }],
      referrals: [
        { referrer_household_id: "h1", qualified_at: "2026-09-01", rejected_reason: null },
        { referrer_household_id: "h1", qualified_at: null, rejected_reason: null },
        { referrer_household_id: "h1", qualified_at: null, rejected_reason: "circular" },
      ],
      reward_grants: [
        { household_id: "h1", granted_at: "2026-09-01T00:00:00Z", applied_at: null },
        { household_id: "h1", granted_at: "2025-01-01T00:00:00Z", applied_at: "2025-02-01T00:00:00Z" },
      ],
    });
    const s = await rewardsState(db, "u1", now);
    expect([...s.completed].sort()).toEqual(["family_account", "family_library", "invite_storyteller", "referral"]);
    expect(s).toMatchObject({ pendingReferrals: 1, monthsEarned12: 1, monthsBanked: 1 });
  });

  it("show an empty path before the grown-up has a family", async () => {
    const { db } = fakeDb();
    const s = await rewardsState(db, "u9");
    expect(s.completed.size).toBe(0);
    expect(s.monthsBanked).toBe(0);
  });
});
