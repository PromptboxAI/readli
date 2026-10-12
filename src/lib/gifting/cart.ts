import { giftPlan, type GiftPlan } from "./plans";

/**
 * Several Readli Family gifts bought in one checkout (Kevin, 2026-10-12, item 7): each recipient
 * gets their own plan length, email, message and delivery date, and their own gift code to redeem.
 * Pure: the checkout route prices the cart from gift_plans and creates the gifts.
 */
export const MAX_GIFTS_PER_CHECKOUT = 10;
export const PREPAID_PLAN_IDS = ["prepaid_1m", "prepaid_3m", "prepaid_12m"] as const;
export type PrepaidPlanId = (typeof PREPAID_PLAN_IDS)[number];

export interface GiftLine {
  plan: GiftPlan & { id: PrepaidPlanId };
  recipientName: string;
  recipientEmail: string;
  message: string;
  /** YYYY-MM-DD; today means right away. */
  deliverOn: string;
}

export interface GiftCart {
  giverName: string;
  gifts: GiftLine[];
}

export type CartResult = { ok: true; cart: GiftCart } | { ok: false; message: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** Checks a cart from the browser. `today` is YYYY-MM-DD; a gift can be scheduled up to a year ahead. */
export function parseGiftCart(body: unknown, today: string): CartResult {
  const b = (body ?? {}) as { giverName?: unknown; gifts?: unknown };
  const giverName = text(b.giverName, 120);
  if (!giverName) return { ok: false, message: "Add the name your gifts will be from." };
  const raw = Array.isArray(b.gifts) ? b.gifts : [];
  if (raw.length === 0) return { ok: false, message: "Add at least one person to send a gift to." };
  if (raw.length > MAX_GIFTS_PER_CHECKOUT) return { ok: false, message: `You can send up to ${MAX_GIFTS_PER_CHECKOUT} gifts at once.` };

  const gifts: GiftLine[] = [];
  const emails = new Set<string>();
  for (const [i, r] of raw.entries()) {
    const g = (r ?? {}) as Record<string, unknown>;
    const n = raw.length > 1 ? ` for gift ${i + 1}` : "";
    const plan = giftPlan(text(g.planId, 20));
    if (!plan || !(PREPAID_PLAN_IDS as readonly string[]).includes(plan.id)) return { ok: false, message: `Pick one month, three months or a year${n}.` };
    const recipientName = text(g.recipientName, 120);
    if (!recipientName) return { ok: false, message: `Add who the gift is for${n}.` };
    const recipientEmail = text(g.recipientEmail, 200).toLowerCase();
    if (!EMAIL.test(recipientEmail)) return { ok: false, message: `Add a valid email address${n}.` };
    if (emails.has(recipientEmail)) return { ok: false, message: `${recipientEmail} is in your list twice. Send one gift per person.` };
    emails.add(recipientEmail);
    const date = text(g.deliverOn, 10);
    const deliverOn = /^\d{4}-\d{2}-\d{2}$/.test(date) && date > today ? date : today;
    if (deliverOn > addDays(today, 365)) return { ok: false, message: `Pick a delivery date within the next year${n}.` };
    gifts.push({ plan: plan as GiftLine["plan"], recipientName, recipientEmail, message: text(g.message, 300), deliverOn });
  }
  return { ok: true, cart: { giverName, gifts } };
}

/** Total in cents at the given prices; null when any gift in the cart isn't on sale. */
export function cartTotalCents(cart: GiftCart, prices: Partial<Record<PrepaidPlanId, number>>): number | null {
  let total = 0;
  for (const g of cart.gifts) {
    const price = prices[g.plan.id];
    if (!price || price <= 0) return null;
    total += price;
  }
  return total;
}
