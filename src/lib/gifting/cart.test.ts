// @vitest-environment node
import { describe, expect, it } from "vitest";
import { cartTotalCents, MAX_GIFTS_PER_CHECKOUT, parseGiftCart } from "./cart";

const today = "2026-10-12";
const gift = (over: Record<string, unknown> = {}) => ({ planId: "prepaid_12m", recipientName: "Ben", recipientEmail: "Ben@Example.com", message: "Love, Mum", ...over });

describe("gift cart", () => {
  it("keeps each recipient's own plan, email, message and date", () => {
    const r = parseGiftCart({ giverName: "Nana Rose", gifts: [gift(), gift({ planId: "prepaid_1m", recipientName: "Amy", recipientEmail: "amy@example.com", deliverOn: "2026-12-25" })] }, today);
    expect(r).toMatchObject({
      ok: true,
      cart: {
        giverName: "Nana Rose",
        gifts: [
          { plan: { id: "prepaid_12m" }, recipientName: "Ben", recipientEmail: "ben@example.com", message: "Love, Mum", deliverOn: today },
          { plan: { id: "prepaid_1m" }, recipientName: "Amy", deliverOn: "2026-12-25" },
        ],
      },
    });
  });

  it("refuses carts it can't send", () => {
    expect(parseGiftCart({ gifts: [gift()] }, today)).toMatchObject({ ok: false });
    expect(parseGiftCart({ giverName: "N", gifts: [] }, today)).toMatchObject({ ok: false });
    expect(parseGiftCart({ giverName: "N", gifts: Array.from({ length: MAX_GIFTS_PER_CHECKOUT + 1 }, (_, i) => gift({ recipientEmail: `p${i}@example.com` })) }, today)).toMatchObject({ ok: false });
    expect(parseGiftCart({ giverName: "N", gifts: [gift({ planId: "sponsored_monthly" })] }, today)).toMatchObject({ ok: false });
    expect(parseGiftCart({ giverName: "N", gifts: [gift({ recipientEmail: "nope" })] }, today)).toMatchObject({ ok: false });
    expect(parseGiftCart({ giverName: "N", gifts: [gift(), gift({ recipientEmail: "ben@example.com" })] }, today)).toMatchObject({ ok: false });
    expect(parseGiftCart({ giverName: "N", gifts: [gift({ deliverOn: "2027-11-01" })] }, today)).toMatchObject({ ok: false });
  });

  it("sends a past date right away", () => {
    expect(parseGiftCart({ giverName: "N", gifts: [gift({ deliverOn: "2026-01-01" })] }, today)).toMatchObject({ ok: true, cart: { gifts: [{ deliverOn: today }] } });
  });

  it("totals at the admin's prices, and not at all when a gift isn't on sale", () => {
    const r = parseGiftCart({ giverName: "N", gifts: [gift(), gift({ planId: "prepaid_3m", recipientEmail: "amy@example.com" })] }, today);
    if (!r.ok) throw new Error(r.message);
    expect(cartTotalCents(r.cart, { prepaid_12m: 17999, prepaid_3m: 5997 })).toBe(23996);
    expect(cartTotalCents(r.cart, { prepaid_12m: 17999 })).toBeNull();
  });
});
