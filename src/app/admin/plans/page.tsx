import type { Metadata } from "next";
import { AdultPage, Eyebrow, PreviewNote } from "@/components/invites/AdultPage";
import { DEFAULT_PLAN, money, type PlanConfig } from "@/lib/entitlements/config";

export const metadata: Metadata = { title: "Plan settings | Readli admin", robots: { index: false } };

type Row = { key: keyof PlanConfig; label: string; value: string; note?: string };

const ROWS: Row[] = [
  { key: "familyMonthlyPriceCents", label: "Readli Family monthly price", value: money(DEFAULT_PLAN.familyMonthlyPriceCents) },
  { key: "includedNarratorSlots", label: "Included active narrator slots", value: String(DEFAULT_PLAN.includedNarratorSlots) },
  {
    key: "extraNarratorSlotPriceCents",
    label: "Extra narrator slot price (monthly)",
    value: money(DEFAULT_PLAN.extraNarratorSlotPriceCents),
    note: DEFAULT_PLAN.extraNarratorSlotPriceStatus === "approved" ? "Approved" : "Proposed: not on sale until approved",
  },
  { key: "freeContributorVoiceAllowance", label: "Free contributor voice allowance (per adult)", value: String(DEFAULT_PLAN.freeContributorVoiceAllowance) },
  { key: "contributorHouseholdMaxAdults", label: "Adults per free contributor household", value: String(DEFAULT_PLAN.contributorHouseholdMaxAdults) },
  { key: "maxChildProfiles", label: "Maximum child profiles", value: String(DEFAULT_PLAN.maxChildProfiles), note: "No per-child charge" },
  { key: "includedConcurrentStreams", label: "Included concurrent child streams", value: String(DEFAULT_PLAN.includedConcurrentStreams) },
  { key: "extraStreamsForSale", label: "Extra streams for sale", value: "Off", note: "Future upgrade, not advertised" },
  { key: "giftedMembershipEntitlements", label: "Gifted membership entitlements", value: "Same as Readli Family" },
  { key: "narratorSwapsPer30Days", label: "Narrator slot changes per 30 days (anti-abuse)", value: String(DEFAULT_PLAN.narratorSwapsPer30Days) },
  { key: "voiceRecordingAttemptsPerDay", label: "Voice recording attempts per day", value: String(DEFAULT_PLAN.voiceRecordingAttemptsPerDay) },
  { key: "voiceReplacementsPerYear", label: "Voice replacements per year", value: String(DEFAULT_PLAN.voiceReplacementsPerYear) },
];

/** Admin portal: plan and entitlement settings. Editing turns on with admin sign-in. */
export default function AdminPlansPage() {
  return (
    <AdultPage>
      <header className="flex flex-col gap-2">
        <Eyebrow>Admin</Eyebrow>
        <h1 className="font-display text-4xl font-semibold">Plan settings</h1>
        <p className="text-lg">These values drive pricing and limits everywhere: signup, checkout, gifts, narrator slots and kids&apos; streams.</p>
      </header>
      <PreviewNote>Read-only until admin sign-in exists. These are the launch defaults.</PreviewNote>
      <dl className="divide-y-2 divide-ink/10 rounded-[var(--radius-panel)] bg-surface ring-2 ring-ink/10" data-testid="plan-settings">
        {ROWS.map((r) => (
          <div key={r.key} className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
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
