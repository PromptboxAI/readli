// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { HouseholdEntitlement } from "@/lib/family/model";
import { DEFAULT_PLAN } from "@/lib/family/plan";
import { catalog, catalogItem, lookupKey } from "./catalog";
import { checkoutRequest } from "./checkout";
import { billingConfig } from "./config";
import { encodeForm, StripeApi, StripeError } from "./stripe-api";

const entitlement = (source: HouseholdEntitlement["source"]): HouseholdEntitlement => ({
  id: "e1",
  householdId: "h1",
  source,
  status: "active",
  extraNarratorSlots: 0,
  extraStreams: 0,
  startsAt: "2026-10-01T00:00:00.000Z",
  endsAt: null,
});

describe("catalog", () => {
  it("prices everything from the plan settings", () => {
    const items = catalog(DEFAULT_PLAN);
    expect(items.slice(0, 3).map((i) => [i.id, i.amountCents, i.interval])).toEqual([
      ["family_monthly", 1999, "month"],
      ["family_annual", 17999, "year"],
      ["extra_slot", 599, "month"],
    ]);
    expect(items.filter((i) => i.id.startsWith("credit_pack:"))).toHaveLength(DEFAULT_PLAN.creditPacks.length);
    expect(items.every((i) => i.interval !== null || i.credits !== undefined)).toBe(true);
  });

  it("gives a changed price a new lookup key, so existing subscriptions keep theirs", () => {
    expect(lookupKey("family_monthly", 1999)).toBe("readli_family_monthly_1999");
    expect(catalogItem({ ...DEFAULT_PLAN, familyMonthlyPriceCents: 2499 }, "family_monthly")?.lookupKey).toBe("readli_family_monthly_2499");
    expect(lookupKey("credit_pack:pack-small", 699)).toBe("readli_credit_pack_pack_small_699");
  });
});

describe("checkoutRequest", () => {
  const packs = { ...DEFAULT_PLAN, narrationPurchasesEnabled: true };
  const pack = `credit_pack:${DEFAULT_PLAN.creditPacks[0]!.id}`;

  it("starts Readli Family with optional extra slots", () => {
    expect(checkoutRequest(DEFAULT_PLAN, null, "family_monthly")).toMatchObject({ ok: true, mode: "subscription", extraSlots: 0 });
    expect(checkoutRequest(DEFAULT_PLAN, entitlement("trial"), "family_annual", 2)).toMatchObject({ ok: true, extraSlots: 2 });
    expect(checkoutRequest(DEFAULT_PLAN, null, "family_monthly", 5)).toMatchObject({ ok: false, code: "bad_slots" });
    expect(checkoutRequest({ ...DEFAULT_PLAN, extraSlotPriceApproved: false }, null, "family_monthly", 1)).toMatchObject({ ok: false, code: "slots_not_for_sale" });
  });

  it("won't sell a second plan to a family that already has one", () => {
    for (const source of ["subscription", "gift", "donated"] as const) {
      expect(checkoutRequest(DEFAULT_PLAN, entitlement(source), "family_monthly")).toMatchObject({ ok: false, code: "already_on_plan" });
    }
  });

  it("sells credit packs only to Readli Family households, once purchases are on", () => {
    expect(checkoutRequest(DEFAULT_PLAN, entitlement("subscription"), pack)).toMatchObject({ ok: false, code: "purchases_off" });
    expect(checkoutRequest(packs, null, pack)).toMatchObject({ ok: false, code: "needs_family" });
    expect(checkoutRequest(packs, entitlement("gift"), pack)).toMatchObject({ ok: true, mode: "payment" });
  });

  it("refuses unknown items and a bare extra slot", () => {
    expect(checkoutRequest(DEFAULT_PLAN, null, "nope")).toMatchObject({ ok: false, code: "bad_item" });
    expect(checkoutRequest(DEFAULT_PLAN, entitlement("subscription"), "extra_slot")).toMatchObject({ ok: false, code: "bad_item" });
  });
});

describe("Stripe API", () => {
  it("encodes nested params the way Stripe expects", () => {
    expect(decodeURIComponent(encodeForm({ mode: "subscription", line_items: [{ price: "p1", quantity: 2 }], metadata: { a: "b" }, skip: undefined, lookup_keys: ["k"] }))).toBe(
      "mode=subscription&line_items[0][price]=p1&line_items[0][quantity]=2&metadata[a]=b&lookup_keys[0]=k",
    );
  });

  it("refuses to call Stripe while payments are off", async () => {
    const api = new StripeApi(billingConfig({} as NodeJS.ProcessEnv), () => Promise.reject(new Error("no network")));
    await expect(api.createCheckoutSession({})).rejects.toBeInstanceOf(StripeError);
  });

  it("reuses an existing price, or creates it from the catalog", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    let existing = true;
    const fake = (async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (init?.method === "GET") return Response.json({ data: existing ? [{ id: "price_old" }] : [] });
      return Response.json({ id: "price_new" });
    }) as typeof fetch;
    const config = billingConfig({ PAYMENTS_ENABLED: "true", STRIPE_SECRET_KEY: "sk_test_x", STRIPE_WEBHOOK_SECRET: "w" } as unknown as NodeJS.ProcessEnv);
    const api = new StripeApi(config, fake);
    const item = catalogItem(DEFAULT_PLAN, "family_monthly")!;
    expect(await api.priceFor(item)).toBe("price_old");
    existing = false;
    expect(await api.priceFor(item)).toBe("price_new");
    const created = decodeURIComponent(String(calls.at(-1)!.init!.body));
    expect(created).toContain("unit_amount=1999");
    expect(created).toContain("recurring[interval]=month");
    expect(created).toContain("lookup_key=readli_family_monthly_1999");
    expect(calls[0]!.init!.headers).toMatchObject({ authorization: "Bearer sk_test_x" });
  });
});
