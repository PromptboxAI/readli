import { describe, expect, it } from "vitest";
import { checkoutNotice } from "@/lib/content/billing-policy";
import { fakeSupabase } from "@/lib/testing/fake-supabase";
import { forfeitHeldCredits, holdPurchasedCredits, packRefund, refundPack, removeUnusedCredits, type PurchasedPack } from "./credit-refunds";
import { queueTrialReminder } from "./notify";

/** Kevin's billing decisions (2026-10-12): no voluntary refunds, held purchased credits and the trial reminder. */
const NOW = new Date("2026-10-20T12:00:00Z");
const pack = (over: Partial<PurchasedPack> = {}): PurchasedPack => ({
  lotId: "lot1",
  credits: 50,
  creditsLeft: 50,
  grantedAt: "2026-10-10T12:00:00Z",
  paymentRef: "pi_1",
  paidCents: 1499,
  refundedAt: null,
  ...over,
});

describe("credit refunds and removal", () => {
  it("refunds only a duplicate charge, a billing error or a legally required amount", () => {
    expect(packRefund(pack(), "duplicate_charge")).toEqual({ ok: true, cents: 1499, basis: "duplicate_charge" });
    expect(packRefund(pack({ creditsLeft: 30 }), "billing_error", 500)).toEqual({ ok: true, cents: 500, basis: "billing_error" });
    expect(packRefund(pack({ creditsLeft: 30 }), "legally_required")).toEqual({ ok: true, cents: 899, basis: "legally_required" });
    expect(packRefund(pack({ creditsLeft: 0 }), "legally_required")).toEqual({ ok: false, reason: "nothing_left" });
    expect(packRefund(pack(), "billing_error", 2000)).toEqual({ ok: false, reason: "too_much" });
    expect(packRefund(pack({ refundedAt: "2026-10-15T00:00:00Z" }), "duplicate_charge")).toEqual({ ok: false, reason: "already_refunded" });
    expect(packRefund(pack({ paidCents: null }), "duplicate_charge")).toEqual({ ok: false, reason: "no_payment_record" });
  });

  it("refunds through Stripe once with a reason, closes the pack and logs it", async () => {
    const { db, tables } = fakeSupabase({
      narration_credit_lots: [{ id: "lot1", household_id: "h1", source: "purchased", credits: 50, granted_at: "2026-10-10T12:00:00Z", payment_ref: "pi_1" }],
      narration_credit_ledger: [],
      revenue_events: [{ provider_ref: "pi_1", kind: "credit_pack", amount_cents: 1499 }],
      lifecycle_audit_log: [],
    });
    const issued: [string, number, string][] = [];
    const issue = async (ref: string, cents: number, key: string) => {
      issued.push([ref, cents, key]);
      return { id: "re_1" };
    };
    const input = { paymentRef: "pi_1", basis: "duplicate_charge" as const, cents: null, note: "charged twice", admin: "kevin@readli.ai", now: NOW };
    await expect(refundPack(db, issue, { ...input, note: "" })).rejects.toThrow("Say why");
    await expect(refundPack(db, issue, { ...input, basis: "changed_mind" as never })).rejects.toThrow("Choose why");
    expect(await refundPack(db, issue, input)).toMatchObject({ cents: 1499 });
    expect(issued).toEqual([["pi_1", 1499, "pack-refund:lot1"]]);
    expect(tables.narration_credit_lots![0]).toMatchObject({ refunded_cents: 1499, refund_ref: "re_1", expires_at: NOW.toISOString() });
    expect(tables.lifecycle_audit_log).toEqual([expect.objectContaining({ action: "credit_pack_refunded", household_id: "h1" })]);
    await expect(refundPack(db, issue, input)).rejects.toThrow("already refunded");
    expect(issued).toHaveLength(1);
  });

  const lots = () => ({
    narration_credit_lots: [
      { id: "a", household_id: "h1", source: "purchased", credits: 20, granted_at: "2026-09-01T00:00:00Z", payment_ref: "pi_a" },
      { id: "b", household_id: "h1", source: "purchased", credits: 100, granted_at: "2026-09-02T00:00:00Z", payment_ref: "pi_b", refunded_at: "2026-09-03T00:00:00Z", expires_at: "2026-09-03T00:00:00Z" },
      { id: "c", household_id: "h1", source: "promotional", credits: 10, granted_at: "2026-09-01T00:00:00Z" },
    ],
    narration_credit_ledger: [{ household_id: "h1", lot_id: "a", kind: "reserve", credits: 8 }, { household_id: "h1", lot_id: "a", kind: "refund", credits: 3 }],
    revenue_events: [{ provider_ref: "pi_a", kind: "credit_pack", amount_cents: 699 }],
    lifecycle_exceptions: [] as Record<string, unknown>[],
    lifecycle_audit_log: [] as Record<string, unknown>[],
  });

  it("at final closure removes plan credits but holds purchased credits for an admin until forfeiture is on", async () => {
    const { db, tables } = fakeSupabase(lots());
    const held = await removeUnusedCredits(db, "h1", NOW.toISOString(), { forfeitPurchased: false });
    expect(held).toEqual({ purchasedRemoved: 0, purchasedHeld: 15 });
    expect(tables.narration_credit_lots!.map((l) => l.expires_at ?? null)).toEqual([null, "2026-09-03T00:00:00Z", NOW.toISOString()]);
    await holdPurchasedCredits(db, "h1", held.purchasedHeld, "Day-30 cleanup");
    await holdPurchasedCredits(db, "h1", held.purchasedHeld, "Day-30 cleanup");
    expect(tables.lifecycle_exceptions).toEqual([expect.objectContaining({ kind: "purchased_credits_held", household_id: "h1", status: "open" })]);

    expect(await forfeitHeldCredits(db, "h1", { admin: "kevin@readli.ai", note: "NY customer, no rule found", now: NOW })).toBe(15);
    expect(tables.narration_credit_lots![0]!.expires_at).toBe(NOW.toISOString());
    expect(tables.lifecycle_exceptions![0]).toMatchObject({ status: "resolved" });
    expect(tables.lifecycle_audit_log).toEqual([expect.objectContaining({ action: "credits_forfeited", household_id: "h1" })]);
    expect(tables.narration_credit_ledger).toHaveLength(2);
  });

  it("removes purchased credits too once forfeiture is switched on", async () => {
    const { db, tables } = fakeSupabase(lots());
    expect(await removeUnusedCredits(db, "h1", NOW.toISOString(), { forfeitPurchased: true })).toEqual({ purchasedRemoved: 15, purchasedHeld: 0 });
    expect(tables.narration_credit_lots!.map((l) => l.expires_at)).toEqual([NOW.toISOString(), "2026-09-03T00:00:00Z", NOW.toISOString()]);
  });

  it("tells buyers before they pay that credits and subscriptions aren't refundable", () => {
    expect(checkoutNotice("payment", 0)).toContain("aren't refundable");
    expect(checkoutNotice("payment", 0)).not.toContain("14 days");
    expect(checkoutNotice("subscription", 14)).toContain("We email you 3 days before it ends");
    expect(checkoutNotice("subscription", 14).length).toBeLessThanOrEqual(1200);
    expect(checkoutNotice("payment", 0).length).toBeLessThanOrEqual(1200);
  });
});

describe("trial reminder", () => {
  const event = (over: Record<string, unknown> = {}) => ({
    type: "customer.subscription.trial_will_end",
    data: {
      object: {
        id: "sub_1",
        customer: "cus_1",
        status: "trialing",
        trial_end: Date.parse("2026-10-23T12:00:00Z") / 1000,
        metadata: { household_id: "h1" },
        items: { data: [{ quantity: 1, price: { unit_amount: 17999, recurring: { interval: "year" } } }] },
        ...over,
      },
    },
  });
  const data = () => ({
    households: [{ id: "h1", name: "The Parks" }],
    household_members: [
      { household_id: "h1", user_id: "sara", role: "guardian", removed_at: null },
      { household_id: "h1", user_id: "kid", role: "child", removed_at: null },
    ],
  });

  it("emails each guardian once with the end date, exact amount, billing interval and a link to cancel", async () => {
    const { db, tables } = fakeSupabase(data());
    expect(await queueTrialReminder(db, event(), "https://readli.ai/family/billing", async () => 19439)).toBe(1);
    expect(await queueTrialReminder(db, event(), "https://readli.ai/family/billing", async () => 19439)).toBe(0);
    const [mail] = tables.email_outbox!;
    expect(mail).toMatchObject({ template: "trial_ending", recipient_user_id: "sara", category: "transactional" });
    expect(mail!.body).toContain("Friday, October 23, 2026");
    expect(mail!.body).toContain("$194.39");
    expect(mail!.body).toContain("yearly");
    expect(mail!.body).toContain("https://readli.ai/family/billing");
  });

  it("falls back to the plan's price, and skips a trial that is already cancelled", async () => {
    const { db, tables } = fakeSupabase(data());
    await queueTrialReminder(db, event(), "https://readli.ai/family/billing", async () => null);
    expect(tables.email_outbox![0]!.body).toContain("$179.99");
    expect(await queueTrialReminder(db, event({ id: "sub_2", cancel_at_period_end: true }), "https://readli.ai/family/billing", async () => 1)).toBe(0);
  });
});
