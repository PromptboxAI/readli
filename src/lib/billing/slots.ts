import { MAX_EXTRA_SLOTS } from "./checkout";
import type { Params } from "./stripe-api";

/**
 * Adding or removing one extra storyteller slot on a family's own Stripe subscription, after signup.
 * Stripe's billing page can't change slots, so Family storytellers does it here: the slot item's quantity
 * goes up or down by one, and the webhook (or the route, straight after) records the new count.
 */
export type SlotChange = "add" | "remove";

export interface StripeSubItem {
  id: string;
  quantity?: number;
  price?: { id: string; lookup_key?: string | null; recurring?: { interval?: string | null } | null } | null;
}

const SLOT_KEY = "readli_extra_slot_";

/** The plan's billing interval and the slot items already on the subscription. */
export function subscriptionSlots(items: StripeSubItem[]): { interval: "month" | "year"; slotItems: StripeSubItem[]; extra: number } {
  const slotItems = items.filter((i) => i.price?.lookup_key?.startsWith(SLOT_KEY));
  const planItem = items.find((i) => !i.price?.lookup_key?.startsWith(SLOT_KEY));
  const interval = planItem?.price?.recurring?.interval === "year" ? "year" : "month";
  return { interval, slotItems, extra: slotItems.reduce((n, i) => n + (i.quantity ?? 0), 0) };
}

export type SlotUpdate = { ok: true; params: Params } | { ok: false; status: number; code: string; message: string };

/**
 * The subscription update for one slot more or fewer. Adding charges the part of the period that's left
 * straight away, and does nothing if the card is declined. Removing takes the slot off now and credits
 * the unused time on the next bill. `slotPrice` is the slot price matching the plan's interval, used when
 * the subscription has no slot item yet.
 */
export function slotUpdate(items: StripeSubItem[], change: SlotChange, slotPrice: string | null): SlotUpdate {
  const { slotItems, extra } = subscriptionSlots(items);
  if (change === "add") {
    if (extra >= MAX_EXTRA_SLOTS) return { ok: false, status: 409, code: "too_many_slots", message: `A family can add up to ${MAX_EXTRA_SLOTS} extra storyteller slots.` };
    const existing = slotItems[0];
    const item = existing ? { id: existing.id, quantity: (existing.quantity ?? 0) + 1 } : slotPrice ? { price: slotPrice, quantity: 1 } : null;
    if (!item) return { ok: false, status: 503, code: "no_slot_price", message: "Extra storyteller slots can't be added right now. Please try again." };
    return { ok: true, params: { items: [item], proration_behavior: "always_invoice", payment_behavior: "error_if_incomplete" } };
  }
  const from = slotItems.find((i) => (i.quantity ?? 0) > 0);
  if (!from) return { ok: false, status: 409, code: "no_extra_slots", message: "Your plan has no extra storyteller slots to remove." };
  const left = (from.quantity ?? 0) - 1;
  return { ok: true, params: { items: [left > 0 ? { id: from.id, quantity: left } : { id: from.id, deleted: true }], proration_behavior: "create_prorations" } };
}
