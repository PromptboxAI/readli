import { describe, expect, it } from "vitest";
import { normalizeGiftCode } from "./codes";
import { generateGiftCode, hashGiftCode } from "./codes.server";
import { addMonths, cancelGift, redeemGift, renewalNotices, statusAt, UNCLAIMED_DAYS, type Gift } from "./lifecycle";
import { GIFT_PLANS, giftPaymentsOpen, giftPlan, priceLabel } from "./plans";

const NOW = new Date("2026-10-10T12:00:00Z");

function gift(planId: string, over: Partial<Gift> = {}): Gift {
  return {
    id: "g1",
    plan: giftPlan(planId)!,
    status: "sent",
    giverName: "Nana Rose",
    recipientName: "Ben",
    recipientEmail: "ben@example.com",
    message: "",
    deliverOn: NOW,
    sentAt: NOW,
    redeemedAt: null,
    paidThrough: null,
    renewalsStopped: false,
    ...over,
  };
}

describe("gift plans", () => {
  it("offers one, three and twelve prepaid months plus a monthly sponsorship", () => {
    expect(GIFT_PLANS.map((p) => [p.kind, p.months])).toEqual([
      ["prepaid", 1],
      ["prepaid", 3],
      ["prepaid", 12],
      ["recurring", null],
    ]);
  });

  it("keeps payments off until prices are final, even if the switch is on", () => {
    expect(GIFT_PLANS.every((p) => p.priceCents === null)).toBe(true);
    expect(giftPaymentsOpen(GIFT_PLANS, true)).toBe(false);
    expect(giftPaymentsOpen(GIFT_PLANS.map((p) => ({ ...p, priceCents: 999 })), false)).toBe(false);
    expect(giftPaymentsOpen(GIFT_PLANS.map((p) => ({ ...p, priceCents: 999 })), true)).toBe(true);
    expect(priceLabel(GIFT_PLANS[0]!)).toBe("Price coming soon");
  });
});

describe("redeeming", () => {
  it("starts prepaid months on redemption", () => {
    const r = redeemGift(gift("prepaid_3m"), NOW);
    expect(r.ok && r.gift.paidThrough?.toISOString()).toBe("2027-01-10T12:00:00.000Z");
  });

  it("stacks after a period the recipient already paid for", () => {
    const paid = new Date("2026-11-01T00:00:00Z");
    const r = redeemGift(gift("prepaid_1m"), NOW, paid);
    expect(r.ok && r.startsOn).toEqual(paid);
    expect(r.ok && r.gift.paidThrough?.toISOString()).toBe("2026-12-01T00:00:00.000Z");
  });

  it("works once, and not after the link lapses or is cancelled", () => {
    const first = redeemGift(gift("prepaid_12m"), NOW);
    expect(first.ok).toBe(true);
    if (first.ok) expect(redeemGift(first.gift, NOW)).toEqual({ ok: false, reason: "already_redeemed" });
    const late = new Date(NOW.getTime() + (UNCLAIMED_DAYS + 1) * 86_400_000);
    expect(redeemGift(gift("prepaid_1m"), late)).toEqual({ ok: false, reason: "unclaimed" });
    expect(redeemGift(gift("prepaid_1m", { status: "cancelled" }), NOW)).toEqual({ ok: false, reason: "cancelled" });
    expect(redeemGift(gift("prepaid_1m", { status: "awaiting_payment" }), NOW)).toEqual({ ok: false, reason: "not_redeemable" });
  });

  it("clamps month ends", () => {
    expect(addMonths(new Date("2027-01-31T00:00:00Z"), 1).toISOString()).toBe("2027-02-28T00:00:00.000Z");
  });
});

describe("cancelling", () => {
  it("refunds an unopened gift in full", () => {
    const r = cancelGift(gift("prepaid_3m"), NOW);
    expect(r.ok && r.refund).toBe("full");
    expect(r.ok && r.gift.status).toBe("cancelled");
  });

  it("can't take back a prepaid gift that's been opened", () => {
    const r = redeemGift(gift("prepaid_3m"), NOW);
    expect(r.ok && cancelGift(r.gift, NOW).ok).toBe(false);
  });

  it("stops a sponsorship at the end of the paid month", () => {
    const r = redeemGift(gift("sponsored_monthly"), NOW);
    if (!r.ok) throw new Error("redeem failed");
    const c = cancelGift(r.gift, NOW);
    expect(c.ok && c.accessUntil).toEqual(r.gift.paidThrough);
    if (!c.ok) throw new Error("cancel failed");
    expect(statusAt(c.gift, NOW)).toBe("active");
    expect(statusAt(c.gift, r.gift.paidThrough!)).toBe("ended");
  });
});

describe("renewal notices", () => {
  it("warns the giver before each sponsorship charge and never shows the recipient payment", () => {
    const r = redeemGift(gift("sponsored_monthly"), NOW);
    if (!r.ok) throw new Error();
    expect(renewalNotices(r.gift)).toEqual([
      { audience: "giver", kind: "renewal_upcoming", sendAt: new Date("2026-11-03T12:00:00Z") },
    ]);
  });

  it("tells the recipient twice and the giver once before a prepaid gift ends", () => {
    const r = redeemGift(gift("prepaid_1m"), NOW);
    if (!r.ok) throw new Error();
    const n = renewalNotices(r.gift);
    expect(n.filter((x) => x.audience === "recipient")).toHaveLength(2);
    expect(n.filter((x) => x.audience === "giver")).toHaveLength(1);
  });
});

describe("gift codes", () => {
  it("generates readable codes and accepts sloppy typing", () => {
    const code = generateGiftCode();
    expect(code).toMatch(/^[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/);
    expect(normalizeGiftCode(code.toLowerCase().replace(/-/g, " "))).toBe(code);
    expect(normalizeGiftCode("O0O0-1111-IIII")).toBeNull();
    expect(hashGiftCode(code)).toHaveLength(64);
    expect(hashGiftCode(code)).not.toContain(code);
  });
});
