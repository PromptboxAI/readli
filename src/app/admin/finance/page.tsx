import type { Metadata } from "next";
import Link from "next/link";
import { AdultPage, Eyebrow, PreviewNote } from "@/components/invites/AdultPage";
import { requireAdmin } from "@/lib/admin/access";
import { buttonPrimary } from "@/components/brand/buttons";
import { loadFinance, type CostConfig, type FinanceReport } from "@/lib/admin/finance";
import { accountDb } from "@/lib/family/account-store";
import { updateCostSettingsAction } from "../actions";

export const metadata: Metadata = { title: "Finances | Readli admin", robots: { index: false } };
export const dynamic = "force-dynamic";

const n = (x: number) => x.toLocaleString("en-US");
const money = (cents: number) => (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
const usd = (dollars: number) => dollars.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (x: number | null) => (x === null ? "None yet" : `${Math.round(x * 1000) / 10}%`);

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-3xl bg-surface p-4 ring-2 ring-ink/10">
      <p className="text-sm text-muted">{label}</p>
      <p className="font-display text-2xl font-semibold">{value}</p>
      {note && <p className="text-sm text-muted">{note}</p>}
    </div>
  );
}

function Section({ id, title, children, note }: { id: string; title: string; children: React.ReactNode; note?: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3" aria-labelledby={id}>
      <h2 id={id} className="font-display text-2xl font-semibold">{title}</h2>
      {note && <p className="text-sm">{note}</p>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{children}</div>
    </section>
  );
}

type Params = Record<string, string | string[] | undefined>;

/** Section 12 of the pricing pack: the money side of Readli, kept apart from the product numbers on /admin. */
export default async function FinancePage({ searchParams }: { searchParams: Promise<Params> }) {
  const gate = await requireAdmin("/admin/finance");
  const params = await searchParams;
  const test = params.mode === "test";
  const ok = typeof params.ok === "string" ? params.ok : "";
  const err = typeof params.err === "string" ? params.err : "";
  const db = gate.preview ? null : accountDb();
  const r = db ? await loadFinance(db, { live: !test }) : null;

  return (
    <AdultPage wide>
      <header className="flex flex-col gap-2">
        <Eyebrow>Admin</Eyebrow>
        <h1 className="font-display text-4xl font-semibold">Finances</h1>
        <p className="text-lg">
          Recurring revenue only counts subscriptions and narrator slots. Credit packs and gifts are one-time and never part of MRR.
        </p>
        <p className="flex flex-wrap gap-4 text-sm">
          <Link href="/admin" className="underline underline-offset-4">Back to the admin overview</Link>
          <Link href={test ? "/admin/finance" : "/admin/finance?mode=test"} className="underline underline-offset-4">
            {test ? "Show live payments" : "Show test-mode payments"}
          </Link>
        </p>
      </header>
      {ok && <p role="status" className="rounded-2xl bg-mint/40 px-4 py-3">{ok}</p>}
      {err && <p role="alert" className="rounded-2xl bg-coral/30 px-4 py-3">{err}</p>}
      {!r ? <PreviewNote>Financial reporting shows here once sign-in and Supabase are connected.</PreviewNote> : <Report r={r} test={test} />}
    </AdultPage>
  );
}

function Report({ r, test }: { r: FinanceReport; test: boolean }) {
  const c = r.costs30d;
  const costs = r.costs;
  return (
    <>
      {!r.hasRevenueData && (
        <p role="note" className="rounded-2xl bg-lavender/40 px-4 py-3 text-sm">
          No {test ? "test-mode" : "live"} payments recorded yet, so revenue reads $0. Payments are still switched off; families and costs below are real.
        </p>
      )}

      <Section id="families-h" title="Families and voices">
        <Stat label="Paying families" value={n(r.payingFamilies)} note={`${n(r.slotsPurchased)} extra narrator slot${r.slotsPurchased === 1 ? "" : "s"} bought`} />
        <Stat label="Gift memberships" value={n(r.giftFamilies)} />
        <Stat label="On a free trial" value={n(r.trialFamilies)} />
        <Stat label="Complimentary" value={n(r.complimentaryFamilies)} note="Donated and tester plans" />
        <Stat label="Free Readli Voice contributors" value={n(r.voiceContributors)} note="Grown-ups with no Family plan" />
        <Stat label="Active verified voices" value={n(r.verifiedVoices)} />
      </Section>

      <Section id="recurring-h" title="Recurring revenue">
        <Stat label="Subscription MRR" value={money(r.subscriptionMrrCents)} note={`ARR ${money(r.subscriptionArrCents)}`} />
        <Stat label="Narrator slot MRR" value={money(r.slotMrrCents)} note="Kept separate from subscriptions" />
        <Stat label="Total recurring ARR" value={money(r.recurringArrCents)} note="Subscriptions and slots" />
        <Stat label="Average revenue per paying family" value={r.arpuCents === null ? "None yet" : money(r.arpuCents)} note="Monthly, subscriptions and slots" />
      </Section>

      <Section id="onetime-h" title="One-time revenue" note="Refunds are subtracted. Not part of MRR.">
        <Stat label="Credit packs, last 30 days" value={money(r.creditPacks30d.cents)} note={`${n(r.creditPacks30d.count)} sold`} />
        <Stat label="Credit packs, all time" value={money(r.creditPacksAllTime.cents)} note={`${n(r.creditPacksAllTime.count)} sold`} />
        <Stat label="Gifts, last 30 days" value={money(r.gifts30d.cents)} note={`${n(r.gifts30d.count)} sold`} />
        <Stat label="Gifts, all time" value={money(r.giftsAllTime.cents)} note={`${n(r.giftsAllTime.count)} sold`} />
      </Section>

      <Section
        id="sponsor-h"
        title="Family gifts (sponsored)"
        note="Kept apart from household plans. Each sponsor is one paying subscriber; the families they cover are activations, not customers. Prepaid years count as a twelfth a month."
      >
        <Stat label="Paying sponsors" value={n(r.sponsorships.sponsors)} />
        <Stat label="Families covered by a sponsor" value={n(r.sponsorships.sponsoredFamilies)} note="Non-paying activations" />
        <Stat label="Monthly gift MRR" value={money(r.sponsorships.monthlyMrrCents)} />
        <Stat label="Prepaid-year gift MRR" value={money(r.sponsorships.annualMrrCents)} note="$179.99 a year counts as $15.00 a month" />
      </Section>
      {r.sponsorships.margins.length > 0 && (
        <section className="flex flex-col gap-3" aria-labelledby="sponsor-margin-h">
          <h2 id="sponsor-margin-h" className="font-display text-2xl font-semibold">Gift margins, monthly and prepaid year</h2>
          <p className="text-sm">This month&apos;s gift revenue minus the narration its families generated in the last 30 days. Lowest margin first.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" data-testid="sponsorship-margins">
              <thead>
                <tr className="border-b-2 border-ink/10">
                  <th className="py-2 pr-3">Gift</th>
                  <th className="py-2 pr-3">Kind</th>
                  <th className="py-2 pr-3">Families</th>
                  <th className="py-2 pr-3">Revenue</th>
                  <th className="py-2 pr-3">Narration cost</th>
                  <th className="py-2">Margin</th>
                </tr>
              </thead>
              <tbody>
                {r.sponsorships.margins.slice(0, 50).map((m) => (
                  <tr key={m.sponsorshipId} className="border-b border-ink/10">
                    <td className="py-2 pr-3 font-mono text-xs">{m.sponsorshipId.slice(0, 8)}</td>
                    <td className="py-2 pr-3">{m.interval === "year" ? "Prepaid year" : "Monthly"}</td>
                    <td className="py-2 pr-3">{n(m.families)}</td>
                    <td className="py-2 pr-3">{money(m.revenueCents)}</td>
                    <td className="py-2 pr-3">{usd(m.costUsd)}</td>
                    <td className="py-2">{usd(m.marginUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <Section id="retention-h" title="Trials and retention">
        <Stat label="Trial conversion" value={pct(r.trials.rate)} note={`${n(r.trials.converted)} of ${n(r.trials.ended)} finished trials`} />
        <Stat label="Churn, last 30 days" value={pct(r.churn.rate)} note={`${n(r.churn.churned)} of ${n(r.churn.startingFamilies)} paying families`} />
        <Stat label="Retention, last 30 days" value={pct(r.churn.retention)} />
      </Section>

      <Section
        id="costs-h"
        title="Costs, last 30 days"
        note={`Estimates from the cost settings below (${usd(costs.lowPer1kUsd)} or ${usd(costs.defaultPer1kUsd)} per 1,000 characters by model, the ${costs.providerPlanName} plan at ${usd(costs.providerPlanMonthlyUsd)} a month), not invoices.`}
      >
        <Stat label="Generated narration cost" value={usd(c.generationUsd)} note={`${n(c.characters)} characters, ${n(c.providerCredits)} provider credits`} />
        <Stat label="ElevenLabs expense" value={usd(c.providerExpenseUsd)} note={`${costs.providerPlanName} plan fee, or usage when it's higher`} />
        <Stat label="Audio storage" value={usd(c.storageUsd)} />
        <Stat label="Audio delivery" value={usd(c.deliveryUsd)} />
      </Section>

      <Section id="contribution-h" title="Contribution, last 30 days">
        <Stat label="Revenue" value={money(r.revenue30dCents)} note="This month's recurring plus one-time sales" />
        <Stat label="Costs" value={usd(c.totalUsd)} />
        <Stat label="Total operating contribution" value={usd(r.operatingContributionUsd)} />
      </Section>

      <section className="flex flex-col gap-3" aria-labelledby="margin-h">
        <h2 id="margin-h" className="font-display text-2xl font-semibold">Contribution margin by family</h2>
        <p className="text-sm">Revenue this month minus the narration that family generated. Lowest margin first.</p>
        {r.households.length === 0 ? (
          <p className="text-muted">No family has revenue or generation costs yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" data-testid="household-margins">
              <thead>
                <tr className="border-b-2 border-ink/10">
                  <th className="py-2 pr-3">Family</th>
                  <th className="py-2 pr-3">Revenue</th>
                  <th className="py-2 pr-3">Narration cost</th>
                  <th className="py-2">Margin</th>
                </tr>
              </thead>
              <tbody>
                {r.households.slice(0, 50).map((h) => (
                  <tr key={h.householdId} className="border-b border-ink/10">
                    <td className="py-2 pr-3">{h.name ?? "Deleted family"}</td>
                    <td className="py-2 pr-3">{money(h.revenueCents)}</td>
                    <td className="py-2 pr-3">{usd(h.costUsd)}</td>
                    <td className="py-2">{usd(h.marginUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <CostSettings costs={costs} />
    </>
  );
}

function CostField({ name, label, value, step }: { name: string; label: string; value: number; step: string }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-semibold">{label}</span>
      <input name={name} type="number" min="0" step={step} defaultValue={value} required className="rounded-2xl bg-surface px-4 py-3 ring-2 ring-ink/15" />
    </label>
  );
}

/** Admin-editable cost assumptions. Changing them only changes this report. */
function CostSettings({ costs }: { costs: CostConfig }) {
  return (
    <section className="flex flex-col gap-3" aria-labelledby="cost-settings-h">
      <h2 id="cost-settings-h" className="font-display text-2xl font-semibold">Cost settings</h2>
      <p className="text-sm">Used only for the estimates on this page. Update them when the ElevenLabs plan or hosting prices change.</p>
      <form action={updateCostSettingsAction} className="grid gap-3 sm:grid-cols-2" data-testid="cost-settings">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">ElevenLabs plan</span>
          <input name="provider_plan_name" defaultValue={costs.providerPlanName} maxLength={40} className="rounded-2xl bg-surface px-4 py-3 ring-2 ring-ink/15" />
        </label>
        <CostField name="provider_plan_monthly_usd" label="Plan price per month (USD)" value={costs.providerPlanMonthlyUsd} step="0.01" />
        <CostField name="cost_per_1k_chars_usd" label="Cost per 1,000 characters, standard models (USD)" value={costs.defaultPer1kUsd} step="0.0001" />
        <CostField name="low_cost_per_1k_chars_usd" label="Cost per 1,000 characters, Flash and Turbo (USD)" value={costs.lowPer1kUsd} step="0.0001" />
        <CostField name="storage_usd_per_gb_month" label="Audio storage per GB-month (USD)" value={costs.storageUsdPerGbMonth} step="0.0001" />
        <CostField name="delivery_usd_per_gb" label="Audio delivery per GB (USD)" value={costs.deliveryUsdPerGb} step="0.0001" />
        <button className={`${buttonPrimary} self-start`}>Save cost settings</button>
      </form>
    </section>
  );
}
