import type { SupabaseClient } from "@supabase/supabase-js";
import { PACK_REFUND_DAYS } from "@/lib/content/billing-policy";
import { allIn, rows, run, writeAudit } from "@/lib/lifecycle/db";

/**
 * Purchased credit packs and what each is worth unused (Kevin, 2026-10-12, decisions 1 and 2).
 * Purchased credits never expire while the account is active. A pack is refundable in full on request
 * within PACK_REFUND_DAYS of purchase if none of its credits were used; otherwise only where local law
 * requires it or an admin approves it, for the unused share of the price actually paid. When a plan ends
 * for good (after the recovery window, or on account deletion) unused credits are removed, not refunded. A refunded pack is closed (expires_at set to the refund
 * time), so its credits can't be spent, and stays on record with the refund.
 */

const DAY = 86_400_000;

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

export type PackRefund =
  | { ok: true; cents: number; basis: "unused_within_window" | "approved_partial" }
  | { ok: false; reason: "already_refunded" | "no_payment_record" | "nothing_left" | "window_closed_or_used" };

/** The unused share of what was paid, rounded down to the cent. */
export function unusedValueCents(p: PurchasedPack): number {
  if (p.paidCents === null || p.credits <= 0) return 0;
  return Math.floor((p.paidCents * Math.max(0, Math.min(p.creditsLeft, p.credits))) / p.credits);
}

export function packRefund(p: PurchasedPack, now: Date, approvedPartial: boolean): PackRefund {
  if (p.refundedAt) return { ok: false, reason: "already_refunded" };
  if (p.paidCents === null || !p.paymentRef) return { ok: false, reason: "no_payment_record" };
  if (p.creditsLeft <= 0) return { ok: false, reason: "nothing_left" };
  const unused = p.creditsLeft >= p.credits;
  if (unused && now.getTime() - Date.parse(p.grantedAt) <= PACK_REFUND_DAYS * DAY) return { ok: true, cents: p.paidCents, basis: "unused_within_window" };
  if (approvedPartial) return { ok: true, cents: unusedValueCents(p), basis: "approved_partial" };
  return { ok: false, reason: "window_closed_or_used" };
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
 * Removes a household's unused credits when its plan ends for good (Kevin, 2026-10-12: standard practice
 * is to delete unused credits; no refund unless local law requires one). Every open lot is closed by
 * setting expires_at, so the lots and their ledger stay on record with what was left. Returns the
 * purchased credits removed.
 */
export async function removeUnusedCredits(db: SupabaseClient, householdId: string, at: string): Promise<number> {
  const left = (await purchasedPacks(db, householdId)).filter((p) => !p.refundedAt && p.creditsLeft > 0).reduce((n, p) => n + p.creditsLeft, 0);
  const open = await rows(db.from("narration_credit_lots").select("id, expires_at").eq("household_id", householdId), "read credit lots");
  const closing = open.filter((l) => !l.expires_at || Date.parse(l.expires_at as string) > Date.parse(at)).map((l) => l.id as string);
  for (let i = 0; i < closing.length; i += 200) {
    await run(db.from("narration_credit_lots").update({ expires_at: at }).in("id", closing.slice(i, i + 200)), "remove unused credits");
  }
  return left;
}

export class PackRefundError extends Error {}

const REFUSED: Record<Extract<PackRefund, { ok: false }>["reason"], string> = {
  already_refunded: "That pack was already refunded.",
  no_payment_record: "There's no payment record for that pack, so it can't be refunded from here.",
  nothing_left: "Every credit in that pack has been used.",
  window_closed_or_used: `That pack is past the ${PACK_REFUND_DAYS}-day window or partly used. Tick "approved" if the law requires a refund or it was approved, and say why.`,
};

/**
 * Refunds one purchased pack through Stripe and closes it, so its credits can't be spent afterwards.
 * The refund itself also reaches the finance report through Stripe's charge.refunded event.
 */
export async function refundPack(
  db: SupabaseClient,
  issue: (paymentRef: string, cents: number, key: string) => Promise<{ id: string }>,
  input: { paymentRef: string; approvedPartial: boolean; note: string; admin: string; now: Date },
): Promise<{ cents: number; basis: string; householdId: string }> {
  const [lot] = await rows(db.from("narration_credit_lots").select("id, household_id").eq("payment_ref", input.paymentRef).eq("source", "purchased").limit(1), "find pack");
  if (!lot) throw new PackRefundError("No credit pack was bought with that payment.");
  if (input.approvedPartial && input.note.length < 5) throw new PackRefundError("Say why this refund is approved.");
  const householdId = lot.household_id as string;
  const pack = (await purchasedPacks(db, householdId)).find((p) => p.lotId === lot.id);
  if (!pack) throw new PackRefundError("No credit pack was bought with that payment.");
  const decision = packRefund(pack, input.now, input.approvedPartial);
  if (!decision.ok) throw new PackRefundError(REFUSED[decision.reason]);
  if (decision.cents <= 0) throw new PackRefundError("Nothing is owed on that pack.");
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
      detail: { lot: pack.lotId, payment: input.paymentRef, refund: refund.id, cents: decision.cents, basis: decision.basis, credits_left: pack.creditsLeft, note: input.note || null },
    },
  ]);
  return { cents: decision.cents, basis: decision.basis, householdId };
}
