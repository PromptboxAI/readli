import type { Metadata } from "next";
import Link from "next/link";
import { CreditsPanel } from "@/components/family/CreditsPanel";
import { FamilyOff, FamilyShell, NeedsGrownUp, PreviewNote } from "@/components/family/FamilyShell";
import { familyPage } from "@/lib/family/page-data";
import { guardianHousehold } from "@/lib/family/service";
import { familyStore } from "@/lib/family/session";
import { creditBalance, displayCredits } from "@/lib/narration/credits";
import { creditHistory } from "@/lib/narration/narration";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Readli credits | Readli" };

const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

/** Only same-site family pages are valid places to return to after buying. */
function safeReturn(value: string | undefined): string | null {
  return value && /^\/family\/books\/[a-z0-9-]+(\?[\w=&%-]*)?$/.test(value) ? value : null;
}

export default async function CreditsPage({ searchParams }: { searchParams: Promise<{ need?: string; return?: string }> }) {
  const q = await searchParams;
  const page = await familyPage();
  if (!page.enabled) return <FamilyOff />;
  if (page.session?.actor.kind !== "adult") return <NeedsGrownUp text="Only a parent or guardian can manage Readli credits." />;
  const store = (await familyStore(page.session))!;
  const householdId = await guardianHousehold(store, page.session.actor);
  if (!householdId) return <NeedsGrownUp text="Only a parent or guardian can manage Readli credits." />;
  const state = await store.read();
  const plan = store.plan;
  const b = creditBalance(state, plan, householdId);
  const n = (units: number) => displayCredits(units, b.unitsPerCredit).toLocaleString("en-US");
  const trial = b.bySource.trial > 0 || b.lots.some((l) => l.source === "trial");
  const history = creditHistory(state, householdId);
  const need = Math.max(0, Math.floor(Number(q.need) || 0));
  const returnTo = safeReturn(q.return);
  return (
    <FamilyShell>
      <PreviewNote />
      <div className="flex flex-col gap-2">
        {returnTo && (
          <Link href={returnTo} className="font-semibold underline underline-offset-4">
            ← Back to your book
          </Link>
        )}
        <h1 className="font-display text-4xl font-semibold">Readli credits</h1>
        <p className="text-lg">
          Credits pay for new narration: 1 credit covers {plan.charactersPerCredit.toLocaleString("en-US")} characters of story text, and you see the exact
          cost before anything is made. Listening to anything already prepared, or switching between prepared voices, is always free. Credits belong to
          your household, not to a child or a storyteller.
        </p>
      </div>

      <section className="grid gap-3 sm:grid-cols-4" aria-label="Balance" data-testid="credit-balance">
        <div className="rounded-3xl bg-sky/30 p-4 sm:col-span-1">
          <p className="text-sm text-muted">Available</p>
          <p className="font-display text-3xl font-semibold">{n(b.available)}</p>
        </div>
        <div className="rounded-3xl bg-surface p-4 ring-2 ring-ink/10">
          <p className="text-sm text-muted">{trial ? "Free trial" : "Monthly (Readli Family)"}</p>
          <p className="font-display text-2xl font-semibold">{n(b.bySource.subscription + b.bySource.trial)}</p>
          <p className="text-xs text-muted">
            {trial
              ? `${n(b.allowance)} for your trial. Used first.`
              : `${n(b.allowance)} each month${b.renewsAt ? `, renews ${day(b.renewsAt)}` : ""}. Used first. ${plan.subscriptionRolloverMonths ? `Unused credits roll over for ${plan.subscriptionRolloverMonths} month(s).` : "Unused monthly credits don't roll over."}`}
          </p>
        </div>
        <div className="rounded-3xl bg-surface p-4 ring-2 ring-ink/10">
          <p className="text-sm text-muted">Promotional</p>
          <p className="font-display text-2xl font-semibold">{n(b.bySource.promotional)}</p>
          <p className="text-xs text-muted">Used after your included credits.</p>
        </div>
        <div className="rounded-3xl bg-surface p-4 ring-2 ring-ink/10">
          <p className="text-sm text-muted">Purchased</p>
          <p className="font-display text-2xl font-semibold">{n(b.bySource.purchased)}</p>
          <p className="text-xs text-muted">{plan.purchasedCreditMonths ? `Expire ${plan.purchasedCreditMonths} months after purchase.` : "Never expire."} Used last.</p>
        </div>
      </section>
      {b.held > 0 && <p className="text-sm">{n(b.held)} credits are set aside for narration being prepared. Anything not used comes back.</p>}

      <CreditsPanel packs={plan.creditPacks} need={need} returnTo={returnTo} canBuy={plan.narrationPurchasesEnabled || plan.simulatedCheckout} simulated={!plan.narrationPurchasesEnabled && plan.simulatedCheckout} />

      <section className="flex flex-col gap-2" aria-labelledby="history-h" data-testid="credit-history">
        <h2 id="history-h" className="font-display text-2xl font-semibold">History</h2>
        {history.length === 0 ? (
          <p>No credit activity yet.</p>
        ) : (
          <ul className="divide-y-2 divide-ink/10 rounded-3xl bg-surface ring-2 ring-ink/10">
            {history.map((h, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{h.text}</span>
                  <span className="text-sm text-muted">
                    {day(h.at)} · {h.status}
                  </span>
                </span>
                <span className={`font-display text-lg ${h.credits >= 0 ? "text-ink" : "text-coral-deep"}`}>
                  {h.credits >= 0 ? "+" : "−"}
                  {n(Math.abs(h.credits))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </FamilyShell>
  );
}
