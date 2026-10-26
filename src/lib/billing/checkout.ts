import type { HouseholdEntitlement } from "@/lib/family/model";
import type { PlanConfig } from "@/lib/family/plan";
import { catalogItem, type CatalogItem } from "./catalog";

/** What a parent asked to buy, checked against the plan and the household's current entitlement. */
export type CheckoutRequest =
  | { ok: true; mode: "subscription"; plan: CatalogItem; extraSlots: number; startsAfter: string | null }
  | { ok: true; mode: "payment"; pack: CatalogItem }
  | { ok: false; status: number; code: string; message: string };

export const MAX_EXTRA_SLOTS = 4;

export function checkoutRequest(plan: PlanConfig, entitlement: HouseholdEntitlement | null, item: string, extraSlots: unknown = 0): CheckoutRequest {
  const no = (status: number, code: string, message: string): CheckoutRequest => ({ ok: false, status, code, message });
  const chosen = catalogItem(plan, item);
  if (!chosen || chosen.id === "extra_slot") return no(400, "bad_item", "Pick Readli Family or a credit pack.");

  if (chosen.id === "family_monthly" || chosen.id === "family_annual") {
    // A trial or tester plan can upgrade to a paid one; a paid, gifted or donated plan can't buy a second.
    // A sponsored family can line up its own plan once the gift's end is known; it starts charging then.
    if (entitlement?.source === "sponsored" && !entitlement.endsAt) return no(409, "gift_covers_you", "A family gift already covers your Readli Family.");
    if (entitlement && !["trial", "tester", "sponsored"].includes(entitlement.source)) return no(409, "already_on_plan", "Your family already has Readli Family.");
    const slots = Number(extraSlots ?? 0);
    if (!Number.isInteger(slots) || slots < 0 || slots > MAX_EXTRA_SLOTS) return no(400, "bad_slots", `Add between 0 and ${MAX_EXTRA_SLOTS} extra storyteller slots.`);
    if (slots > 0 && !plan.extraSlotPriceApproved) return no(403, "slots_not_for_sale", "Extra storyteller slots aren't on sale yet.");
    return { ok: true, mode: "subscription", plan: chosen, extraSlots: slots, startsAfter: entitlement?.source === "sponsored" ? entitlement.endsAt : null };
  }

  // Credit packs: only for families with Readli Family, so they're never a way into the library.
  if (!plan.narrationPurchasesEnabled) return no(403, "purchases_off", "Buying Readli credits isn't switched on yet.");
  if (!entitlement) return no(403, "needs_family", "Credit packs are for families with Readli Family.");
  return { ok: true, mode: "payment", pack: chosen };
}

const INVITATION_RETURN = /^\/v\/[A-Za-z0-9_-]{20,64}\/connect$/;

/**
 * Where Stripe sends the parent back. A Family checkout started from an invitation's guided steps
 * returns to them, so the invitation survives Stripe and the webhook; only for an invitation this
 * household accepted, and only to an invitation's connect page. Family signup returns to setup. Stripe
 * fills in the session id, which the thank-you page's pixel event shares with the webhook's.
 */
export function checkoutReturn(origin: string, opts: { fromSignup: boolean; invitationId: string | null; returnPath: unknown }): { success: string; cancel: string } {
  if (opts.invitationId && typeof opts.returnPath === "string" && INVITATION_RETURN.test(opts.returnPath)) {
    return { success: `${origin}${opts.returnPath}?checkout=success&session_id={CHECKOUT_SESSION_ID}`, cancel: `${origin}${opts.returnPath}?checkout=canceled` };
  }
  if (opts.fromSignup) return { success: `${origin}/family/setup?checkout=success&session_id={CHECKOUT_SESSION_ID}`, cancel: `${origin}/signup/family?checkout=canceled` };
  return { success: `${origin}/family/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`, cancel: `${origin}/family/billing?checkout=canceled` };
}

/** Stripe needs a trial end at least two days out; a gift ending sooner than that just hands straight over. */
const MIN_DEFERRAL_MS = 49 * 3_600_000;

/**
 * subscription_data for a Family checkout. A plan bought while a gift is ending charges nothing until
 * the gift's last day has passed, so nobody pays twice; its plan row starts then too (starts_after).
 */
export function deferredStart(startsAfter: string | null, now = new Date()): { trial_end?: number; metadata?: { starts_after: string } } {
  if (!startsAfter || Date.parse(startsAfter) <= now.getTime()) return {};
  return {
    ...(Date.parse(startsAfter) - now.getTime() >= MIN_DEFERRAL_MS ? { trial_end: Math.floor(Date.parse(startsAfter) / 1000) } : {}),
    metadata: { starts_after: startsAfter },
  };
}
