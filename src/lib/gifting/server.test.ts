import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { hashGiftCode } from "./codes.server";
import type { StripeApi } from "@/lib/billing/stripe-api";
import { complimentaryForCode, giftForCode, pauseSubscriptionForGift, redeemGiftCode, subscriptionPaidUntil } from "./server";

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

describe("complimentary memberships", () => {
  const comp = (over: Row = {}) =>
    gift({
      recipient_name: null,
      giver_display_name: "Readli",
      event_name: "Mount Elementary Basket Dinner",
      message: null,
      complimentary_for: "raffle",
      claim_by: "2027-10-22T23:59:59.000Z",
      batch_id: "b1",
      ...over,
    });

  it("show the sponsor and event apart, with no made-up recipient", async () => {
    const landing = await complimentaryForCode(fakeDb([comp()]), CODE, NOW);
    expect(landing).toEqual({
      months: 12,
      occasion: "raffle",
      sponsorName: "Readli",
      sponsorIsReadli: true,
      eventName: "Mount Elementary Basket Dinner",
      recipientName: null,
      message: null,
      claimBy: "2027-10-22T23:59:59.000Z",
      status: "ready",
    });
    expect(await complimentaryForCode(fakeDb([gift()]), CODE, NOW)).toBeNull();
  });

  it("stop at the claim-by date, and treat old codes as from their organization", async () => {
    expect((await complimentaryForCode(fakeDb([comp({ claim_by: "2026-10-10T00:00:00Z" })]), CODE, NOW))?.status).toBe("unavailable");
    const old = await complimentaryForCode(fakeDb([comp({ batch_id: null, claim_by: null, giver_display_name: "Oak Street Elementary", plan_id: "prepaid_12m" })]), CODE, NOW);
    expect(old).toMatchObject({ sponsorName: "Oak Street Elementary", sponsorIsReadli: false, claimBy: "2027-10-01T00:00:00.000Z" });
  });

  it("name the family as asked, and only pause billing when the subscriber agreed", async () => {
    const calls: Row[] = [];
    const db = fakeDb([], (name, args) => (calls.push({ name, ...args }), { data: [{ household_id: "h1", paid_through: "2027-10-11T12:00:00Z" }], error: null }));
    await redeemGiftCode(db, CODE, { id: "u2", name: "Ben" }, { familyName: "  The   Garcia family " });
    expect(calls[0]).toMatchObject({ p_family_name: "The Garcia family" });
    expect(calls[0]).not.toHaveProperty("p_defer_billing");
    await expect(redeemGiftCode(db, CODE, { id: "u2", name: "Ben" }, { deferBilling: true, stripe: null })).rejects.toMatchObject({ status: 503 });
    expect(calls).toHaveLength(1);
    const refusing = fakeDb([], () => ({ data: null, error: { message: "subscriber must confirm" } }));
    await expect(redeemGiftCode(refusing, CODE, { id: "u2", name: "Ben" })).rejects.toMatchObject({ status: 409, code: "confirm_billing_pause" });
  });
});

describe("existing subscribers claiming a gift", () => {
  function updatesDb() {
    const updates: { patch: Row; filters: [string, unknown][] }[] = [];
    const db = {
      from: () => {
        const entry = { patch: {} as Row, filters: [] as [string, unknown][] };
        const q = {
          update: (p: Row) => ((entry.patch = p), updates.push(entry), q),
          eq: (k: string, v: unknown) => (entry.filters.push([k, v]), q),
          then: (resolve: (v: unknown) => void) => resolve({ error: null }),
        };
        return q;
      },
    } as unknown as SupabaseClient;
    return { db, updates };
  }
  const SUB = { id: "sub_1", status: "active", current_period_end: Date.parse("2026-11-05T00:00:00Z") / 1000 };

  it("pause Stripe billing until their paid time plus the gift's months, with no proration", async () => {
    const { db, updates } = updatesDb();
    const paused: unknown[][] = [];
    const stripe = { getSubscription: async () => SUB, pauseBillingUntil: async (...a: unknown[]) => (paused.push(a), SUB) } as unknown as StripeApi;
    const until = await pauseSubscriptionForGift(db, stripe, { giftId: "g1", subscriptionRef: "sub_1", months: 12 });
    expect(until).toBe("2027-11-05T00:00:00.000Z");
    expect(paused).toEqual([["sub_1", Date.parse("2027-11-05T00:00:00Z") / 1000, "readli-gift-pause-g1"]]);
    expect(updates).toEqual([{ patch: { billing_deferral: "applied", paid_through: until, recipient_email: null }, filters: [["id", "g1"], ["billing_deferral", "pending"]] }]);
  });

  it("stack on free time already given, and undo the claim if Stripe refuses", async () => {
    expect(subscriptionPaidUntil({ current_period_end: 100, trial_end: 500 })).toBe(new Date(500_000).toISOString());
    expect(subscriptionPaidUntil({ items: { data: [{ current_period_end: 200 }] } })).toBe(new Date(200_000).toISOString());
    const { db, updates } = updatesDb();
    const stripe = {
      getSubscription: async () => SUB,
      pauseBillingUntil: async () => {
        throw new Error("card_declined");
      },
    } as unknown as StripeApi;
    await expect(pauseSubscriptionForGift(db, stripe, { giftId: "g1", subscriptionRef: "sub_1", months: 3 })).rejects.toMatchObject({ code: "billing_pause_failed" });
    expect(updates).toEqual([
      { patch: { status: "sent", redeemed_at: null, recipient_user_id: null, billing_deferral: null }, filters: [["id", "g1"], ["billing_deferral", "pending"]] },
    ]);
    const cancelling = { getSubscription: async () => ({ ...SUB, cancel_at_period_end: true }), pauseBillingUntil: async () => SUB } as unknown as StripeApi;
    await expect(pauseSubscriptionForGift(updatesDb().db, cancelling, { giftId: "g1", subscriptionRef: "sub_1", months: 3 })).rejects.toMatchObject({ code: "billing_pause_failed" });
  });
});
