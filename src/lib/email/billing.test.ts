import { describe, expect, it } from "vitest";
import { abandonedCheckout, cancellationConfirmed, giftEnding, planEnded, queueBillingEmails, trialCreditsLow, trialEnding, yearlyRenewal, type BillingContext } from "./billing";
import { fakeEmailDb } from "./fake-db.test-util";

const NOW = new Date("2026-10-24T15:00:00Z");
const PARENT = "11111111-1111-4111-8111-111111111111";
const sec = (iso: string) => Date.parse(iso) / 1000;
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

const family = {
  households: [{ id: "h1", created_by: PARENT }],
  household_members: [{ household_id: "h1", user_id: PARENT, role: "guardian", removed_at: null }],
  adult_profiles: [{ user_id: PARENT, display_name: "Sam Lee" }],
};

const sub = (over: Record<string, unknown> = {}) => ({
  id: "sub_1",
  status: "trialing",
  metadata: { household_id: "h1" },
  trial_end: sec("2026-10-27T15:00:00Z"),
  items: { data: [{ quantity: 1, price: { unit_amount: 1499, currency: "usd", recurring: { interval: "month" } } }] },
  ...over,
});
const event = (type: string, object: Record<string, unknown>, receivedAt = hoursAgo(1)) => ({ type, received_at: receivedAt, payload: { data: { object } } });

function setup(tables: Record<string, Record<string, unknown>[]>, enabled: string[], credits = { available: 100, allowance: 1000, credits: 1 }) {
  const fake = fakeEmailDb({ ...family, ...tables });
  const ctx: BillingContext = { db: fake.db, secret: "s", base: "https://readli.test", now: NOW, enabled: new Set(enabled), credits: async () => credits };
  return { fake, ctx };
}

describe("T1 trial ending", () => {
  it("sends the one trial reminder with the date, charge and live credits", async () => {
    const { ctx } = setup({ payment_events: [event("customer.subscription.trial_will_end", sub())] }, ["T1"]);
    const [email] = await trialEnding(ctx);
    expect(email!.dedupeKey).toBe("T1:sub_1");
    expect(email!.message.subject).toBe("Your Readli trial ends on October 27, 2026");
    expect(email!.message.text).toContain("$14.99 a month");
    expect(email!.message.text).toContain("1 narration credit left");
    expect(email!.message.text).toContain("/family/billing");
  });

  it("skips a trial canceled or converted since", async () => {
    for (const later of [sub({ cancel_at_period_end: true }), sub({ status: "active" })]) {
      const { ctx } = setup({ payment_events: [event("customer.subscription.trial_will_end", sub(), hoursAgo(5)), event("customer.subscription.updated", later)] }, ["T1"]);
      expect(await trialEnding(ctx)).toEqual([]);
    }
  });

  it("leaves the amount to Billing when there's a discount", async () => {
    const { ctx } = setup({ payment_events: [event("customer.subscription.trial_will_end", sub({ discount: { id: "di" } }))] }, ["T1"]);
    expect((await trialEnding(ctx))[0]!.message.text).toContain("Billing shows the exact amount");
  });
});

describe("T2 trial credits low", () => {
  const trial = { household_entitlements: [{ id: "e1", household_id: "h1", source: "trial", status: "active", ends_at: null }] };
  it("sends once when under 20% of the trial allowance", async () => {
    const { ctx } = setup(trial, ["T2"], { available: 150, allowance: 1000, credits: 1 });
    expect((await trialCreditsLow(ctx)).map((e) => e.dedupeKey)).toEqual(["T2:trial:e1"]);
    await queueBillingEmails(ctx);
    expect(await trialCreditsLow(ctx)).toEqual([]);
  });
  it("waits while 20% or more is left", async () => {
    const { ctx } = setup(trial, ["T2"], { available: 200, allowance: 1000, credits: 2 });
    expect(await trialCreditsLow(ctx)).toEqual([]);
  });
});

describe("B1 yearly renewal", () => {
  const yearly = (over: Record<string, unknown> = {}) =>
    sub({ status: "active", current_period_end: sec("2026-11-22T15:00:00Z"), items: { data: [{ quantity: 1, price: { unit_amount: 14999, currency: "usd", recurring: { interval: "year" } } }] }, ...over });
  it("goes about 30 days before a yearly renewal", async () => {
    const { ctx } = setup({ payment_events: [event("customer.subscription.updated", yearly(), hoursAgo(200))] }, ["B1"]);
    const [email] = await yearlyRenewal(ctx);
    expect(email!.message.text).toContain("$149.99 for another year");
  });
  it("skips monthly plans and renewals turned off", async () => {
    const monthly = yearly({ items: sub().items });
    for (const s of [monthly, yearly({ cancel_at_period_end: true })]) {
      const { ctx } = setup({ payment_events: [event("customer.subscription.updated", s)] }, ["B1"]);
      expect(await yearlyRenewal(ctx)).toEqual([]);
    }
  });
});

describe("B2 gift ending", () => {
  const gift = (over: Record<string, unknown> = {}) => ({ id: "g1", plan_id: "prepaid_3m", status: "active", recipient_user_id: PARENT, giver_display_name: "Grandma Jo", paid_through: "2026-10-30T00:00:00Z", renewals_stopped: false, ...over });
  it("tells the recipient a week ahead, without anything about the giver beyond their name", async () => {
    const { ctx } = setup({ gifts: [gift()] }, ["B2"]);
    const [email] = await giftEnding(ctx);
    expect(email!.message.subject).toBe("Your gift from Grandma Jo ends on October 29, 2026");
  });
  it("skips a renewing gift or a family with its own plan", async () => {
    expect(await giftEnding(setup({ gifts: [gift({ plan_id: "sponsored_monthly" })] }, ["B2"]).ctx)).toEqual([]);
    const own = { household_entitlements: [{ id: "e2", household_id: "h1", source: "subscription", status: "active", ends_at: null }] };
    expect(await giftEnding(setup({ gifts: [gift()], ...own }, ["B2"]).ctx)).toEqual([]);
  });
});

describe("B4 cancellation confirmed", () => {
  const canceling = (over: Record<string, unknown> = {}) => sub({ status: "active", cancel_at_period_end: true, current_period_end: sec("2026-11-20T15:00:00Z"), ...over });
  it("confirms the cancel with the last day", async () => {
    const { ctx } = setup({ payment_events: [event("customer.subscription.updated", canceling())] }, ["B4"]);
    const [email] = await cancellationConfirmed(ctx);
    expect(email!.dedupeKey).toBe("B4:sub_1:2026-11-20");
    expect(email!.message.subject).toBe("Your Readli plan is canceled. Your last day is November 20, 2026");
    expect(email!.message.text).toContain("won't be charged again");
    expect(email!.message.text).toContain("/family/billing");
  });
  it("tells a canceled trial it won't be charged", async () => {
    const { ctx } = setup({ payment_events: [event("customer.subscription.updated", sub({ cancel_at_period_end: true }))] }, ["B4"]);
    const [email] = await cancellationConfirmed(ctx);
    expect(email!.message.text).toContain("canceled your Readli Family trial");
    expect(email!.message.text).toContain("October 27, 2026");
  });
  it("skips a cancel turned back off, a plan not canceling and a sponsor's gift", async () => {
    const undone = [event("customer.subscription.updated", canceling(), hoursAgo(5)), event("customer.subscription.updated", canceling({ cancel_at_period_end: false }))];
    expect(await cancellationConfirmed(setup({ payment_events: undone }, ["B4"]).ctx)).toEqual([]);
    expect(await cancellationConfirmed(setup({ payment_events: [event("customer.subscription.updated", sub({ status: "active" }))] }, ["B4"]).ctx)).toEqual([]);
    const gift = canceling({ metadata: { household_id: "h1", readli_kind: "sponsorship" } });
    expect(await cancellationConfirmed(setup({ payment_events: [event("customer.subscription.updated", gift)] }, ["B4"]).ctx)).toEqual([]);
  });
});

describe("B5 plan ended", () => {
  const deleted = (over: Record<string, unknown> = {}) => event("customer.subscription.deleted", sub({ status: "canceled", ended_at: sec("2026-10-24T12:00:00Z"), ...over }));
  it("tells the family their plan ended, once", async () => {
    const { ctx } = setup({ payment_events: [deleted()] }, ["B5"]);
    const [email] = await planEnded(ctx);
    expect(email!.dedupeKey).toBe("B5:sub_1");
    expect(email!.message.subject).toBe("Your Readli plan has ended");
    expect(email!.message.text).toContain("ended on October 24, 2026");
    await queueBillingEmails(ctx);
    expect((await queueBillingEmails(ctx)).queued).toBe(0);
  });
  it("says so when a failed payment ended it", async () => {
    const [email] = await planEnded(setup({ payment_events: [deleted({ cancellation_details: { reason: "payment_failed" } })] }, ["B5"]).ctx);
    expect(email!.message.text).toContain("couldn't take payment");
  });
  it("skips a family that already has another plan running", async () => {
    const plan = { household_entitlements: [{ id: "e4", household_id: "h1", source: "subscription", status: "active", provider_subscription_ref: "sub_2", ends_at: null }] };
    expect(await planEnded(setup({ payment_events: [deleted()], ...plan }, ["B5"]).ctx)).toEqual([]);
  });
});

describe("K1 abandoned checkout", () => {
  const expired = (h = 30) => event("checkout.session.expired", { id: "cs_1", metadata: { household_id: "h1", adult_id: PARENT, item: "family_monthly" } }, hoursAgo(h));
  it("waits a day, then sends a marketing email with unsubscribe", async () => {
    expect(await abandonedCheckout(setup({ payment_events: [expired(5)] }, ["K1"]).ctx)).toEqual([]);
    const [email] = await abandonedCheckout(setup({ payment_events: [expired()] }, ["K1"]).ctx);
    expect(email!.dedupeKey).toBe("K1:cs_1");
    expect(email!.message.headers!["List-Unsubscribe"]).toContain("topic=marketing");
  });
  it("skips when they bought since or already have a plan", async () => {
    const bought = event("checkout.session.completed", { metadata: { household_id: "h1" } }, hoursAgo(10));
    expect(await abandonedCheckout(setup({ payment_events: [expired(), bought] }, ["K1"]).ctx)).toEqual([]);
    const plan = { household_entitlements: [{ id: "e3", household_id: "h1", source: "subscription", status: "active", ends_at: null }] };
    expect(await abandonedCheckout(setup({ payment_events: [expired()], ...plan }, ["K1"]).ctx)).toEqual([]);
  });
});

it("queues nothing while every billing email is off", async () => {
  const { ctx } = setup({ payment_events: [event("customer.subscription.trial_will_end", sub())] }, []);
  expect(await queueBillingEmails(ctx)).toEqual({ queued: 0, errors: [] });
});
