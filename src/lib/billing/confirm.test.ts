// @vitest-environment node
import { describe, expect, it } from "vitest";
import { confirmCheckout } from "./confirm";

/** Records writes; reads find nothing, so every apply is a first apply. */
function fakeDb() {
  const writes: [string, string, Record<string, unknown>][] = [];
  const db = {
    from(table: string) {
      const q = {
        select: () => q,
        eq: () => q,
        maybeSingle: async () => ({ data: null, error: null }),
        insert: async (row: Record<string, unknown>) => (writes.push([table, "insert", row]), { error: null }),
        upsert: async (row: Record<string, unknown>) => (writes.push([table, "upsert", row]), { error: null }),
      };
      return q;
    },
  };
  return { db: db as never, writes };
}

const subscription = {
  id: "sub_1",
  status: "active",
  customer: "cus_1",
  start_date: 1_793_000_000,
  metadata: { household_id: "h1", item: "family_monthly" },
  items: { data: [] },
};
const session = (over: Record<string, unknown> = {}) => ({
  id: "cs_test_1",
  mode: "subscription",
  status: "complete",
  payment_status: "paid",
  livemode: false,
  customer: "cus_1",
  client_reference_id: "h1",
  metadata: { household_id: "h1", item: "family_monthly" },
  subscription,
  ...over,
});

describe("confirmCheckout", () => {
  it("starts the plan as soon as the parent is back from a paid checkout", async () => {
    const { db, writes } = fakeDb();
    expect(await confirmCheckout(db, async () => session(), "cs_test_1", "h1")).toEqual({ status: "done", item: "family_monthly", credits: null });
    expect(writes.find(([t, op]) => t === "household_entitlements" && op === "insert")?.[2]).toMatchObject({
      household_id: "h1",
      source: "subscription",
      status: "active",
      provider_subscription_ref: "sub_1",
    });
  });

  it("grants a credit pack once paid, and waits while the payment is still going through", async () => {
    const pack = { mode: "payment", subscription: null, payment_intent: "pi_1", metadata: { household_id: "h1", item: "credit_pack:small", credits: "20", adult_id: "a1" } };
    const { db, writes } = fakeDb();
    expect(await confirmCheckout(db, async () => session({ ...pack, payment_status: "unpaid" }), "cs_test_1", "h1")).toEqual({ status: "pending" });
    expect(writes).toHaveLength(0);
    expect(await confirmCheckout(db, async () => session(pack), "cs_test_1", "h1")).toEqual({ status: "done", item: "credit_pack:small", credits: 20 });
    expect(writes.some(([t]) => t === "narration_credit_lots")).toBe(true);
  });

  it("ignores another family's checkout and anything that isn't a session id", async () => {
    const { db, writes } = fakeDb();
    expect(await confirmCheckout(db, async () => session(), "cs_test_1", "someone-else")).toEqual({ status: "not_found" });
    expect(await confirmCheckout(db, async () => session(), "../oops", "h1")).toEqual({ status: "not_found" });
    expect(writes).toHaveLength(0);
  });
});
