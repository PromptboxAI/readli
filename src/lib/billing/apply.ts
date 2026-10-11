import type { SupabaseClient } from "@supabase/supabase-js";
import { planConfig, type PlanConfig } from "@/lib/family/plan";
import { creditUnits } from "@/lib/narration/credits";
import type { BillingChange } from "./events";
import type { RevenueRow } from "./revenue";
import { recordTrialClaim, type TrialStart } from "./trial";

export interface ApplyOptions {
  /** When Stripe created the event. An older event than the one already applied to a plan is skipped. */
  eventAt?: string;
  /** Who started a trial and with which card, read from Stripe and Supabase Auth by the webhook route. */
  trialStart?: (change: Extract<BillingChange, { kind: "subscription" }>) => Promise<TrialStart | null>;
}

/**
 * Writes a billing change with the service role. Successful Stripe events are the source of truth for
 * a household's plan. Safe to repeat: the same event gives the same rows, and an event older than the
 * last one applied to that subscription changes nothing (Stripe doesn't promise delivery order).
 */
export async function applyBillingChange(
  db: SupabaseClient,
  change: BillingChange,
  livemode: boolean,
  plan: PlanConfig = planConfig(),
  at = new Date(),
  opts: ApplyOptions = {},
): Promise<void> {
  if (change.kind === "ignore") return;
  const check = ({ error }: { error: { message: string } | null }, what: string) => {
    if (error) throw new Error(`${what}: ${error.message}`);
  };

  if (change.customerRef) {
    check(
      await db
        .from("billing_customers")
        .upsert({ household_id: change.householdId, provider: "stripe", customer_ref: change.customerRef, livemode }, { onConflict: "household_id" }),
      "link customer",
    );
  }
  if (change.kind === "credit_pack") {
    // Purchased credits, granted once per payment (a unique index on payment_ref backs this up).
    const { data: granted, error } = await db.from("narration_credit_lots").select("id").eq("payment_ref", change.paymentRef).maybeSingle();
    check({ error }, "read credit pack");
    if (granted) return;
    const months = plan.purchasedCreditMonths;
    const expires = months > 0 ? new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + months, at.getUTCDate())).toISOString() : null;
    check(
      await db.from("narration_credit_lots").insert({
        household_id: change.householdId,
        source: "purchased",
        credits: creditUnits(change.credits, plan),
        granted_at: at.toISOString(),
        expires_at: expires,
        note: `Credit pack (${change.credits})`,
        payment_ref: change.paymentRef,
        granted_by: change.adultId,
      }),
      "grant credit pack",
    );
    return;
  }
  if (change.kind !== "subscription") return;

  const row = {
    household_id: change.householdId,
    // One row covers a trial and the paid plan it becomes; trial_ends_at marks the trial.
    source: "subscription",
    status: change.status,
    tier: change.tier,
    trial_ends_at: change.trialEndsAt,
    extra_narrator_slots: change.extraNarratorSlots,
    billing_interval: change.billingInterval,
    provider_subscription_ref: change.subscriptionRef,
    starts_at: change.startsAt,
    ends_at: change.endsAt,
    ...(opts.eventAt ? { billing_event_at: opts.eventAt } : {}),
  };
  const { data: existing, error } = await db
    .from("household_entitlements")
    .select("id, tier, billing_event_at")
    .eq("provider_subscription_ref", change.subscriptionRef)
    .maybeSingle();
  check({ error }, "read plan");
  const from = (existing?.tier as string | undefined) ?? null;
  const last = existing?.billing_event_at as string | null | undefined;
  if (existing && opts.eventAt && last && Date.parse(last) > Date.parse(opts.eventAt)) return;
  if (existing) check(await db.from("household_entitlements").update(row).eq("id", existing.id), "update plan");
  else {
    const { data: earlier, error: historyError } = await db.from("household_entitlements").select("id").eq("household_id", change.householdId).limit(1);
    check({ error: historyError }, "read plan history");
    check(await db.from("household_entitlements").insert(row), "start plan");
    if (change.trialEndsAt && change.status === "active" && opts.trialStart) await claimTrial(db, change, await opts.trialStart(change));
    // Welcome credits for a family's very first plan, if the admin turned them on (they never expire unless set to).
    if (!earlier?.length && plan.welcomePromoCredits > 0) {
      check(
        await db.from("narration_credit_lots").insert({
          household_id: change.householdId,
          source: "promotional",
          credits: creditUnits(plan.welcomePromoCredits, plan),
          granted_at: at.toISOString(),
          expires_at: plan.welcomePromoDays > 0 ? new Date(at.getTime() + plan.welcomePromoDays * 86_400_000).toISOString() : null,
          note: "Welcome credits for your first stories",
        }),
        "grant welcome credits",
      );
    }
  }

  if (from && from !== change.tier) {
    // Moving to the Archive stops narration still being prepared and refunds what it hadn't used.
    const stopped = change.tier === "archive" ? Number((await db.rpc("stop_household_narration", { p_household: change.householdId })).data ?? 0) : 0;
    await logLifecycle(db, { actor: "stripe", action: "plan_changed", household_id: change.householdId, detail: { from, to: change.tier, stopped_jobs: stopped, via: "stripe" } });
  }
  if (change.status === "active") {
    // A family back on a plan inside its recovery window keeps everything.
    const { data: restored } = await db
      .from("household_recovery")
      .update({ status: "restored", restored_at: at.toISOString(), restored_tier: change.tier })
      .eq("household_id", change.householdId)
      .in("status", ["recovering", "held"])
      .select("household_id");
    if (restored?.length) await logLifecycle(db, { actor: "stripe", action: "recovery_restored", household_id: change.householdId, detail: { tier: change.tier } });
  }
}

/**
 * Records the trial claim. A card that already started a trial for another household keeps Readli
 * Family but not the free trial credits, and the case goes to the admin exception queue.
 */
async function claimTrial(db: SupabaseClient, change: Extract<BillingChange, { kind: "subscription" }>, start: TrialStart | null): Promise<void> {
  if (!start) return;
  const { withheld } = await recordTrialClaim(db, start);
  if (!withheld) return;
  const { error } = await db.from("household_entitlements").update({ trial_credits: 0 }).eq("provider_subscription_ref", change.subscriptionRef);
  if (error) throw new Error(`withhold trial credits: ${error.message}`);
  const { error: queueError } = await db.from("lifecycle_exceptions").insert({
    kind: "trial_card_reused",
    household_id: change.householdId,
    reason: "The card that started this trial already started one for another household.",
    detail: { subscription: change.subscriptionRef },
  });
  if (queueError) console.error("exception queue write failed", queueError.message);
}

/** Best effort: a missing lifecycle log (before its migration runs) never fails a billing event. */
async function logLifecycle(db: SupabaseClient, entry: { actor: string; action: string; household_id: string; detail: Record<string, unknown> }) {
  const { error } = await db.from("lifecycle_audit_log").insert(entry);
  if (error) console.error("lifecycle log failed", error.message);
}

/** Records revenue for the admin finance report. A row already recorded (a retried event) is skipped. */
export async function recordRevenue(db: SupabaseClient, rows: RevenueRow[]): Promise<void> {
  if (!rows.length) return;
  const { error } = await db.from("revenue_events").upsert(rows, { onConflict: "provider,provider_ref", ignoreDuplicates: true });
  if (error) throw new Error(`record revenue: ${error.message}`);
}
