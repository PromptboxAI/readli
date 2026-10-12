import type { SupabaseClient } from "@supabase/supabase-js";
import { openException } from "@/lib/lifecycle/cleanup";
import { allIn, rows, run, writeAudit } from "@/lib/lifecycle/db";

/**
 * Purchased credit packs and the narrow refund and forfeiture exceptions (Kevin, 2026-10-12, "Final Credit
 * Refund, Data Retention and Provider Configuration Decisions"). There is no voluntary refund program:
 * credits aren't refundable, including on cancellation. A pack is refunded only to correct a duplicate
 * charge or a billing error, or where the law requires it, always with a written reason. When a plan ends
 * for good (after the 30-day recovery window, or on account deletion) unused credits are removed, but
 * purchased credits are only removed once LIFECYCLE_CREDIT_FORFEITURE is on, after counsel has checked the
 * prepaid-balance and refund laws; until then they are held and an admin exception records them.
 * A refunded or removed pack is closed (expires_at set), so its credits can't be spent, and stays on record.
 */

export interface PurchasedPack {
  lotId: string;
  credits: number;
  creditsLeft: number;
  grantedAt: string;
  paymentRef: string | null;
  /** What the customer actually paid for the pack, from the payment record; null if there is none. */
  paidCents: number | null;
  refundedAt: string | null;
}

/** Why a pack may be refunded. Nothing else qualifies. */
export const REFUND_BASES = ["duplicate_charge", "billing_error", "legally_required"] as const;
export type RefundBasis = (typeof REFUND_BASES)[number];

export type PackRefund =
  | { ok: true; cents: number; basis: RefundBasis }
  | { ok: false; reason: "already_refunded" | "no_payment_record" | "nothing_left" | "too_much" };

/** The unused share of what was paid, rounded down to the cent. */
export function unusedValueCents(p: PurchasedPack): number {
  if (p.paidCents === null || p.credits <= 0) return 0;
  return Math.floor((p.paidCents * Math.max(0, Math.min(p.creditsLeft, p.credits))) / p.credits);
}

/**
 * How much a qualifying refund is: a duplicate charge or billing error defaults to what was paid; a legally
 * required refund defaults to the unused share. An admin may enter a smaller amount, never more than was paid.
 */
export function packRefund(p: PurchasedPack, basis: RefundBasis, requestedCents: number | null = null): PackRefund {
  if (p.refundedAt) return { ok: false, reason: "already_refunded" };
  if (p.paidCents === null || !p.paymentRef) return { ok: false, reason: "no_payment_record" };
  const cents = requestedCents ?? (basis === "legally_required" ? unusedValueCents(p) : p.paidCents);
  if (cents > p.paidCents) return { ok: false, reason: "too_much" };
  if (cents <= 0) return { ok: false, reason: "nothing_left" };
  return { ok: true, cents, basis };
}

/** A household's purchased packs with what is left in each, oldest first. */
export async function purchasedPacks(db: SupabaseClient, householdId: string): Promise<PurchasedPack[]> {
  const lots = await rows(
    db.from("narration_credit_lots").select("id, credits, granted_at, payment_ref, refunded_at").eq("household_id", householdId).eq("source", "purchased").order("granted_at", { ascending: true }),
    "read purchased credits",
  );
  if (!lots.length) return [];
  const ledger = await allIn(db, "narration_credit_ledger", "lot_id, kind, credits", "lot_id", lots.map((l) => l.id as string), "read credit ledger");
  const refs = lots.map((l) => l.payment_ref).filter((r): r is string => typeof r === "string");
  const paid = await allIn(db, "revenue_events", "provider_ref, amount_cents, kind", "provider_ref", refs, "read pack payments");
  return lots.map((l) => {
    const used = ledger.filter((e) => e.lot_id === l.id).reduce((n, e) => n + (e.kind === "reserve" ? (e.credits as number) : e.kind === "refund" ? -(e.credits as number) : 0), 0);
    const payment = paid.find((r) => r.provider_ref === l.payment_ref && r.kind === "credit_pack" && (r.amount_cents as number) > 0);
    return {
      lotId: l.id as string,
      credits: l.credits as number,
      creditsLeft: Math.max(0, (l.credits as number) - used),
      grantedAt: l.granted_at as string,
      paymentRef: (l.payment_ref as string | null) ?? null,
      paidCents: payment ? (payment.amount_cents as number) : null,
      refundedAt: (l.refunded_at as string | null) ?? null,
    };
  });
}

/**
 * Ends a household's unused credits when its plan ends for good. Subscription, trial and bonus credits are
 * closed at once. Purchased credits are closed only with `forfeitPurchased` (LIFECYCLE_CREDIT_FORFEITURE=on,
 * or an admin confirming a held exception); otherwise they stay open and are reported as held, so a
 * legally required refund or preservation is still possible. Lots and their ledger stay on record.
 */
export async function removeUnusedCredits(
  db: SupabaseClient,
  householdId: string,
  at: string,
  opts: { forfeitPurchased: boolean },
): Promise<{ purchasedRemoved: number; purchasedHeld: number }> {
  const left = (await purchasedPacks(db, householdId)).filter((p) => !p.refundedAt && p.creditsLeft > 0).reduce((n, p) => n + p.creditsLeft, 0);
  const open = await rows(db.from("narration_credit_lots").select("id, source, expires_at").eq("household_id", householdId), "read credit lots");
  const closing = open
    .filter((l) => !l.expires_at || Date.parse(l.expires_at as string) > Date.parse(at))
    .filter((l) => opts.forfeitPurchased || l.source !== "purchased")
    .map((l) => l.id as string);
  for (let i = 0; i < closing.length; i += 200) {
    await run(db.from("narration_credit_lots").update({ expires_at: at }).in("id", closing.slice(i, i + 200)), "remove unused credits");
  }
  return opts.forfeitPurchased ? { purchasedRemoved: left, purchasedHeld: 0 } : { purchasedRemoved: 0, purchasedHeld: left };
}

/** Opens the admin exception for purchased credits held back from removal. */
export async function holdPurchasedCredits(db: SupabaseClient, householdId: string, credits: number, context: string): Promise<void> {
  if (credits <= 0) return;
  await openException(db, {
    kind: "purchased_credits_held",
    householdId,
    reason: `${credits} purchased credits were left when this household's plan ended for good (${context}). Check whether the law where the customer lives requires keeping them or a refund; refund from Finance if so, otherwise remove them.`,
    detail: { credits, context },
  });
}

/** An admin confirmed held purchased credits can be removed: closes them, records it and resolves the exception. */
export async function forfeitHeldCredits(db: SupabaseClient, householdId: string, input: { admin: string; note: string; now: Date }): Promise<number> {
  const at = input.now.toISOString();
  const { purchasedRemoved } = await removeUnusedCredits(db, householdId, at, { forfeitPurchased: true });
  await writeAudit(db, [{ actor: input.admin, action: "credits_forfeited", householdId, detail: { credits: purchasedRemoved, note: input.note || null } }]);
  await run(
    db.from("lifecycle_exceptions").update({ status: "resolved", resolved_at: at, resolution: `Credits removed: ${input.note || "no legal requirement found"}` }).eq("kind", "purchased_credits_held").eq("household_id", householdId).eq("status", "open"),
    "resolve held credits",
  );
  return purchasedRemoved;
}

export class PackRefundError extends Error {}

const REFUSED: Record<Extract<PackRefund, { ok: false }>["reason"], string> = {
  already_refunded: "That pack was already refunded.",
  no_payment_record: "There's no payment record for that pack, so it can't be refunded from here.",
  nothing_left: "Every credit in that pack has been used, so there's no unused share. Enter the amount the law requires.",
  too_much: "That's more than was paid for the pack.",
};

/**
 * Refunds one purchased pack through Stripe, only for a duplicate charge, a billing error or a legally
 * required refund, and closes it so its credits can't be spent afterwards. The refund also reaches the
 * finance report through Stripe's charge.refunded event.
 */
export async function refundPack(
  db: SupabaseClient,
  issue: (paymentRef: string, cents: number, key: string) => Promise<{ id: string }>,
  input: { paymentRef: string; basis: RefundBasis; cents: number | null; note: string; admin: string; now: Date },
): Promise<{ cents: number; basis: RefundBasis; householdId: string }> {
  if (!REFUND_BASES.includes(input.basis)) throw new PackRefundError("Choose why this refund is owed.");
  if (input.note.trim().length < 5) throw new PackRefundError("Say why this refund is owed.");
  const [lot] = await rows(db.from("narration_credit_lots").select("id, household_id").eq("payment_ref", input.paymentRef).eq("source", "purchased").limit(1), "find pack");
  if (!lot) throw new PackRefundError("No credit pack was bought with that payment.");
  const householdId = lot.household_id as string;
  const pack = (await purchasedPacks(db, householdId)).find((p) => p.lotId === lot.id);
  if (!pack) throw new PackRefundError("No credit pack was bought with that payment.");
  const decision = packRefund(pack, input.basis, input.cents);
  if (!decision.ok) throw new PackRefundError(REFUSED[decision.reason]);
  const refund = await issue(input.paymentRef, decision.cents, `pack-refund:${pack.lotId}`);
  const at = input.now.toISOString();
  await run(
    db.from("narration_credit_lots").update({ refunded_at: at, refunded_cents: decision.cents, refund_ref: refund.id, expires_at: at }).eq("id", pack.lotId),
    "close refunded pack",
  );
  await writeAudit(db, [
    {
      actor: input.admin,
      action: "credit_pack_refunded",
      householdId,
      detail: { lot: pack.lotId, payment: input.paymentRef, refund: refund.id, cents: decision.cents, basis: decision.basis, credits_left: pack.creditsLeft, note: input.note },
    },
  ]);
  return { cents: decision.cents, basis: decision.basis, householdId };
}
