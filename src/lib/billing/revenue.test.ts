// @vitest-environment node
import { describe, expect, it } from "vitest";
import { revenueRows } from "./revenue";

const meta = { household_id: "h1", adult_id: "u1" };

describe("revenueRows", () => {
  it("records each paid subscription line with its interval and service period", () => {
    const rows = revenueRows({
      type: "invoice.paid",
      livemode: false,
      data: {
        object: {
          currency: "usd",
          status_transitions: { paid_at: 1_760_000_000 },
          parent: { subscription_details: { metadata: meta } },
          lines: {
            data: [
              { id: "il_1", amount: 1999, quantity: 1, period: { start: 1_760_000_000, end: 1_762_592_000 }, pricing: { price_details: { price: { lookup_key: "readli_family_monthly_1999" } } } },
              { id: "il_2", amount: 1198, quantity: 2, period: { start: 1_760_000_000, end: 1_762_592_000 }, price: { lookup_key: "readli_extra_slot_599" } },
              { id: "il_3", amount: 0, price: { lookup_key: "readli_family_monthly_1999" } },
              { id: "il_4", amount: 500, price: { lookup_key: "someone_elses_price" } },
            ],
          },
        },
      },
    });
    expect(rows.map((r) => [r.provider_ref, r.kind, r.amount_cents, r.billing_interval, r.quantity, r.household_id, r.payer_id])).toEqual([
      ["il_1", "subscription", 1999, "month", 1, "h1", "u1"],
      ["il_2", "narrator_slot", 1198, "month", 2, "h1", "u1"],
    ]);
    expect(rows[0]).toMatchObject({ period_start: new Date(1_760_000_000_000).toISOString(), occurred_at: new Date(1_760_000_000_000).toISOString(), livemode: false });
  });

  it("marks the annual plan as yearly", () => {
    const [row] = revenueRows({ type: "invoice.paid", data: { object: { lines: { data: [{ id: "il_9", amount: 17999, price: { lookup_key: "readli_family_annual_17999" }, metadata: meta }] } } } });
    expect(row).toMatchObject({ kind: "subscription", billing_interval: "year", household_id: "h1" });
  });

  it("records a paid credit pack as one-time revenue, never MRR", () => {
    const rows = revenueRows({
      type: "checkout.session.completed",
      data: { object: { mode: "payment", payment_status: "paid", amount_total: 699, payment_intent: "pi_1", metadata: { ...meta, item: "credit_pack:pack-small" } } },
    });
    expect(rows).toEqual([expect.objectContaining({ kind: "credit_pack", amount_cents: 699, billing_interval: null, provider_ref: "pi_1" })]);
    expect(revenueRows({ type: "checkout.session.completed", data: { object: { mode: "subscription", payment_status: "paid", amount_total: 1999 } } })).toEqual([]);
  });

  it("records refunds as negative amounts", () => {
    const rows = revenueRows({
      type: "charge.refunded",
      data: { object: { metadata: { ...meta, item: "credit_pack:pack-small" }, refunds: { data: [{ id: "re_1", amount: 699, status: "succeeded" }, { id: "re_2", amount: 100, status: "failed" }] } } },
    });
    expect(rows).toEqual([expect.objectContaining({ kind: "credit_pack", amount_cents: -699, provider_ref: "re_1" })]);
  });

  it("ignores everything else", () => {
    expect(revenueRows({ type: "customer.subscription.updated", data: { object: {} } })).toEqual([]);
  });
});
