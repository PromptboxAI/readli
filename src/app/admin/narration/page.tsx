import type { Metadata } from "next";
import { FamilyOff, FamilyShell, NeedsGrownUp, PreviewNote } from "@/components/family/FamilyShell";
import { familyPage } from "@/lib/family/page-data";
import { formatPrice } from "@/lib/family/plan";
import { familyStore } from "@/lib/family/session";
import { narrationMetrics } from "@/lib/narration/admin";
import { requireAdmin } from "@/lib/admin/access";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Narration admin | Readli", robots: { index: false } };

const n = (x: number) => x.toLocaleString("en-US");
const t2 = (x: number) => `${Math.round(x * 100)}%`;

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-surface p-4 ring-2 ring-ink/10">
      <p className="text-sm text-muted">{label}</p>
      <p className="font-display text-2xl font-semibold">{value}</p>
    </div>
  );
}

/**
 * Narration operations dashboard. In the preview it reads the visitor's own sandbox; production
 * reads the narration tables behind admin sign-in (with /admin/plans).
 */
export default async function NarrationAdminPage() {
  await requireAdmin("/admin/narration");
  const page = await familyPage();
  if (!page.enabled) return <FamilyOff />;
  if (page.session?.actor.kind !== "adult") return <NeedsGrownUp text="Sign in as a grown-up to see the narration dashboard." />;
  const store = (await familyStore(page.session))!;
  const m = await narrationMetrics(await store.read(), store.plan, store.audio);
  const t = m.totals;
  return (
    <FamilyShell>
      <PreviewNote />
      <h1 className="font-display text-4xl font-semibold">Narration</h1>
      <p className="text-lg">Model {m.modelId}. Figures are provisional until consumption is benchmarked against ElevenLabs billing.</p>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Totals" data-testid="admin-totals">
        <Stat label="Libraries" value={n(t.libraries)} />
        <Stat label="Prepared sentences" value={`${n(t.readySegments)} (${t.readyMinutes} min)`} />
        <Stat label="Jobs queued or running" value={n(t.queuedJobs)} />
        <Stat label="Failed jobs / sentences" value={`${t.failedJobs} / ${t.failedSegments}`} />
        <Stat label="Characters generated" value={n(t.charactersGenerated)} />
        <Stat label="Provider credits" value={`${n(t.providerCredits)} (~$${t.providerUsd.toFixed(2)})`} />
        <Stat label="Audio stored" value={`${Math.round(t.bytesStored / 1024)} KB`} />
        <Stat label="Served from storage" value={`${Math.round(t.cacheHitRate * 100)}% (${n(t.listens)} listens, ${n(t.providerCalls)} provider calls)`} />
        <Stat label="Characters saved by replays" value={n(t.replayCharactersAvoided)} />
        <Stat label="Characters saved by sharing" value={n(t.sharingCharactersAvoided)} />
        <Stat label="Prepared but never played" value={`${n(t.unusedSegments)} sentences`} />
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="lib-h">
        <h2 id="lib-h" className="font-display text-2xl font-semibold">Readiness by book and voice</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b-2 border-ink/10">
                <th className="py-2 pr-3">Book</th>
                <th className="py-2 pr-3">Voice</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Sentences</th>
                <th className="py-2 pr-3">Households</th>
                <th className="py-2">Library</th>
              </tr>
            </thead>
            <tbody>
              {m.libraries.map((l) => (
                <tr key={l.key} className="border-b border-ink/10">
                  <td className="py-2 pr-3">{l.book}</td>
                  <td className="py-2 pr-3">{l.voice}</td>
                  <td className="py-2 pr-3">{l.readiness}</td>
                  <td className="py-2 pr-3">{l.ready} / {l.total}</td>
                  <td className="py-2 pr-3">{l.households}</td>
                  <td className="py-2">{l.scope}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {m.failedJobs.length > 0 && (
        <section className="flex flex-col gap-2" aria-labelledby="fail-h">
          <h2 id="fail-h" className="font-display text-2xl font-semibold">Failed jobs</h2>
          <ul className="text-sm">
            {m.failedJobs.map((j) => (
              <li key={j.id}>{j.library}: {j.sentences} sentences, {j.at}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3" aria-labelledby="credits-h">
        <h2 id="credits-h" className="font-display text-2xl font-semibold">Credit allocation this month</h2>
        <p className="text-sm">In Readli credits (1 credit = {store.plan.secondsPerCredit} second{store.plan.secondsPerCredit === 1 ? "" : "s"} of new narration).</p>
        <ul className="grid gap-2 text-sm sm:grid-cols-2">
          {m.households.map((h) => (
            <li key={h.name} className="rounded-3xl bg-surface p-4 ring-2 ring-ink/10">
              <p className="font-semibold">{h.name}</p>
              <p>
                Monthly {n(h.allowance)}, used {n(h.used)}, held {n(h.held)}, refunded {n(h.refunded)}. Left: {n(h.bySource.subscription)} monthly, {n(h.bySource.promotional)} promotional, {n(h.bySource.purchased)} purchased ({n(h.available)} in all)
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Launch funnel" data-testid="admin-funnel">
        <Stat label="Short story first, then a longer book" value={`${t2(m.funnel.conversion)} (${m.funnel.wentLonger} of ${m.funnel.startedShort})`} />
        <Stat label="Credit top-ups" value={`${m.funnel.topUps} (${n(m.funnel.topUpCredits)} credits)`} />
        <Stat label="Promotional credits granted" value={n(m.funnel.promoCredits)} />
        <Stat label="Narration reused" value={`${m.funnel.reusedLibraries} shared libraries, ${n(m.funnel.replays)} replays`} />
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="plans-h">
        <h2 id="plans-h" className="font-display text-2xl font-semibold">ElevenLabs plans</h2>
        <p className="text-sm">
          A full {store.plan.monthlyNarrationMinutes}-minute monthly allowance costs about ${m.allowanceCostUsd.toFixed(2)} of Pro credits per household
          ({formatPrice(store.plan.familyMonthlyPriceCents)} plan). Overage is about $0.17 per minute.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b-2 border-ink/10">
                <th className="py-2 pr-3">Plan</th>
                <th className="py-2 pr-3">Monthly</th>
                <th className="py-2 pr-3">Credits</th>
                <th className="py-2 pr-3">About</th>
                <th className="py-2 pr-3">Voices</th>
                <th className="py-2 pr-3">Concurrent</th>
                <th className="py-2">Per minute</th>
              </tr>
            </thead>
            <tbody>
              {m.plans.map((p) => (
                <tr key={p.name} className="border-b border-ink/10">
                  <td className="py-2 pr-3">{p.name}</td>
                  <td className="py-2 pr-3">${p.monthlyUsd}</td>
                  <td className="py-2 pr-3">{n(p.credits)}</td>
                  <td className="py-2 pr-3">{n(p.approxV4Minutes)} min</td>
                  <td className="py-2 pr-3">{n(p.customVoices)}</td>
                  <td className="py-2 pr-3">{p.concurrentRequests}</td>
                  <td className="py-2">${p.usdPerMinute.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </FamilyShell>
  );
}
