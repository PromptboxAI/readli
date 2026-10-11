import type { SupabaseClient } from "@supabase/supabase-js";
import type { BillingChange } from "./events";

/** Writes a billing change with the service role. Safe to repeat: the same event gives the same rows. */
export async function applyBillingChange(db: SupabaseClient, change: BillingChange, livemode: boolean): Promise<void> {
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
  if (change.kind !== "subscription") return;

  const row = {
    household_id: change.householdId,
    source: "subscription",
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
