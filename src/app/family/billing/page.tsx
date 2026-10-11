import type { SupabaseClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import Link from "next/link";
import { buttonSecondary } from "@/components/brand/buttons";
import { ManagePlan, StartPlan } from "@/components/family/BillingActions";
import { FamilyOff, FamilyShell, NeedsGrownUp, PreviewNote } from "@/components/family/FamilyShell";
import { trialDaysFor } from "@/lib/billing/checkout";
import { billingConfig } from "@/lib/billing/config";
import { effectivePlan } from "@/lib/billing/price-settings";
import { billingSummary, type BillingSummary } from "@/lib/billing/summary";
import { accountDb } from "@/lib/family/account-store";
import { familyPage } from "@/lib/family/page-data";
import { formatPrice } from "@/lib/family/plan";
import { guardianHousehold } from "@/lib/family/service";
import { familyStore } from "@/lib/family/session";
import { rewardsConfig } from "@/lib/rewards/rewards";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Plan and billing | Readli", robots: { index: false } };

const NOT_GUARDIAN = "Only a parent or guardian can see your family's plan and billing.";
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

const PLAN_NAMES: Record<BillingSummary["plan"], string> = {
  none: "No plan yet",
  trial: "Readli Family free trial",
  subscription: "Readli Family",
  gift: "Readli Family (a gift)",
  donated: "Readli Family (complimentary)",
  tester: "Readli Family (tester plan)",
};

async function hasStripePlan(db: SupabaseClient | null, householdId: string): Promise<boolean> {
  if (!db) return false;
  const { data } = await db
    .from("household_entitlements")
    .select("id")
    .eq("household_id", householdId)
    .eq("status", "active")
    .not("provider_subscription_ref", "is", null)
    .limit(1);
  return (data ?? []).length > 0;
}

function planNote(s: BillingSummary): string {
  if (s.plan === "none") return "Start Readli Family to set up kids profiles, add family storytellers and prepare stories.";
  if (s.plan === "trial") return s.endsAt ? `Your trial ends ${day(s.endsAt)}.` : "You're on a free trial.";
  if (s.plan === "gift") return s.endsAt ? `Someone special covered your plan until ${day(s.endsAt)}. It won't turn into a paid plan when it ends.` : "Someone special is covering your plan.";
  if (s.plan === "subscription") return s.endsAt ? `Canceled. Your plan stays on until ${day(s.endsAt)}.` : "Renews automatically. You can cancel any time.";
  return s.endsAt ? `Your plan runs until ${day(s.endsAt)}.` : "Your plan has no end date.";
}

/** A parent's plan: what they have, what it costs, and where to change it. Children never reach it. */
export default async function BillingPage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const q = await searchParams;
  const page = await familyPage();
  if (!page.enabled) return <FamilyOff />;
  if (page.session?.actor.kind !== "adult") return <NeedsGrownUp text={NOT_GUARDIAN} />;
  const store = (await familyStore(page.session))!;
  const householdId = await guardianHousehold(store, page.session.actor);
  if (!householdId) return <NeedsGrownUp text={NOT_GUARDIAN} />;
  const plan = await effectivePlan(page.session.account ? accountDb() : null, store.plan);
  const state = await store.read();
  const s = billingSummary(state, plan, householdId);
  const paymentsOn = billingConfig().mode !== "off";
  const rewards = rewardsConfig();
  // A trial started through checkout is already a Stripe subscription: it's managed, not bought again.
  const stripePlan = s.plan === "trial" && (await hasStripePlan(page.session.account ? accountDb() : null, householdId));

  return (
    <FamilyShell>
      <PreviewNote />
      <header className="flex flex-col gap-2">
        <Link href="/family" className="w-fit font-display font-semibold underline-offset-4 hover:underline">
          ← Family
        </Link>
        <h1 className="font-display text-4xl font-semibold">Plan and billing</h1>
      </header>
      {q.checkout === "success" && (
        <p role="status" className="rounded-2xl bg-mint/40 px-4 py-3">
          Thank you! Your plan starts within a minute or so.
        </p>
      )}
      {q.checkout === "canceled" && <p role="status" className="rounded-2xl bg-surface px-4 py-3 ring-2 ring-ink/10">Checkout was canceled. Nothing was charged.</p>}

      <section className="flex flex-col gap-2 rounded-[var(--radius-panel)] bg-surface p-6 ring-2 ring-ink/10" aria-labelledby="plan-h" data-testid="current-plan">
        <h2 id="plan-h" className="font-display text-2xl font-semibold">{PLAN_NAMES[s.plan]}</h2>
        <p>{planNote(s)}</p>
        {s.plan !== "none" && (
          <p>
            {s.narratorSlots} storyteller {s.narratorSlots === 1 ? "slot" : "slots"}
            {s.extraNarratorSlots > 0 ? ` (${s.extraNarratorSlots} extra${s.extraSlotsMonthlyCents ? `, ${formatPrice(s.extraSlotsMonthlyCents)} a month` : ""})` : ""}.
          </p>
        )}
        {stripePlan && <p>Readli Family starts on the card you added when the trial ends, unless you cancel first.</p>}
        {(s.plan === "subscription" || stripePlan) && <ManagePlan paymentsOn={paymentsOn} />}
      </section>

      {s.canStartPlan && !stripePlan && (
        <section className="flex flex-col gap-3" aria-labelledby="start-h">
          <h2 id="start-h" className="font-display text-2xl font-semibold">{s.plan === "none" ? "Start Readli Family" : "Keep Readli Family going"}</h2>
          <StartPlan
            monthlyCents={plan.familyMonthlyPriceCents}
            annualCents={plan.familyAnnualPriceCents}
            slotCents={plan.extraSlotPriceCents}
            slotsForSale={plan.extraSlotPriceApproved}
            includedSlots={plan.includedNarratorSlots}
            paymentsOn={paymentsOn}
            trialDays={s.plan === "none" ? trialDaysFor(state.entitlements, rewards) : 0}
            trialCredits={plan.trialCredits}
          />
        </section>
      )}

      <section className="flex flex-col gap-3" aria-labelledby="more-h">
        <h2 id="more-h" className="font-display text-2xl font-semibold">Storytellers and credits are separate</h2>
        <p>
          A storyteller slot lets one more family voice read to your kids. Narration credits pay for preparing new stories. Storytellers never pay to
          record or share their voice.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/family/credits" className={buttonSecondary}>
            Readli credits
          </Link>
          <Link href="/family/narrators" className={buttonSecondary}>
            Narrator slots
          </Link>
        </div>
      </section>
    </FamilyShell>
  );
}
