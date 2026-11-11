import { describe, expect, it } from "vitest";
import { slotUpdate, subscriptionSlots, type StripeSubItem } from "./slots";

const plan = (interval: "month" | "year"): StripeSubItem => ({ id: "si_plan", quantity: 1, price: { id: "price_plan", lookup_key: `readli_family_${interval === "year" ? "annual_17999" : "monthly_1999"}`, recurring: { interval } } });
const slots = (quantity: number, key = "readli_extra_slot_599"): StripeSubItem => ({ id: "si_slot", quantity, price: { id: "price_slot", lookup_key: key, recurring: { interval: "month" } } });

describe("subscriptionSlots", () => {
  it("reads the plan's interval and the extra slots on it", () => {
    expect(subscriptionSlots([plan("month")])).toMatchObject({ interval: "month", extra: 0 });
    expect(subscriptionSlots([plan("year"), slots(2, "readli_extra_slot_annual_7188")])).toMatchObject({ interval: "year", extra: 2 });
  });
});

describe("slotUpdate", () => {
  it("adds a slot item at the plan's price, charging the rest of the period now", () => {
    expect(slotUpdate([plan("month")], "add", "price_new")).toEqual({
      ok: true,
      params: { items: [{ price: "price_new", quantity: 1 }], proration_behavior: "always_invoice", payment_behavior: "error_if_incomplete" },
    });
  });

  it("raises the quantity of a slot item that's already there", () => {
    const u = slotUpdate([plan("month"), slots(1)], "add", "price_new");
    expect(u.ok && u.params.items).toEqual([{ id: "si_slot", quantity: 2 }]);
  });

  it("stops at the most extra slots a family can have", () => {
    expect(slotUpdate([plan("month"), slots(4)], "add", "price_new")).toMatchObject({ ok: false, code: "too_many_slots" });
  });

  it("lowers the quantity, or takes the item off at the last slot, crediting unused time", () => {
    const two = slotUpdate([plan("month"), slots(2)], "remove", null);
    expect(two.ok && two.params).toEqual({ items: [{ id: "si_slot", quantity: 1 }], proration_behavior: "create_prorations" });
    const one = slotUpdate([plan("month"), slots(1)], "remove", null);
    expect(one.ok && one.params.items).toEqual([{ id: "si_slot", deleted: true }]);
  });

  it("has nothing to remove without extra slots", () => {
    expect(slotUpdate([plan("month")], "remove", null)).toMatchObject({ ok: false, code: "no_extra_slots" });
  });
});
