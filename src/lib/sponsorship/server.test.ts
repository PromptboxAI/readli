import { describe, expect, it } from "vitest";
import type { StripeApi } from "@/lib/billing/stripe-api";
import { fakeEmailDb } from "@/lib/email/fake-db.test-util";
import { giveRequest } from "./rules";
import { applySponsorshipChange, cancelGift, changeDelivery, offerPlace, rebalanceCredits, removeFamily, runSponsorships, startGift, undoRemoval, type SponsorshipContext } from "./server";

const SECRET = "test-secret-for-sponsorships-0123456789";
const BOUGHT = new Date("2026-11-28T15:00:00.000Z");

type Row = Record<string, unknown>;
type Call = [string, ...unknown[]];

function fakeStripe() {
  const calls: Call[] = [];
  const api = {
    priceFor: async (item: { lookupKey: string }) => (calls.push(["price", item.lookupKey]), `price_${item.lookupKey}`),
    createCheckoutSession: async (p: Row) => (calls.push(["checkout", p]), { id: "cs_1", url: "https://checkout.stripe.test/cs_1" }),
    getPaymentIntent: async (id: string) => (calls.push(["pi", id]), { id, payment_method: "pm_1", customer: "cus_1" }),
    createSubscription: async (p: Row, key: string) => (calls.push(["subscribe", p, key]), { id: "sub_1", status: "trialing" }),
    updateSubscription: async (id: string, p: Row) => (calls.push(["update", id, p]), { id, status: "trialing" }),
    cancelSubscription: async (id: string) => (calls.push(["cancel", id]), { id, status: "canceled" }),
    refundPayment: async (pi: string, _m: Row, key: string) => (calls.push(["refund", pi, key]), { id: "re_1", status: "succeeded" }),
  };
  return { stripe: api as unknown as StripeApi, calls };
}

function setup(now = BOUGHT) {
  const synced: string[] = [];
  const { db, tables } = fakeEmailDb({}, {}, (name, args) => {
    if (name === "sync_sponsorship") synced.push(args.p_sponsorship as string);
    return null;
  });
  const { stripe, calls } = fakeStripe();
  const clock = { now };
  const ctx: SponsorshipContext = { db, stripe, secret: SECRET, base: "https://readli.test", livemode: false, now: () => clock.now };
  return { ctx, tables, calls, synced, clock };
}

const give = (over: Row = {}) =>
  giveRequest(
    {
      plan: "monthly",
      deliverOn: "2026-12-25",
      timeZone: "America/New_York",
      giverName: "Grandma Ruth",
      recipients: [
        { name: "Michael and Sarah", email: "m@example.com", shareVoice: true },
        { name: "Anna and Joe", email: "a@example.com", shareVoice: false },
      ],
      voiceConsent: true,
      ...over,
    },
    BOUGHT,
  );

async function paidGift(over: Row = {}) {
  const env = setup();
  const { sponsorshipId } = await startGift(env.ctx, { id: "ruth", email: "ruth@example.com" }, give(over));
  await applySponsorshipChange(env.ctx, { kind: "paid", sponsorshipId, customerRef: "cus_1", paymentRef: "pi_1" });
  const sp = () => env.tables.sponsorships!.find((r) => r.id === sponsorshipId)!;
  return { ...env, id: sponsorshipId, sp };
}

describe("buying a gift", () => {
  it("monthly: charges the first month now, saves the card, and prints the renewal date", async () => {
    const { ctx, tables, calls } = setup();
    await startGift(ctx, { id: "ruth", email: "ruth@example.com" }, give());
    const checkout = calls.find((c) => c[0] === "checkout")![1] as Row;
    expect(checkout.mode).toBe("payment");
    expect(checkout.payment_intent_data).toMatchObject({ setup_future_usage: "off_session", metadata: { readli_kind: "sponsorship" } });
    expect((checkout.custom_text as { submit: { message: string } }).submit.message).toContain("Then $19.99 on Jan 25, 2027 and every month after, until you cancel.");
    expect(calls).toContainEqual(["price", "readli_sponsored_family_first_month_1999"]);
    expect(tables.sponsorships![0]).toMatchObject({ status: "awaiting_payment", plan: "monthly", price_cents: 1999, deliver_at: "2026-12-25T12:00:00.000Z" });
    expect(tables.sponsorship_seats!.map((s) => [s.seat, s.share_voice, s.credit_share])).toEqual([
      [1, true, 20],
      [2, false, 20],
    ]);
    expect(tables.consent_receipts![0]).toMatchObject({ user_id: "ruth", purpose: "sponsored_voice_share" });
    // Addresses are kept encrypted, never in the clear.
    expect(JSON.stringify(tables.sponsorship_invitations)).not.toContain("m@example.com");
  });

  it("the year saves no card, so it can't renew", async () => {
    const { ctx, calls } = setup();
    await startGift(ctx, { id: "ruth", email: null }, give({ plan: "annual" }));
    const checkout = calls.find((c) => c[0] === "checkout")![1] as { payment_intent_data: Row; custom_text: { submit: { message: string } } };
    expect(checkout.payment_intent_data.setup_future_usage).toBeUndefined();
    expect(checkout.custom_text.submit.message).toContain("No automatic renewal");
  });

  it("monthly: once paid, waits for delivery with its first charge a month after it", async () => {
    const { sp, calls } = await paidGift();
    expect(sp()).toMatchObject({ status: "scheduled", provider_payment_ref: "pi_1", provider_subscription_ref: "sub_1" });
    expect(sp().delivered_at).toBeUndefined();
    const [, params, key] = calls.find((c) => c[0] === "subscribe")!;
    expect(params).toMatchObject({ customer: "cus_1", default_payment_method: "pm_1", trial_end: Date.parse("2027-01-25T12:00:00.000Z") / 1000, metadata: { readli_kind: "sponsorship" } });
    expect(key).toBe(`sponsorship-renewals-${sp().id}`);
  });

  it("a repeated payment event changes nothing", async () => {
    const { ctx, id, calls } = await paidGift();
    await applySponsorshipChange(ctx, { kind: "paid", sponsorshipId: id, customerRef: "cus_1", paymentRef: "pi_1" });
    expect(calls.filter((c) => c[0] === "subscribe")).toHaveLength(1);
  });
});

describe("delivery", () => {
  it("nothing goes out before the day, then access starts and invitations are sent", async () => {
    const { ctx, sp, tables, clock } = await paidGift();
    expect((await runSponsorships(ctx)).delivered).toBe(0);
    expect(tables.email_outbox ?? []).toHaveLength(0);

    clock.now = new Date("2026-12-25T12:02:00.000Z");
    expect((await runSponsorships(ctx)).delivered).toBe(1);
    expect(sp()).toMatchObject({ status: "active", starts_at: "2026-12-25T12:00:00.000Z", paid_through: "2027-01-25T12:00:00.000Z" });
    const sent = tables.email_outbox!.map((e) => e.email_id).sort();
    expect(sent).toEqual(["S1", "S1", "S2"]);
    expect(tables.email_outbox!.find((e) => e.email_id === "S1")!.subject).toBe("Grandma Ruth gave your family Readli");
    expect((await runSponsorships(ctx)).delivered).toBe(0);
  });

  it("a gift sent right away arrives as soon as it's paid", async () => {
    const { sp } = await paidGift({ deliverOn: "now" });
    expect(sp()).toMatchObject({ status: "active", starts_at: BOUGHT.toISOString(), paid_through: "2026-12-28T15:00:00.000Z" });
  });

  it("moving the day before delivery moves the first renewal too", async () => {
    const { ctx, id, calls } = await paidGift();
    await changeDelivery(ctx, "ruth", id, "2026-12-24", "America/New_York");
    expect(calls.find((c) => c[0] === "update")).toEqual(["update", "sub_1", { trial_end: Date.parse("2027-01-24T12:00:00.000Z") / 1000, proration_behavior: "none" }]);
  });
});

describe("canceling", () => {
  it("before delivery: full refund, the waiting subscription is canceled, no invitation goes out", async () => {
    const { ctx, id, sp, calls, tables, clock } = await paidGift();
    const outcome = await cancelGift(ctx, "ruth", id);
    expect(outcome.kind).toBe("refund_before_delivery");
    expect(calls).toContainEqual(["cancel", "sub_1"]);
    expect(calls).toContainEqual(["refund", "pi_1", `sponsorship-refund-${id}`]);
    expect(sp()).toMatchObject({ status: "refunded", refund_state: "pending" });
    expect(tables.sponsorship_seats!.every((s) => s.status === "canceled")).toBe(true);
    clock.now = new Date("2026-12-26T00:00:00.000Z");
    expect((await runSponsorships(ctx)).delivered).toBe(0);
    expect(tables.email_outbox ?? []).toHaveLength(0);
  });

  it("only the sponsor can cancel", async () => {
    const { ctx, id } = await paidGift();
    await expect(cancelGift(ctx, "someone-else", id)).rejects.toMatchObject({ status: 404 });
  });

  it("monthly after delivery: renewals stop and the paid month runs out", async () => {
    const { ctx, id, sp, calls, clock } = await paidGift();
    clock.now = new Date("2026-12-25T13:00:00.000Z");
    await runSponsorships(ctx);
    const outcome = await cancelGift(ctx, "ruth", id);
    expect(outcome.kind).toBe("stop_renewal");
    expect(calls.find((c) => c[0] === "update")).toEqual(["update", "sub_1", { cancel_at_period_end: true }]);
    expect(sp()).toMatchObject({ status: "canceling", ends_at: "2027-01-25T12:00:00.000Z" });
  });
});

describe("renewals", () => {
  it("a failed card keeps families listening and emails only the sponsor", async () => {
    const { ctx, id, sp, tables, clock } = await paidGift();
    clock.now = new Date("2026-12-25T13:00:00.000Z");
    await runSponsorships(ctx);
    const before = tables.email_outbox!.length;
    clock.now = new Date("2027-01-25T13:00:00.000Z");
    await applySponsorshipChange(ctx, { kind: "renewal_failed", sponsorshipId: id });
    expect(sp().status).toBe("past_due");
    const added = tables.email_outbox!.slice(before);
    expect(added.map((e) => [e.email_id, e.recipient_user_id])).toEqual([["S3", "ruth"]]);
    await applySponsorshipChange(ctx, { kind: "renewed", sponsorshipId: id, paidThrough: "2027-02-25T12:00:00.000Z" });
    expect(sp()).toMatchObject({ status: "active", paid_through: "2027-02-25T12:00:00.000Z" });
  });

  it("when retries run out the gift ends for both families", async () => {
    const { ctx, id, sp, synced, clock } = await paidGift();
    clock.now = new Date("2026-12-25T13:00:00.000Z");
    await runSponsorships(ctx);
    await applySponsorshipChange(ctx, { kind: "subscription", sponsorshipId: id, subscriptionRef: "sub_1", state: "ended", paidThrough: null, endsAt: "2027-02-08T00:00:00.000Z" });
    expect(sp()).toMatchObject({ status: "ended", ends_at: "2027-02-08T00:00:00.000Z" });
    expect(synced).toContain(id);
  });

  it("a dispute ends coverage at once", async () => {
    const { ctx, sp, clock } = await paidGift();
    clock.now = new Date("2026-12-25T13:00:00.000Z");
    await runSponsorships(ctx);
    await applySponsorshipChange(ctx, { kind: "disputed", paymentRef: "pi_1" });
    expect(sp()).toMatchObject({ status: "ended", ends_at: "2026-12-25T13:00:00.000Z" });
  });

  it("ignores events for a gift this database doesn't know", async () => {
    const { ctx } = setup();
    await expect(applySponsorshipChange(ctx, { kind: "paid", sponsorshipId: "elsewhere", customerRef: null, paymentRef: "pi_9" })).resolves.toBeUndefined();
  });
});

describe("the prepaid year", () => {
  it("ends on its own after a year, with notices to the sponsor first", async () => {
    const { ctx, sp, tables, clock } = await paidGift({ plan: "annual" });
    clock.now = new Date("2026-12-25T13:00:00.000Z");
    await runSponsorships(ctx);
    expect(sp()).toMatchObject({ status: "active", paid_through: "2027-12-25T12:00:00.000Z" });
    clock.now = new Date("2027-11-30T00:00:00.000Z");
    await runSponsorships(ctx);
    // No family has joined in this test, so only the sponsor's year-end notice goes out.
    expect(tables.email_outbox!.filter((e) => e.email_id === "S4").map((e) => e.dedupe_key)).toEqual([`S4:${sp().id}:30`]);
    clock.now = new Date("2027-12-25T13:00:00.000Z");
    const report = await runSponsorships(ctx);
    expect(report.ended).toBe(1);
    expect(sp()).toMatchObject({ status: "ended", ends_at: "2027-12-25T12:00:00.000Z" });
  });
});

describe("families and credits", () => {
  async function delivered() {
    const env = await paidGift();
    env.clock.now = new Date("2026-12-25T13:00:00.000Z");
    await runSponsorships(env.ctx);
    // Michael and Sarah join.
    const seat = env.tables.sponsorship_seats!.find((s) => s.seat === 1)!;
    Object.assign(seat, { status: "active", household_id: "home-m", created_at: "2026-11-28T15:00:00.000Z" });
    env.tables.sponsorship_seats!.find((s) => s.seat === 2)!.created_at = "2026-11-28T15:00:00.000Z";
    env.tables.household_members = [{ household_id: "home-m", user_id: "sarah", role: "guardian", removed_at: null }];
    return env;
  }

  it("removing a family needs confirming and takes effect at the end of the gift month", async () => {
    const { ctx, id, tables, synced, clock } = await delivered();
    clock.now = new Date("2027-01-10T00:00:00.000Z");
    await expect(removeFamily(ctx, "ruth", id, 1, false)).rejects.toMatchObject({ code: "confirm_required" });
    const { accessUntil } = await removeFamily(ctx, "ruth", id, 1, true);
    expect(accessUntil.toISOString()).toBe("2027-01-25T12:00:00.000Z");
    expect(tables.sponsorship_seats!.find((s) => s.seat === 1)).toMatchObject({ status: "removal_scheduled", access_until: "2027-01-25T12:00:00.000Z" });
    expect(synced).toContain(id);
    const notice = tables.email_outbox!.find((e) => e.email_id === "S5")!;
    expect(notice).toMatchObject({ recipient_user_id: "sarah", household_id: "home-m" });
    expect(notice.body).toContain("Your family keeps Readli until Jan 24, 2027.");

    await undoRemoval(ctx, "ruth", id, 1);
    expect(tables.sponsorship_seats!.find((s) => s.seat === 1)).toMatchObject({ status: "active", access_until: null });
  });

  it("a family that never joined is withdrawn at once and the place can go to another family, twice a year at most", async () => {
    const { ctx, id, tables, clock } = await delivered();
    clock.now = new Date("2027-01-10T00:00:00.000Z");
    await removeFamily(ctx, "ruth", id, 2, true);
    expect(tables.sponsorship_seats!.find((s) => s.seat === 2)!.status).toBe("canceled");
    await offerPlace(ctx, "ruth", id, 2, { name: "Lee family", email: "lee@example.com", shareVoice: true });
    const fresh = tables.sponsorship_seats!.filter((s) => s.seat === 2 && s.status === "invited");
    expect(fresh).toHaveLength(1);
    expect(tables.email_outbox!.filter((e) => e.email_id === "S1")).toHaveLength(3);
    await expect(offerPlace(ctx, "ruth", id, 2, { name: "X", email: "x@example.com", shareVoice: false })).rejects.toMatchObject({ code: "place_taken" });

    // Two changes already in this year: a third is refused.
    for (const s of tables.sponsorship_seats!) if (s.seat === 2) Object.assign(s, { status: "canceled", created_at: "2027-01-05T00:00:00.000Z" });
    await expect(offerPlace(ctx, "ruth", id, 2, { name: "X", email: "x@example.com", shareVoice: false })).rejects.toMatchObject({ code: "too_many_changes" });
  });

  it("a new credit split starts next gift month and leaves this month alone", async () => {
    const { ctx, id, tables, clock } = await delivered();
    clock.now = new Date("2027-01-10T00:00:00.000Z");
    await expect(rebalanceCredits(ctx, "ruth", id, { 1: 30, 2: 5 })).rejects.toMatchObject({ code: "bad_split" });
    const { from } = await rebalanceCredits(ctx, "ruth", id, { 1: 25, 2: 15 });
    expect(from?.toISOString()).toBe("2027-01-25T12:00:00.000Z");
    expect(tables.sponsorship_seats!.map((s) => [s.seat, s.credit_share, s.next_credit_share])).toEqual([
      [1, 20, 25],
      [2, 20, 15],
    ]);
    clock.now = new Date("2027-01-26T00:00:00.000Z");
    await runSponsorships(ctx);
    expect(tables.sponsorship_seats!.find((s) => s.seat === 1)).toMatchObject({ credit_share: 25, next_credit_share: null });
  });
});
