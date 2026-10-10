import type { Metadata } from "next";
import { AdultPage, Eyebrow, PreviewNote } from "@/components/invites/AdultPage";
import { CONTRIBUTOR_HOUSEHOLD_MAX_ADULTS } from "@/lib/accounts/accounts";
import { formatPrice, planConfig } from "@/lib/family/plan";

export const metadata: Metadata = { title: "Plan settings | Readli admin", robots: { index: false } };
export const dynamic = "force-dynamic";

type Row = { label: string; value: string; note?: string };

function rows(): Row[] {
  const plan = planConfig();
  return [
    { label: "Readli Family monthly price", value: formatPrice(plan.familyMonthlyPriceCents) },
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
    { label: "Gifted membership entitlements", value: "Same as Readli Family", note: "Gifts and donated memberships use the household entitlement model" },
    { label: "Narrator slot releases per 30 days", value: String(plan.slotReleasesPer30Days), note: "Anti-abuse limit on reassigning slots" },
    { label: "Listening session timeout", value: `${Math.round(plan.sessionStaleMs / 1000)} seconds`, note: "A player without a heartbeat stops counting as listening" },
  ];
}

/** Admin portal: plan and entitlement settings. Editing turns on with admin sign-in. */
export default function AdminPlansPage() {
  return (
    <AdultPage>
      <header className="flex flex-col gap-2">
        <Eyebrow>Admin</Eyebrow>
        <h1 className="font-display text-4xl font-semibold">Plan settings</h1>
        <p className="text-lg">These values drive pricing and limits everywhere: signup, checkout, gifts, narrator slots and kids&apos; streams.</p>
      </header>
      <PreviewNote>Read-only until admin sign-in exists. Values come from the plan_settings table, or PLAN_* settings until then.</PreviewNote>
      <dl className="divide-y-2 divide-ink/10 rounded-[var(--radius-panel)] bg-surface ring-2 ring-ink/10" data-testid="plan-settings">
        {rows().map((r) => (
          <div key={r.label} className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
            <dt>
              <span className="block font-semibold">{r.label}</span>
              {r.note && <span className="text-sm text-muted">{r.note}</span>}
            </dt>
            <dd className="font-display text-xl">{r.value}</dd>
          </div>
        ))}
      </dl>
    </AdultPage>
  );
}
