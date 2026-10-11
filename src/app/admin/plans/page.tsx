import type { Metadata } from "next";
import { AdultPage, Eyebrow, PreviewNote } from "@/components/invites/AdultPage";
import { CONTRIBUTOR_HOUSEHOLD_MAX_ADULTS } from "@/lib/accounts/accounts";
import { buttonPrimary } from "@/components/brand/buttons";
import { effectivePlan, MAX_CREDIT_PACKS } from "@/lib/billing/price-settings";
import { accountDb } from "@/lib/family/account-store";
import { formatPrice, type PlanConfig } from "@/lib/family/plan";
import { rewardsConfig } from "@/lib/rewards/rewards";
import { requireAdmin } from "@/lib/admin/access";
import { updatePriceSettingsAction } from "./actions";

export const metadata: Metadata = { title: "Plan settings | Readli admin", robots: { index: false } };
export const dynamic = "force-dynamic";

type Row = { label: string; value: string; note?: string };

function rows(plan: PlanConfig): Row[] {
  return [
    { label: "Readli Family monthly price", value: formatPrice(plan.familyMonthlyPriceCents) },
    { label: "Readli Family annual price", value: formatPrice(plan.familyAnnualPriceCents), note: "Monthly credits still refresh each month" },
    { label: "Included active narrator slots", value: String(plan.includedNarratorSlots) },
    {
      label: "Extra narrator slot price (monthly)",
      value: formatPrice(plan.extraSlotPriceCents),
      note: plan.extraSlotPriceApproved ? "Approved" : "Proposed: not on sale until approved",
    },
    { label: "Free contributor voice allowance (per adult)", value: String(plan.freeContributorVoices) },
    { label: "Adults per free contributor household", value: String(CONTRIBUTOR_HOUSEHOLD_MAX_ADULTS), note: "Each verifies and controls their own voice" },
    { label: "Maximum child profiles", value: String(plan.maxChildProfiles), note: "No per-child charge" },
    { label: "Included concurrent child streams", value: String(plan.includedConcurrentStreams) },
    { label: "Extra streams upgrade", value: plan.extraStreamsUpgradeEnabled ? "On" : "Off", note: "Future upgrade, not advertised" },
    {
      label: "Gift prices",
      value: `${formatPrice(plan.familyMonthlyPriceCents)} · ${formatPrice(plan.familyMonthlyPriceCents * 3)} · ${formatPrice(plan.familyAnnualPriceCents)}`,
      note: "One month · three months · a year. Payments off until switched on",
    },
    { label: "Gifted membership entitlements", value: "Same as Readli Family", note: "Gifts and donated memberships use the household entitlement model" },
    { label: "Narrator slot releases per 30 days", value: String(plan.slotReleasesPer30Days), note: "Anti-abuse limit on reassigning slots" },
    { label: "Listening session timeout", value: `${Math.round(plan.sessionStaleMs / 1000)} seconds`, note: "A player without a heartbeat stops counting as listening" },
    { label: "Monthly narration allowance (per household)", value: `${plan.monthlyNarrationMinutes} min`, note: "Provisional until commercial testing; not per child or narrator" },
    { label: "Readli credit", value: `${plan.secondsPerCredit} second${plan.secondsPerCredit === 1 ? "" : "s"} of new narration` },
    { label: "Quote safety margin", value: `${Math.round(plan.quoteSafetyMargin * 100)}%`, note: "Added to the model estimate when reserving; unused credits are returned" },
    {
      label: "Credit packs",
      value: plan.creditPacks.map((p) => `${p.credits} for ${formatPrice(p.priceCents)}`).join(", "),
      note: plan.narrationPurchasesEnabled ? "On sale" : "Provisional pricing: not on sale until approved",
    },
    { label: "Purchased credits expire after", value: plan.purchasedCreditMonths ? `${plan.purchasedCreditMonths} months` : "Never" },
    { label: "Monthly credit rollover", value: plan.subscriptionRolloverMonths ? `${plan.subscriptionRolloverMonths} months` : "None" },
    { label: "Welcome promotional credits", value: `${plan.welcomePromoCredits}`, note: plan.welcomePromoDays ? `Expire after ${plan.welcomePromoDays} days` : "Never expire" },
    { label: "Quick Stories length", value: `Up to ${plan.quickStoryMaxMinutes} min` },
    { label: "Recommended short stories", value: String(plan.recommendedShortStories.length), note: plan.recommendedShortStories.join(", ") },
    { label: "Bedtime Favorites", value: String(plan.bedtimeFavorites.length), note: plan.bedtimeFavorites.join(", ") },
    { label: "Chapter-by-chapter preparation", value: plan.chapterGenerationEnabled ? "On" : "Off" },
  ];
}

function rewardRows(): Row[] {
  const r = rewardsConfig();
  return [
    { label: "Readli Rewards program", value: r.programPublic ? "Public" : "Off", note: "Production shows no trial, rewards or referrals while off" },
    { label: "Free trial length", value: `${r.trialDays} days`, note: "Eligible new Readli Family households only, once per household and per email, phone or card" },
    { label: "Trial narration allowance", value: `${r.trialNarrationMinutes} minutes` },
    { label: "Paid months before a referral earns", value: String(r.referralPaidCyclesRequired), note: "Successful monthly charges the referred household paid itself" },
    { label: "Referral free months per rolling 12 months", value: String(r.referralMonthsPerRolling12), note: "Months over the cap aren't banked" },
    { label: "Narration allowance in a free month", value: "Standard only", note: "A free month waives the subscription charge and adds no extra narration" },
  ];
}

/** Admin portal: plan and entitlement settings. Editing turns on with admin sign-in. */
export default async function AdminPlansPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const gate = await requireAdmin("/admin/plans");
  const params = await searchParams;
  const ok = typeof params.ok === "string" ? params.ok : "";
  const err = typeof params.err === "string" ? params.err : "";
  const db = gate.preview ? null : accountDb();
  const plan = await effectivePlan(db);
  return (
    <AdultPage>
      <header className="flex flex-col gap-2">
        <Eyebrow>Admin</Eyebrow>
        <h1 className="font-display text-4xl font-semibold">Plan settings</h1>
        <p className="text-lg">These values drive pricing and limits everywhere: signup, checkout, gifts, rewards, narrator slots and kids&apos; streams.</p>
      </header>
      {ok && <p role="status" className="rounded-2xl bg-mint/40 px-4 py-3">{ok}</p>}
      {err && <p role="alert" className="rounded-2xl bg-coral/30 px-4 py-3">{err}</p>}
      <PriceSettings plan={plan} editable={Boolean(db)} />
      <PreviewNote>Values come from the plan_settings and reward_settings tables, or PLAN_* and REWARDS_* settings until those exist.</PreviewNote>
      <Settings rows={rows(plan)} testId="plan-settings" />
      <h2 className="font-display text-2xl font-semibold">Readli Rewards</h2>
      <Settings rows={rewardRows()} testId="reward-settings" />
    </AdultPage>
  );
}

function Settings({ rows, testId }: { rows: Row[]; testId: string }) {
  return (
    <dl className="divide-y-2 divide-ink/10 rounded-[var(--radius-panel)] bg-surface ring-2 ring-ink/10" data-testid={testId}>
      {rows.map((r) => (
        <div key={r.label} className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
          <dt>
            <span className="block font-semibold">{r.label}</span>
            {r.note && <span className="text-sm text-muted">{r.note}</span>}
          </dt>
          <dd className="font-display text-xl">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function dollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

function PriceField({ name, label, cents, disabled }: { name: string; label: string; cents: number; disabled: boolean }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-sm">
      <span className="font-semibold">{label}</span>
      <input name={name} inputMode="decimal" defaultValue={dollars(cents)} required disabled={disabled} className="w-full min-w-0 rounded-2xl bg-surface px-4 py-3 ring-2 ring-ink/15 disabled:opacity-60" />
    </label>
  );
}

/** The prices Readli sells at. Saving applies to new purchases; families already paying keep their price. */
function PriceSettings({ plan, editable }: { plan: PlanConfig; editable: boolean }) {
  const packs = Array.from({ length: MAX_CREDIT_PACKS }, (_, i) => plan.creditPacks[i] ?? null);
  return (
    <section className="flex flex-col gap-3" aria-labelledby="price-settings-h">
      <h2 id="price-settings-h" className="font-display text-2xl font-semibold">Prices</h2>
      <p className="text-sm">
        Prices in US dollars. A change applies to new purchases only: families already paying keep their price. Gift prices follow the Family prices.
        Payments stay off until they&apos;re switched on.
      </p>
      {!editable && <PreviewNote>Prices can be changed once sign-in and Supabase are connected.</PreviewNote>}
      <form action={updatePriceSettingsAction} className="grid gap-3 sm:grid-cols-2" data-testid="price-settings">
        <PriceField name="family_monthly" label="Readli Family, monthly" cents={plan.familyMonthlyPriceCents} disabled={!editable} />
        <PriceField name="family_annual" label="Readli Family, annual" cents={plan.familyAnnualPriceCents} disabled={!editable} />
        <PriceField name="extra_slot" label="Extra storyteller slot, monthly" cents={plan.extraSlotPriceCents} disabled={!editable} />
        <label className="flex items-center gap-3 self-end py-3 text-sm">
          <input type="checkbox" name="extra_slot_approved" defaultChecked={plan.extraSlotPriceApproved} disabled={!editable} className="size-5" />
          <span className="font-semibold">Extra slots approved for sale</span>
        </label>
        <fieldset className="flex flex-col gap-2 sm:col-span-2">
          <legend className="text-sm font-semibold">Credit packs (leave a row blank to remove it)</legend>
          {packs.map((p, i) => (
            <div key={i} className="grid grid-cols-2 gap-3">
              <input type="hidden" name={`pack_id_${i + 1}`} defaultValue={p?.id ?? ""} />
              <label className="flex min-w-0 flex-col gap-1 text-sm">
                <span>Pack {i + 1} credits</span>
                <input name={`pack_credits_${i + 1}`} inputMode="numeric" defaultValue={p ? String(p.credits) : ""} disabled={!editable} className="w-full min-w-0 rounded-2xl bg-surface px-4 py-3 ring-2 ring-ink/15 disabled:opacity-60" />
              </label>
              <label className="flex min-w-0 flex-col gap-1 text-sm">
                <span>Pack {i + 1} price</span>
                <input name={`pack_price_${i + 1}`} inputMode="decimal" defaultValue={p ? dollars(p.priceCents) : ""} disabled={!editable} className="w-full min-w-0 rounded-2xl bg-surface px-4 py-3 ring-2 ring-ink/15 disabled:opacity-60" />
              </label>
            </div>
          ))}
        </fieldset>
        <button className={`${buttonPrimary} self-start`} disabled={!editable}>Save prices</button>
      </form>
    </section>
  );
}
