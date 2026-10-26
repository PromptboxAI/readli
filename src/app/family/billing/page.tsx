import type { Metadata } from "next";
import Link from "next/link";
import { buttonSecondary } from "@/components/brand/buttons";
import { CheckoutDone, ManagePlan, StartPlan } from "@/components/family/BillingActions";
import { FamilyOff, FamilyShell, NeedsGrownUp, PreviewNote } from "@/components/family/FamilyShell";
import { billingConfig } from "@/lib/billing/config";
import { effectivePlan } from "@/lib/billing/price-settings";
import { billingSummary, type BillingSummary } from "@/lib/billing/summary";
import { accountDb } from "@/lib/family/account-store";
import { familyPage } from "@/lib/family/page-data";
import { formatPrice } from "@/lib/family/plan";
import { guardianHousehold } from "@/lib/family/service";
import { familyStore } from "@/lib/family/session";
import { BackLink } from "@/components/family/BackLink";
import { householdGift, type HouseholdGift } from "@/lib/sponsorship/view";

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
  sponsored: "Readli Family (a gift)",
};

function planNote(s: BillingSummary): string {
  if (s.plan === "none") return "Start Readli Family to set up kids profiles, add family storytellers and prepare stories.";
  if (s.plan === "trial") return s.endsAt ? `Your trial ends ${day(s.endsAt)}.` : "You're on a free trial.";
  if (s.plan === "gift") return s.endsAt ? `Someone special covered your plan until ${day(s.endsAt)}. It won't turn into a paid plan when it ends.` : "Someone special is covering your plan.";
  if (s.plan === "sponsored") {
    return s.endsAt
      ? `Your gift ends on ${day(new Date(Date.parse(s.endsAt) - 86_400_000).toISOString())}. Listening pauses on ${day(s.endsAt)} unless you choose a plan. Your children's profiles, approvals and progress are kept.`
      : "A family member is covering your plan. You still decide who each child hears.";
  }
  if (s.plan === "subscription") return s.endsAt ? `Canceled. Your plan stays on until ${day(s.endsAt)}.` : "Renews automatically. You can cancel any time.";
  return s.endsAt ? `Your plan runs until ${day(s.endsAt)}.` : "Your plan has no end date.";
}

/** A parent's plan: what they have, what it costs, and where to change it. Children never reach it. */
/** The family's gift, as its parents see it. Never anything about the sponsor's other family. */
function GiftCard({ gift, ends }: { gift: HouseholdGift; ends: string | null }) {
  const from = gift.giverName;
  const lastDay = ends ? day(new Date(Date.parse(ends) - 86_400_000).toISOString()) : null;
  return (
    <section className="flex flex-col gap-2 rounded-[var(--radius-panel)] bg-sunshine/30 p-6" aria-labelledby="gift-h" data-testid="family-gift">
      <h2 id="gift-h" className="font-display text-2xl font-semibold">
        Readli Family, a gift from {from}
      </h2>
      <p>
        {gift.startsAt ? `Covered by ${from} from ${day(gift.startsAt)}` : `Covered by ${from}`}
        {lastDay ? ` to ${lastDay}.` : `, for as long as ${from} keeps it going.`}
      </p>
      <p>
        {gift.creditShare} story credits a month: your share of {from}&apos;s 40.
        {gift.nextShare !== null && gift.nextFrom && gift.nextShare !== gift.creditShare ? ` From ${day(gift.nextFrom)}, ${gift.nextShare} a month.` : ""}
      </p>
      <p className="text-sm">Only your family&apos;s parents can change who each child hears. {from} sees whether their voice is approved, never your children&apos;s names or books.</p>
      {lastDay && ends && (
        <div className="mt-2 flex flex-col gap-1 rounded-2xl bg-surface p-4 text-sm">
          <p className="font-semibold">
            {from}&apos;s gift ends on {lastDay}. Listening pauses on {day(ends)} unless you choose a plan.
          </p>
          <p>Your children&apos;s profiles, approvals and progress are kept. Stories in {from}&apos;s voice stay with your family as long as {from} keeps sharing their voice with you.</p>
        </div>
      )}
    </section>
  );
}

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ checkout?: string; session_id?: string; gift?: string }> }) {
  const q = await searchParams;
  const page = await familyPage();
  if (!page.enabled) return <FamilyOff />;
  if (page.session?.actor.kind !== "adult") return <NeedsGrownUp text={NOT_GUARDIAN} />;
  const store = (await familyStore(page.session))!;
  const householdId = await guardianHousehold(store, page.session.actor);
  if (!householdId) return <NeedsGrownUp text={NOT_GUARDIAN} />;
  const plan = await effectivePlan(page.session.account ? accountDb() : null, store.plan);
  const s = billingSummary(await store.read(), plan, householdId);
  const paymentsOn = billingConfig().mode !== "off";
  const db = page.session.account ? accountDb() : null;
  const gift = s.plan === "sponsored" && db ? await householdGift(db, householdId).catch(() => null) : null;

  return (
    <FamilyShell>
      <PreviewNote />
      <header className="flex flex-col gap-2">
        <BackLink href="/family/controls" label="Parent Controls" />
        <h1 className="font-display text-4xl font-semibold">Plan and billing</h1>
      </header>
      {q.checkout === "success" && <CheckoutDone sessionId={q.session_id && /^cs_[A-Za-z0-9_]+$/.test(q.session_id) ? q.session_id : undefined} />}
      {q.checkout === "success" && (
        <p role="status" className="rounded-2xl bg-mint/40 px-4 py-3">
          Thank you! Your plan starts as soon as the payment goes through, usually within a minute.
        </p>
      )}
      {q.gift === "joined" && (
        <p role="status" className="rounded-2xl bg-mint/40 px-4 py-3">
          The gift is now part of your family. Add your children, then choose who each one hears.
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
        {s.plan === "subscription" && <ManagePlan paymentsOn={paymentsOn} />}
      </section>

      {gift && <GiftCard gift={gift} ends={gift.endsAt ?? s.endsAt} />}

      {s.canStartPlan && (
        <section className="flex flex-col gap-3" aria-labelledby="start-h">
          <h2 id="start-h" className="font-display text-2xl font-semibold">
            {s.plan === "none" ? "Start Readli Family" : s.plan === "sponsored" ? "Keep Readli with your own plan" : "Keep Readli Family going"}
          </h2>
          {s.plan === "sponsored" && s.endsAt && (
            <p data-testid="own-plan-offer">
              Continue with your own plan: {formatPrice(plan.familyMonthlyPriceCents)} a month, starting {day(s.endsAt)}, so there&apos;s no gap and no double charge.
            </p>
          )}
          <StartPlan
            monthlyCents={plan.familyMonthlyPriceCents}
            annualCents={plan.familyAnnualPriceCents}
            slotCents={plan.extraSlotPriceCents}
            slotsForSale={plan.extraSlotPriceApproved}
            includedSlots={plan.includedNarratorSlots}
            paymentsOn={paymentsOn}
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
