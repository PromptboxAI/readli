import { describe, expect, it } from "vitest";
import { billingChange } from "@/lib/billing/events";
import { revenueRows } from "@/lib/billing/revenue";
import { isSponsorshipEvent, sponsorshipChange } from "./events";

const meta = { readli_kind: "sponsorship", sponsorship_id: "sp-1", sponsor_id: "ruth", plan: "monthly" };
const ev = (type: string, object: Record<string, unknown>) => ({ type, livemode: false, created: 1795000000, data: { object } });
const t = (iso: string) => Date.parse(iso) / 1000;

describe("sponsorship Stripe events", () => {
  it("keeps sponsorship events out of the household billing path", () => {
    const paid = ev("checkout.session.completed", { mode: "payment", payment_status: "paid", payment_intent: "pi_1", customer: "cus_1", metadata: { ...meta, item: "sponsorship:monthly" } });
    expect(isSponsorshipEvent(paid)).toBe(true);
    expect(billingChange(paid)).toEqual({ kind: "ignore", reason: "sponsorship" });
    expect(sponsorshipChange(paid)).toEqual({ kind: "paid", sponsorshipId: "sp-1", customerRef: "cus_1", paymentRef: "pi_1" });
  });

  it("waits for an unpaid checkout", () => {
    expect(sponsorshipChange(ev("checkout.session.completed", { payment_status: "unpaid", payment_intent: "pi_1", metadata: meta })).kind).toBe("ignore");
  });

  it("reads the waiting subscription's first charge as paid-through", () => {
    const sub = ev("customer.subscription.created", { id: "sub_1", status: "trialing", trial_end: t("2027-01-25T12:00:00Z"), metadata: meta });
    expect(sponsorshipChange(sub)).toMatchObject({ kind: "subscription", state: "live", paidThrough: "2027-01-25T12:00:00.000Z" });
    expect(billingChange(sub).kind).toBe("ignore");
  });

  it("maps a failing card, a cancel and the end", () => {
    expect(sponsorshipChange(ev("customer.subscription.updated", { id: "sub_1", status: "past_due", metadata: meta }))).toMatchObject({ state: "past_due" });
    expect(
      sponsorshipChange(ev("customer.subscription.updated", { id: "sub_1", status: "active", cancel_at_period_end: true, current_period_end: t("2027-02-25T12:00:00Z"), metadata: meta })),
    ).toMatchObject({ state: "canceling", endsAt: "2027-02-25T12:00:00.000Z" });
    expect(sponsorshipChange(ev("customer.subscription.deleted", { id: "sub_1", status: "canceled", ended_at: t("2027-02-08T00:00:00Z"), metadata: meta }))).toMatchObject({
      state: "ended",
      endsAt: "2027-02-08T00:00:00.000Z",
    });
  });

  it("reads renewals and failed renewals from the subscription's invoice", () => {
    const lines = { data: [{ id: "il_1", amount: 1999, quantity: 1, price: { lookup_key: "readli_sponsored_family_monthly_1999" }, period: { start: t("2027-01-25T12:00:00Z"), end: t("2027-02-25T12:00:00Z") } }] };
    const paid = ev("invoice.paid", { amount_paid: 1999, lines, parent: { subscription_details: { metadata: meta } } });
    expect(isSponsorshipEvent(paid)).toBe(true);
    expect(sponsorshipChange(paid)).toEqual({ kind: "renewed", sponsorshipId: "sp-1", paidThrough: "2027-02-25T12:00:00.000Z" });
    expect(sponsorshipChange(ev("invoice.payment_failed", { amount_paid: 0, lines, parent: { subscription_details: { metadata: meta } } }))).toEqual({ kind: "renewal_failed", sponsorshipId: "sp-1" });
    // The $0 invoice Stripe makes when the waiting subscription starts is not a renewal.
    expect(sponsorshipChange(ev("invoice.paid", { amount_paid: 0, lines, parent: { subscription_details: { metadata: meta } } })).kind).toBe("ignore");
  });

  it("ends coverage on a full refund or a dispute", () => {
    expect(sponsorshipChange(ev("charge.refunded", { amount: 17999, amount_refunded: 17999, payment_intent: "pi_1", metadata: meta }))).toMatchObject({ kind: "refunded", full: true });
    expect(sponsorshipChange(ev("charge.refunded", { amount: 17999, amount_refunded: 5000, payment_intent: "pi_1", metadata: meta }))).toMatchObject({ full: false });
    expect(sponsorshipChange(ev("charge.dispute.created", { payment_intent: "pi_1" }))).toEqual({ kind: "disputed", paymentRef: "pi_1" });
  });
});

describe("sponsorship revenue", () => {
  it("records the sponsor as the payer, never a household, with the year and month apart", () => {
    const year = revenueRows(
      ev("checkout.session.completed", {
        mode: "payment",
        payment_status: "paid",
        payment_intent: "pi_y",
        amount_total: 17999,
        currency: "usd",
        metadata: { ...meta, plan: "annual", item: "sponsorship:annual", deliver_at: "2026-12-25T12:00:00.000Z", paid_through: "2027-12-25T12:00:00.000Z" },
      }),
    );
    expect(year).toEqual([
      expect.objectContaining({ kind: "sponsorship", billing_interval: "year", household_id: null, payer_id: "ruth", amount_cents: 17999, sponsorship_id: "sp-1", period_start: "2026-12-25T12:00:00.000Z" }),
    ]);
    const lines = { data: [{ id: "il_1", amount: 1999, quantity: 1, price: { lookup_key: "readli_sponsored_family_monthly_1999" }, period: { start: 1, end: 2 } }] };
    const month = revenueRows(ev("invoice.paid", { lines, parent: { subscription_details: { metadata: meta } } }));
    expect(month).toEqual([expect.objectContaining({ kind: "sponsorship", billing_interval: "month", household_id: null, payer_id: "ruth", sponsorship_id: "sp-1" })]);
    const refund = revenueRows(ev("charge.refunded", { metadata: { ...meta, plan: "annual" }, refunds: { data: [{ id: "re_1", amount: 17999, status: "succeeded" }] } }));
    expect(refund).toEqual([expect.objectContaining({ kind: "sponsorship", billing_interval: "year", amount_cents: -17999 })]);
  });

  it("leaves ordinary Family revenue rows without a sponsorship column", () => {
    const lines = { data: [{ id: "il_2", amount: 1999, quantity: 1, price: { lookup_key: "readli_family_monthly_1999" }, period: { start: 1, end: 2 } }] };
    const [row] = revenueRows(ev("invoice.paid", { lines, parent: { subscription_details: { metadata: { household_id: "h1" } } } }));
    expect(row).not.toHaveProperty("sponsorship_id");
    expect(row?.kind).toBe("subscription");
  });
});
