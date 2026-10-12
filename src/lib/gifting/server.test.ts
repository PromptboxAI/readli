import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { hashGiftCode } from "./codes.server";
import { giftForCode, redeemGiftCode } from "./server";

type Row = Record<string, unknown>;

function fakeDb(gifts: Row[], rpc?: (name: string, args: Row) => { data: unknown; error: { message: string } | null }) {
  const from = () => {
    const filters: [string, unknown][] = [];
    const q = {
      select: () => q,
      limit: () => q,
      eq: (k: string, v: unknown) => (filters.push([k, v]), q),
      then: (resolve: (v: unknown) => void) => resolve({ data: gifts.filter((g) => filters.every(([k, v]) => g[k] === v)), error: null }),
    };
    return q;
  };
  return { from, rpc: async (n: string, a: Row) => rpc!(n, a) } as unknown as SupabaseClient;
}

const CODE = "ABCD-EFGH-JKMN";
const NOW = new Date("2026-10-11T12:00:00Z");
const gift = (over: Row = {}) => ({
  code_hash: hashGiftCode(CODE),
  plan_id: "prepaid_12m",
  status: "sent",
  recipient_name: "Ben",
  giver_display_name: "Nana Rose",
  message: "Happy reading",
  sent_at: "2026-10-01T00:00:00Z",
  redeemed_at: null,
  ...over,
});

describe("real gifts", () => {
  it("open by code, however it was typed, and show only the card", async () => {
    const landing = await giftForCode(fakeDb([gift()]), "abcd efgh jkmn", NOW);
    expect(landing).toMatchObject({ to: "Ben", from: "Nana Rose", message: "Happy reading", status: "ready" });
    expect(landing?.plan.id).toBe("prepaid_12m");
    expect(Object.keys(landing!)).toEqual(["plan", "to", "from", "message", "status"]);
    expect(await giftForCode(fakeDb([gift()]), "nope", NOW)).toBeNull();
    expect(await giftForCode(fakeDb([gift()]), "ABCD-EFGH-JKMP", NOW)).toBeNull();
  });

  it("say when a gift was already opened, cancelled, unpaid or a year old", async () => {
    const status = async (over: Row) => (await giftForCode(fakeDb([gift(over)]), CODE, NOW))?.status;
    expect(await status({ status: "active", redeemed_at: "x" })).toBe("redeemed");
    expect(await status({ status: "cancelled" })).toBe("unavailable");
    expect(await status({ status: "awaiting_payment" })).toBe("unavailable");
    expect(await status({ sent_at: "2025-09-01T00:00:00Z" })).toBe("unavailable");
  });

  it("redeem through the database into the recipient's own family, with friendly reasons when they can't", async () => {
    const calls: Row[] = [];
    const answers = [
      { data: [{ household_id: "h9", paid_through: "2027-10-11T12:00:00Z" }], error: null },
      { data: null, error: { message: "gift already redeemed" } },
      { data: null, error: { message: "own gift" } },
      { data: null, error: { message: "gift not found" } },
    ];
    const db = fakeDb([], (name, args) => (calls.push({ name, ...args }), answers.shift()!));
    const me = { id: "u2", name: "Ben" };
    expect(await redeemGiftCode(db, "abcdefghjkmn", me)).toEqual({ householdId: "h9", paidThrough: "2027-10-11T12:00:00Z" });
    expect(calls[0]).toEqual({ name: "redeem_gift", p_code_hash: hashGiftCode(CODE), p_user: "u2", p_family_name: "Ben's family" });
    await expect(redeemGiftCode(db, CODE, me)).rejects.toMatchObject({ status: 409, code: "gift_redeemed" });
    await expect(redeemGiftCode(db, CODE, me)).rejects.toMatchObject({ status: 403, code: "own_gift" });
    await expect(redeemGiftCode(db, CODE, me)).rejects.toMatchObject({ status: 404, code: "gift_not_found" });
    await expect(redeemGiftCode(db, "bad", me)).rejects.toMatchObject({ status: 400 });
    expect(calls).toHaveLength(4);
  });
});
