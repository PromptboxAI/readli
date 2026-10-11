import type { SupabaseClient } from "@supabase/supabase-js";
import { planConfig, type PlanConfig } from "@/lib/family/plan";
import { creditUnits } from "@/lib/narration/credits";
import type { BillingChange } from "./events";
import type { RevenueRow } from "./revenue";

/** Writes a billing change with the service role. Safe to repeat: the same event gives the same rows. */
export async function applyBillingChange(db: SupabaseClient, change: BillingChange, livemode: boolean, plan: PlanConfig = planConfig(), at = new Date()): Promise<void> {
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
    source: "subscription",
    status: change.status,
    tier: change.tier,
    trial_ends_at: change.trialEndsAt,
    extra_narrator_slots: change.extraNarratorSlots,
    provider_subscription_ref: change.subscriptionRef,
    starts_at: change.startsAt,
    ends_at: change.endsAt,
  };
  const { data: existing, error } = await db
    .from("household_entitlements")
    .select("id, tier")
    .eq("provider_subscription_ref", change.subscriptionRef)
    .maybeSingle();
  check({ error }, "read plan");
  const from = (existing?.tier as string | undefined) ?? null;
  if (existing) check(await db.from("household_entitlements").update(row).eq("id", existing.id), "update plan");
  else {
    const { data: earlier, error: historyError } = await db.from("household_entitlements").select("id").eq("household_id", change.householdId).limit(1);
    check({ error: historyError }, "read plan history");
    check(await db.from("household_entitlements").insert(row), "start plan");
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
