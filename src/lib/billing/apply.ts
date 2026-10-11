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
    source: change.trial ? "trial" : "subscription",
    status: change.status,
    extra_narrator_slots: change.extraNarratorSlots,
    provider_subscription_ref: change.subscriptionRef,
    starts_at: change.startsAt,
    ends_at: change.endsAt,
  };
  const { data: existing, error } = await db
    .from("household_entitlements")
    .select("id")
    .eq("provider_subscription_ref", change.subscriptionRef)
    .maybeSingle();
  check({ error }, "read plan");
  if (existing) check(await db.from("household_entitlements").update(row).eq("id", existing.id), "update plan");
  else check(await db.from("household_entitlements").insert(row), "start plan");
}

/** Records revenue for the admin finance report. A row already recorded (a retried event) is skipped. */
export async function recordRevenue(db: SupabaseClient, rows: RevenueRow[]): Promise<void> {
  if (!rows.length) return;
  const { error } = await db.from("revenue_events").upsert(rows, { onConflict: "provider,provider_ref", ignoreDuplicates: true });
  if (error) throw new Error(`record revenue: ${error.message}`);
}
