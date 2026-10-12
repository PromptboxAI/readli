// @vitest-environment node
import { describe, expect, it } from "vitest";
import { applyGiftCheckout, giftCheckoutChange } from "@/lib/billing/gifts";
import { hashGiftCode } from "./codes.server";
import { deliverDueGifts, type GiftEmail } from "./delivery";
import { fakeGiftsDb } from "./fake-db.test-util";

const G1 = "11111111-1111-4111-8111-111111111111";
const G2 = "22222222-2222-4222-8222-222222222222";
const gift = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  giver_id: "nana",
  plan_id: "prepaid_12m",
  status: "awaiting_payment",
  code_hash: `unsent_${id}`,
  recipient_name: "Ben",
  recipient_email: "ben@example.com",
  giver_display_name: "Nana Rose",
  message: "Love you",
  deliver_on: "2026-10-12",
  ...over,
});
const session = (type: string, over: Record<string, unknown> = {}) => ({
  type,
  data: { object: { mode: "payment", payment_status: "paid", payment_intent: "pi_1", metadata: { item: "gifts", adult_id: "nana", gift_ids: `${G1},${G2}` }, ...over } },
});

describe("gift checkout in the webhook", () => {
  it("schedules the giver's gifts once paid, and only once", async () => {
    const { db, rows } = fakeGiftsDb([gift(G1), gift(G2), gift("33333333-3333-4333-8333-333333333333", { giver_id: "someone-else" })]);
    await applyGiftCheckout(db, giftCheckoutChange(session("checkout.session.completed")));
    await applyGiftCheckout(db, giftCheckoutChange(session("checkout.session.completed", { payment_intent: "pi_2" })));
    expect(rows.map((r) => [r.status, r.payment_ref])).toEqual([
      ["scheduled", "pi_1"],
      ["scheduled", "pi_1"],
      ["awaiting_payment", undefined],
    ]);
  });

  it("cancels gifts from an abandoned checkout, and ignores anything that isn't a gift checkout", async () => {
    const { db, rows } = fakeGiftsDb([gift(G1), gift(G2)]);
    await applyGiftCheckout(db, giftCheckoutChange(session("checkout.session.expired", { payment_status: "unpaid" })));
    expect(rows.map((r) => r.status)).toEqual(["cancelled", "cancelled"]);
    expect(giftCheckoutChange(session("checkout.session.completed", { metadata: { item: "credit_pack:small" } }))).toBeNull();
    expect(giftCheckoutChange(session("checkout.session.completed", { payment_status: "unpaid" }))).toBeNull();
    expect(giftCheckoutChange(session("checkout.session.completed", { metadata: { item: "gifts", adult_id: "nana", gift_ids: "not-an-id" } }))).toBeNull();
  });
});

describe("gift delivery", () => {
  it("emails each due gift its own code and keeps only the hash", async () => {
    const { db, rows } = fakeGiftsDb([gift(G1, { status: "scheduled" }), gift(G2, { status: "scheduled", deliver_on: "2026-12-25" })]);
    const sent: GiftEmail[] = [];
    const result = await deliverDueGifts(db, { sendGift: async (e) => void sent.push(e) }, new Date("2026-10-12T09:00:00Z"));
    expect(result).toEqual({ sent: 1, failed: 0 });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: "ben@example.com", giverName: "Nana Rose", planName: "A whole year" });
    expect(rows[0]).toMatchObject({ status: "sent", code_hash: hashGiftCode(sent[0]!.code) });
    expect(rows[1]!.status).toBe("scheduled");
    // A second run finds nothing new to send.
    expect(await deliverDueGifts(db, { sendGift: async (e) => void sent.push(e) }, new Date("2026-10-12T10:00:00Z"))).toEqual({ sent: 0, failed: 0 });
  });

  it("puts a gift back when its email fails, so the next run tries again", async () => {
    const { db, rows } = fakeGiftsDb([gift(G1, { status: "scheduled" })]);
    const result = await deliverDueGifts(db, { sendGift: async () => Promise.reject(new Error("bounce")) }, new Date("2026-10-12T09:00:00Z"));
    expect(result).toEqual({ sent: 0, failed: 1 });
    expect(rows[0]).toMatchObject({ status: "scheduled", code_hash: `unsent_${G1}`, sent_at: null });
  });
});
