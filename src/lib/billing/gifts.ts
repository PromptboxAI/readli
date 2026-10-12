import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Gift checkouts in the Stripe webhook. A gift checkout carries item "gifts", the giver and the ids
 * of the gifts it paid for (created as awaiting_payment before checkout). Paying schedules them for
 * delivery; an abandoned checkout cancels them. Kept apart from plan billing (events.ts, apply.ts).
 */
export type GiftCheckoutChange =
  | { kind: "gifts_paid"; giverId: string; giftIds: string[]; paymentRef: string }
  | { kind: "gifts_abandoned"; giverId: string; giftIds: string[] };

type Obj = Record<string, unknown>;
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const ref = (v: unknown): string | null => str(v) ?? str((v as Obj | null)?.id);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function giftCheckoutChange(event: { type: string; data?: { object?: Obj } }): GiftCheckoutChange | null {
  const obj = event.data?.object;
  if (!obj || obj.mode !== "payment") return null;
  const meta = (obj.metadata as Obj | undefined) ?? {};
  if (meta.item !== "gifts") return null;
  const giverId = str(meta.adult_id);
  const giftIds = (str(meta.gift_ids) ?? "").split(",").filter((id) => UUID.test(id));
  if (!giverId || giftIds.length === 0) return null;
  if (event.type === "checkout.session.completed" && obj.payment_status === "paid") {
    const paymentRef = ref(obj.payment_intent) ?? str(obj.id);
    return paymentRef ? { kind: "gifts_paid", giverId, giftIds, paymentRef } : null;
  }
  if (event.type === "checkout.session.expired") return { kind: "gifts_abandoned", giverId, giftIds };
  return null;
}

/** Applies a gift checkout. Only the giver's own gifts still awaiting payment change, so repeats do nothing. */
export async function applyGiftCheckout(db: SupabaseClient, change: GiftCheckoutChange | null): Promise<void> {
  if (!change) return;
  const update = change.kind === "gifts_paid" ? { status: "scheduled", payment_ref: change.paymentRef } : { status: "cancelled" };
  const { error } = await db.from("gifts").update(update).in("id", change.giftIds).eq("giver_id", change.giverId).eq("status", "awaiting_payment");
  if (error) throw new Error(`${change.kind === "gifts_paid" ? "schedule" : "cancel"} gifts: ${error.message}`);
}
