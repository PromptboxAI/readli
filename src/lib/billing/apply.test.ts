// @vitest-environment node
import { describe, expect, it } from "vitest";
import { DEFAULT_PLAN } from "@/lib/family/plan";
import { applyBillingChange } from "./apply";

/** Just enough of the Supabase client for the billing writes, keeping rows in memory. */
function fakeDb() {
  const tables: Record<string, Record<string, unknown>[]> = {};
  const rows = (t: string) => (tables[t] ??= []);
  const db = {
    from(table: string) {
      const filters: [string, unknown][] = [];
      const matching = () => rows(table).filter((r) => filters.every(([k, v]) => r[k] === v));
      const q = {
        select: () => q,
        eq: (k: string, v: unknown) => {
          filters.push([k, v]);
          return q;
        },
        maybeSingle: async () => ({ data: matching()[0] ?? null, error: null }),
        insert: async (row: Record<string, unknown>) => {
          rows(table).push({ id: `${table}-${rows(table).length + 1}`, ...row });
          return { error: null };
        },
        upsert: async (row: Record<string, unknown>) => {
          rows(table).push(row);
          return { error: null };
        },
        update: (patch: Record<string, unknown>) => ({
          eq: async (k: string, v: unknown) => {
            for (const r of rows(table).filter((r) => r[k] === v)) Object.assign(r, patch);
            return { error: null };
          },
        }),
      };
      return q;
    },
  };
  return { db: db as never, tables };
}

const at = new Date("2026-10-11T00:00:00.000Z");

describe("applyBillingChange", () => {
  it("grants a paid credit pack once, in character units, expiring per the plan", async () => {
    const { db, tables } = fakeDb();
    const change = { kind: "credit_pack" as const, householdId: "h1", customerRef: null, adultId: "u1", packId: "pack-small", credits: 20, paymentRef: "pi_1" };
    await applyBillingChange(db, change, false, DEFAULT_PLAN, at);
    await applyBillingChange(db, change, false, DEFAULT_PLAN, at);
    expect(tables.narration_credit_lots).toHaveLength(1);
    expect(tables.narration_credit_lots![0]).toMatchObject({
      household_id: "h1",
      source: "purchased",
      credits: 20 * DEFAULT_PLAN.charactersPerCredit,
      payment_ref: "pi_1",
      granted_by: "u1",
    });
  });

  it("starts a plan once per subscription and updates it after", async () => {
    const { db, tables } = fakeDb();
    const sub = {
      kind: "subscription" as const,
      householdId: "h1",
      subscriptionRef: "sub_1",
      customerRef: "cus_1",
      status: "active" as const,
      trial: false,
      extraNarratorSlots: 1,
      startsAt: at.toISOString(),
      endsAt: null,
    };
    await applyBillingChange(db, sub, false, DEFAULT_PLAN, at);
    await applyBillingChange(db, { ...sub, status: "canceled", endsAt: "2026-11-11T00:00:00.000Z" }, false, DEFAULT_PLAN, at);
    expect(tables.household_entitlements).toHaveLength(1);
    expect(tables.household_entitlements![0]).toMatchObject({ status: "canceled", extra_narrator_slots: 1, provider_subscription_ref: "sub_1" });
    expect(tables.billing_customers![0]).toMatchObject({ household_id: "h1", customer_ref: "cus_1" });
  });

  it("keeps a trial and the paid plan it turns into on one row", async () => {
    const { db, tables } = fakeDb();
    const sub = {
      kind: "subscription" as const,
      householdId: "h1",
      subscriptionRef: "sub_2",
      customerRef: "cus_2",
      status: "active" as const,
      trial: true,
      extraNarratorSlots: 0,
      startsAt: at.toISOString(),
      endsAt: "2026-10-25T00:00:00.000Z",
    };
    await applyBillingChange(db, sub, false, DEFAULT_PLAN, at);
    expect(tables.household_entitlements![0]).toMatchObject({ source: "trial", ends_at: "2026-10-25T00:00:00.000Z" });
    await applyBillingChange(db, { ...sub, trial: false, startsAt: "2026-10-25T00:00:00.000Z", endsAt: null }, false, DEFAULT_PLAN, at);
    expect(tables.household_entitlements).toHaveLength(1);
    expect(tables.household_entitlements![0]).toMatchObject({ source: "subscription", starts_at: "2026-10-25T00:00:00.000Z", ends_at: null });
  });
});
