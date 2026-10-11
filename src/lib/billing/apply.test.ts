// @vitest-environment node
import { describe, expect, it } from "vitest";
import { DEFAULT_PLAN } from "@/lib/family/plan";
import { applyBillingChange } from "./apply";

/** Just enough of the Supabase client for the billing writes, keeping rows in memory. */
function fakeDb() {
  const tables: Record<string, Record<string, unknown>[]> = {};
  const rpcs: { name: string; args: unknown }[] = [];
  const rows = (t: string) => (tables[t] ??= []);
  const db = {
    rpc: async (name: string, args: unknown) => {
      rpcs.push({ name, args });
      return { data: 1, error: null };
    },
    from(table: string) {
      const filters: ((r: Record<string, unknown>) => boolean)[] = [];
      let patch: Record<string, unknown> | null = null;
      const matching = () => rows(table).filter((r) => filters.every((f) => f(r)));
      const result = () => {
        const found = matching();
        if (patch) for (const r of found) Object.assign(r, patch);
        return { data: found, error: null };
      };
      const q = {
        select: () => q,
        limit: () => q,
        eq: (k: string, v: unknown) => {
          filters.push((r) => r[k] === v);
          return q;
        },
        in: (k: string, vs: unknown[]) => {
          filters.push((r) => vs.includes(r[k]));
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
        update: (p: Record<string, unknown>) => {
          patch = p;
          return q;
        },
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(result()).then(resolve, reject),
      };
      return q;
    },
  };
  return { db: db as never, tables, rpcs };
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
      tier: "family" as const,
      trialEndsAt: null,
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

  it("moves a subscription to the Archive, stopping narration being prepared, and logs the change", async () => {
    const { db, tables, rpcs } = fakeDb();
    const sub = {
      kind: "subscription" as const,
      householdId: "h1",
      subscriptionRef: "sub_1",
      customerRef: null,
      status: "active" as const,
      tier: "family" as const,
      trialEndsAt: null,
      extraNarratorSlots: 0,
      startsAt: at.toISOString(),
      endsAt: null,
    };
    await applyBillingChange(db, sub, false, DEFAULT_PLAN, at);
    await applyBillingChange(db, { ...sub, tier: "archive" }, false, DEFAULT_PLAN, at);
    expect(tables.household_entitlements).toHaveLength(1);
    expect(tables.household_entitlements![0]).toMatchObject({ tier: "archive", status: "active" });
    expect(rpcs).toEqual([{ name: "stop_household_narration", args: { p_household: "h1" } }]);
    expect(tables.lifecycle_audit_log![0]).toMatchObject({ action: "plan_changed", household_id: "h1", detail: { from: "family", to: "archive" } });
    // Back to Readli Family: nothing to stop, and the change is logged.
    await applyBillingChange(db, sub, false, DEFAULT_PLAN, at);
    expect(rpcs).toHaveLength(1);
    expect(tables.lifecycle_audit_log!.at(-1)).toMatchObject({ detail: { from: "archive", to: "family" } });
  });

  it("restores a family in its recovery window when a plan starts again", async () => {
    const { db, tables } = fakeDb();
    tables.household_recovery = [{ household_id: "h1", status: "recovering" }];
    await applyBillingChange(
      db,
      { kind: "subscription", householdId: "h1", subscriptionRef: "sub_2", customerRef: null, status: "active", tier: "archive", trialEndsAt: null, extraNarratorSlots: 0, startsAt: at.toISOString(), endsAt: null },
      false,
      DEFAULT_PLAN,
      at,
    );
    expect(tables.household_recovery![0]).toMatchObject({ status: "restored", restored_tier: "archive" });
    expect(tables.lifecycle_audit_log![0]).toMatchObject({ action: "recovery_restored" });
  });

  it("never expires purchased credits by default", async () => {
    const { db, tables } = fakeDb();
    await applyBillingChange(db, { kind: "credit_pack", householdId: "h1", customerRef: null, adultId: null, packId: "pack-small", credits: 20, paymentRef: "pi_9" }, false, DEFAULT_PLAN, at);
    expect(tables.narration_credit_lots![0]).toMatchObject({ source: "purchased", expires_at: null });
  });
});
