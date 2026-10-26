import { describe, expect, it } from "vitest";
import {
  accessEnd,
  canOfferPlace,
  cancelOutcome,
  chargeCopy,
  chargeSchedule,
  creditSplit,
  giveRequest,
  ownPlanStart,
  removalDate,
  shortDate,
  zonedTime,
  type SponsorshipFacts,
} from "./rules";

const NOW = new Date("2026-11-28T15:00:00.000Z");
const XMAS = new Date("2026-12-25T12:00:00.000Z");
const family = (name: string, email: string, shareVoice = true) => ({ name, email, shareVoice });
const base = { plan: "annual", deliverOn: "2026-12-25", timeZone: "America/New_York", giverName: "Grandma Ruth", recipients: [family("Michael and Sarah", "m@example.com")], voiceConsent: true };

describe("giving a sponsored gift", () => {
  it("delivers at 7am in the sponsor's time zone", () => {
    expect(zonedTime("2026-12-25", "America/New_York", 7)?.toISOString()).toBe("2026-12-25T12:00:00.000Z");
    expect(zonedTime("2026-07-04", "America/Los_Angeles", 7)?.toISOString()).toBe("2026-07-04T14:00:00.000Z");
    expect(zonedTime("2026-12-25", "Not/AZone", 7)).toBeNull();
    expect(giveRequest(base, NOW).deliverAt.toISOString()).toBe("2026-12-25T12:00:00.000Z");
  });

  it("sends right away when asked, and refuses past or far-off days", () => {
    expect(giveRequest({ ...base, deliverOn: "now" }, NOW).deliverAt).toEqual(NOW);
    expect(() => giveRequest({ ...base, deliverOn: "2026-11-01" }, NOW)).toThrow(/later date/);
    expect(() => giveRequest({ ...base, deliverOn: "2027-06-01" }, NOW)).toThrow(/within/);
  });

  it("takes one or two families, each with their own address and voice choice", () => {
    expect(() => giveRequest({ ...base, recipients: [] }, NOW)).toThrow(/one or two/);
    expect(() => giveRequest({ ...base, recipients: [family("A", "a@x.com"), family("B", "b@x.com"), family("C", "c@x.com")] }, NOW)).toThrow(/one or two/);
    expect(() => giveRequest({ ...base, recipients: [family("A", "a@x.com"), family("B", "A@x.com")] }, NOW)).toThrow(/own email/);
    const g = giveRequest({ ...base, recipients: [family("A", "a@x.com", true), family("B", "b@x.com", false)] }, NOW);
    expect(g.recipients.map((r) => r.shareVoice)).toEqual([true, false]);
  });

  it("needs the sponsor's consent before sharing her voice with anyone", () => {
    expect(() => giveRequest({ ...base, voiceConsent: false }, NOW)).toThrow(/agree to share/);
    expect(giveRequest({ ...base, voiceConsent: false, recipients: [family("A", "a@x.com", false)] }, NOW).sharesVoice).toBe(false);
  });
});

describe("charges and access", () => {
  it("prepaid year: charged today, a year from delivery, never renews", () => {
    const s = chargeSchedule("annual", XMAS);
    expect(s.chargedTodayCents).toBe(17999);
    expect(s.accessStarts).toEqual(XMAS);
    expect(shortDate(s.lastDay)).toBe("Dec 24, 2027");
    expect(s.nextChargeAt).toBeNull();
    expect(chargeCopy("annual", XMAS).summary).toBe("Charged today: $179.99 · Covers Dec 25, 2026 to Dec 24, 2027 · No automatic renewal");
  });

  it("monthly: first month today, then a month after delivery", () => {
    const s = chargeSchedule("monthly", XMAS);
    expect(shortDate(s.nextChargeAt!)).toBe("Jan 25, 2027");
    expect(shortDate(s.lastDay)).toBe("Jan 24, 2027");
    expect(chargeCopy("monthly", XMAS).choice).toBe("Monthly · $19.99 · First month paid today · Then $19.99 each month from Jan 25, 2027 until you cancel");
    expect(chargeCopy("monthly", XMAS).renewal).toBe("Then $19.99 on Jan 25, 2027 and every month after, until you cancel.");
    expect(shortDate(chargeSchedule("monthly", NOW).nextChargeAt!)).toBe("Dec 28, 2026");
  });
});

const facts = (over: Partial<SponsorshipFacts> = {}): SponsorshipFacts => ({
  plan: "monthly",
  status: "active",
  startsAt: XMAS,
  paidThrough: new Date("2027-01-25T12:00:00.000Z"),
  endsAt: null,
  deliveredAt: XMAS,
  ...over,
});

describe("cancel and refund", () => {
  it("before delivery refunds in full", () => {
    expect(cancelOutcome(facts({ status: "scheduled", deliveredAt: null }))).toEqual({ kind: "refund_before_delivery" });
  });
  it("monthly after delivery stops renewals and the paid month runs out", () => {
    const o = cancelOutcome(facts());
    expect(o.kind).toBe("stop_renewal");
    if (o.kind === "stop_renewal") expect(shortDate(o.lastDay)).toBe("Jan 24, 2027");
  });
  it("the year has nothing to stop", () => {
    expect(cancelOutcome(facts({ plan: "annual", paidThrough: new Date("2027-12-25T12:00:00.000Z") })).kind).toBe("year_does_not_renew");
    expect(cancelOutcome(facts({ status: "ended" })).kind).toBe("nothing_to_cancel");
  });
});

describe("removing a family", () => {
  it("takes effect at the end of the current gift month", () => {
    const d = removalDate(facts(), { status: "active" }, new Date("2027-01-10T00:00:00.000Z"));
    expect(d.toISOString()).toBe("2027-01-25T12:00:00.000Z");
    expect(removalDate(facts({ plan: "annual", paidThrough: new Date("2027-12-25T12:00:00.000Z") }), { status: "active" }, new Date("2027-03-30T00:00:00.000Z")).toISOString()).toBe("2027-04-25T12:00:00.000Z");
  });
  it("never runs past the end of the whole gift", () => {
    const ending = facts({ status: "canceling", endsAt: new Date("2027-01-20T00:00:00.000Z") });
    expect(removalDate(ending, { status: "active" }, new Date("2027-01-10T00:00:00.000Z")).toISOString()).toBe("2027-01-20T00:00:00.000Z");
  });
  it("withdraws an invitation nobody accepted straight away", () => {
    const now = new Date("2027-01-10T00:00:00.000Z");
    expect(removalDate(facts(), { status: "invited" }, now)).toEqual(now);
  });
  it("lets a place change hands at most twice in 12 months", () => {
    const now = new Date("2027-06-01T00:00:00.000Z");
    expect(canOfferPlace([new Date("2027-02-01T00:00:00.000Z")], now)).toBe(true);
    expect(canOfferPlace([new Date("2027-02-01T00:00:00.000Z"), new Date("2027-04-01T00:00:00.000Z")], now)).toBe(false);
    expect(canOfferPlace([new Date("2026-05-01T00:00:00.000Z"), new Date("2027-04-01T00:00:00.000Z")], now)).toBe(true);
  });
});

describe("credit split", () => {
  it("moves in steps of 5, at least 5 each, all 40 when both places are filled", () => {
    expect(creditSplit({ 1: 25, 2: 15 }, [1, 2])).toEqual({ 1: 25, 2: 15 });
    expect(() => creditSplit({ 1: 22, 2: 18 }, [1, 2])).toThrow(/steps of 5/);
    expect(() => creditSplit({ 1: 40, 2: 0 }, [1, 2])).toThrow(/at least 5/);
    expect(() => creditSplit({ 1: 20, 2: 15 }, [1, 2])).toThrow(/all 40/);
    expect(creditSplit({ 1: 40 }, [1])).toEqual({ 1: 40 });
    expect(() => creditSplit({ 1: 45 }, [1])).toThrow(/40 credits/);
  });
});

describe("when the gift ends for a family", () => {
  it("monthly carries on while the sponsor pays; a removal or cancel gives the date", () => {
    expect(accessEnd(facts(), { accessUntil: null })).toBeNull();
    const until = new Date("2027-01-25T12:00:00.000Z");
    expect(accessEnd(facts(), { accessUntil: until })).toEqual(until);
    expect(accessEnd(facts({ status: "canceling", endsAt: until }), { accessUntil: null })).toEqual(until);
  });
  it("the year ends when it's paid through", () => {
    const end = new Date("2027-12-25T12:00:00.000Z");
    expect(accessEnd(facts({ plan: "annual", paidThrough: end }), { accessUntil: null })).toEqual(end);
  });
  it("the family's own plan starts the day the gift ends, never overlapping", () => {
    const end = new Date("2027-01-25T12:00:00.000Z");
    expect(ownPlanStart(end, new Date("2027-01-10T00:00:00.000Z"))).toEqual({ ok: true, startsAt: end });
    expect(ownPlanStart(null)).toEqual({ ok: false });
  });
});
