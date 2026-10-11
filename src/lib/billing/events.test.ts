// @vitest-environment node
import { describe, expect, it } from "vitest";
import { billingChange } from "./events";

const sub = (over: Record<string, unknown> = {}) => ({
  id: "sub_1",
  customer: "cus_1",
  status: "active",
  start_date: 1_760_000_000,
  current_period_end: 1_762_592_000,
  cancel_at_period_end: false,
  cancel_at: null,
  ended_at: null,
  metadata: { household_id: "h1" },
  items: {
    data: [
      { price: { lookup_key: "readli_family_monthly_1999" }, quantity: 1 },
      { price: { lookup_key: "readli_extra_slot_599" }, quantity: 2 },
    ],
  },
  ...over,
});
const event = (type: string, object: Record<string, unknown>) => ({ type, data: { object } });

describe("billingChange", () => {
  it("starts Readli Family with the extra slots bought at checkout", () => {
    expect(billingChange(event("customer.subscription.created", sub()))).toEqual({
      kind: "subscription",
      householdId: "h1",
      subscriptionRef: "sub_1",
      customerRef: "cus_1",
      status: "active",
      extraNarratorSlots: 2,
      startsAt: "2025-10-09T08:53:20.000Z",
      endsAt: null,
    });
  });

  it("keeps the plan through a trial or a retried card", () => {
    for (const status of ["trialing", "past_due"]) {
      expect(billingChange(event("customer.subscription.updated", sub({ status })))).toMatchObject({ status: "active" });
    }
  });

  it("ends the plan at period end when the family cancels, and right away when Stripe ends it", () => {
    expect(billingChange(event("customer.subscription.updated", sub({ cancel_at_period_end: true })))).toMatchObject({
      status: "active",
      endsAt: new Date(1_762_592_000 * 1000).toISOString(),
    });
    expect(billingChange(event("customer.subscription.deleted", sub({ status: "canceled", ended_at: 1_761_000_000 })))).toMatchObject({
      status: "canceled",
      endsAt: new Date(1_761_000_000 * 1000).toISOString(),
    });
    expect(billingChange(event("customer.subscription.updated", sub({ status: "unpaid" })))).toMatchObject({ status: "canceled" });
  });

  it("links the household to its Stripe customer after checkout", () => {
    expect(billingChange(event("checkout.session.completed", { customer: "cus_9", client_reference_id: "h2", metadata: {} }))).toEqual({
      kind: "customer",
      householdId: "h2",
      customerRef: "cus_9",
    });
  });

  it("ignores events it can't tie to a household, and ones Readli doesn't use", () => {
    expect(billingChange(event("customer.subscription.created", sub({ metadata: {} }))).kind).toBe("ignore");
    expect(billingChange(event("invoice.created", { id: "in_1" })).kind).toBe("ignore");
    expect(billingChange({ type: "customer.subscription.created" }).kind).toBe("ignore");
  });
});
