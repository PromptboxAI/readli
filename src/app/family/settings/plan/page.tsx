import type { Metadata } from "next";
import Link from "next/link";
import { CheckoutDone, ManagePlan, StartPlan } from "@/components/family/BillingActions";
import { CreditsPanel } from "@/components/family/CreditsPanel";
import { FamilyOff, NeedsGrownUp } from "@/components/family/FamilyShell";
import { SettingsShell } from "@/components/family/SettingsShell";
import { billingConfig } from "@/lib/billing/config";
import { confirmCheckout } from "@/lib/billing/confirm";
import { StripeApi } from "@/lib/billing/stripe-api";
import { effectivePlan } from "@/lib/billing/price-settings";
import { billingSummary, type BillingSummary } from "@/lib/billing/summary";
import { accountDb } from "@/lib/family/account-store";
import { familyPage } from "@/lib/family/page-data";
import { formatPrice } from "@/lib/family/plan";
import { familyParents, guardianHousehold } from "@/lib/family/service";
import { familyStore } from "@/lib/family/session";
import { creditBalance, displayCredits } from "@/lib/narration/credits";
import { creditHistory } from "@/lib/narration/narration";
import { householdGift, type HouseholdGift } from "@/lib/sponsorship/view";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Plan & credits | Readli", robots: { index: false } };

const NOT_GUARDIAN = "Only a parent or guardian can see your family's plan and credits.";
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
const shortDay = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const card = "flex min-w-0 flex-col gap-3 rounded-3xl bg-surface p-5 ring-2 ring-ink/10";
const label = "text-sm font-bold tracking-wider text-muted uppercase";
/** Recent credit activity shown before "See all". */
const RECENT = 5;

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

/** Only same-site family pages are valid places to return to after buying credits. */
function safeReturn(value: string | undefined): string | null {
  return value && /^\/family\/books\/[a-z0-9-]+(\?[\w=&%-]*)?$/.test(value) ? value : null;
}

/** The family's gift, as its parents see it. Never anything about the sponsor's other family. */
function GiftCard({ gift, ends }: { gift: HouseholdGift; ends: string | null }) {
  const from = gift.giverName;
  const lastDay = ends ? day(new Date(Date.parse(ends) - 86_400_000).toISOString()) : null;
  return (
    <section className="flex flex-col gap-2 rounded-3xl bg-sunshine/30 p-5" aria-labelledby="gift-h" data-testid="family-gift">
      <h2 id="gift-h" className="font-display text-xl font-semibold">
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

type Query = { checkout?: string; session_id?: string; gift?: string; need?: string; return?: string; history?: string };

/** A parent's plan and the family's narration credits, together, with where to change either. Children never reach it. */
export default async function PlanAndCreditsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const q = await searchParams;
  const page = await familyPage();
  if (!page.enabled) return <FamilyOff />;
  if (page.session?.actor.kind !== "adult") return <NeedsGrownUp text={NOT_GUARDIAN} />;
  const store = (await familyStore(page.session))!;
  const householdId = await guardianHousehold(store, page.session.actor);
  if (!householdId) return <NeedsGrownUp text={NOT_GUARDIAN} />;
  const config = billingConfig();
  const paymentsOn = config.mode !== "off";
  const db = page.session.account ? accountDb() : null;
  // An older checkout link still lands here: confirm it with Stripe so a paid plan shows without the webhook.
  if (q.checkout === "success" && q.session_id && db && paymentsOn) {
    const stripe = new StripeApi(config);
    await confirmCheckout(db, (id) => stripe.getCheckoutSession(id), q.session_id, householdId).catch((err: unknown) => console.error("confirm checkout failed", err));
  }
  const state = await store.read();
  // Co-parents see the plan and credits; only the parent who started the family pays for them.
  const parents = await familyParents(store, page.session.actor, householdId);
  const owns = parents.youOwn;
  const plan = await effectivePlan(db, store.plan);
  const s = billingSummary(state, plan, householdId);
  const gift = s.plan === "sponsored" && db ? await householdGift(db, householdId).catch(() => null) : null;

  // Credits use the family's stored plan, as narration does.
  const b = creditBalance(state, store.plan, householdId);
  const n = (units: number) => displayCredits(units, b.unitsPerCredit).toLocaleString("en-US");
  const trial = b.bySource.trial > 0 || b.lots.some((l) => l.source === "trial");
  const history = creditHistory(state, householdId);
  const shown = q.history === "all" ? history : history.slice(0, RECENT);
  const need = Math.max(0, Math.floor(Number(q.need) || 0));
  const returnTo = safeReturn(q.return);
  const monthlyLeft = b.allowance > 0 ? Math.min(1, (b.bySource.subscription + b.bySource.trial) / b.allowance) : 0;

  return (
    <SettingsShell current="plan" guardian>
      {returnTo && (
        <Link href={returnTo} className="self-start font-semibold underline underline-offset-4">
          ← Back to your book
        </Link>
      )}
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

      {!owns && (
        <p role="note" className="rounded-2xl bg-sky/30 px-4 py-3" data-testid="co-parent-billing">
          {parents.ownerName} manages your family&apos;s plan and billing. You can use everything it includes, and ask {parents.ownerName} to change the plan or buy more credits.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={card} aria-labelledby="plan-h" data-testid="current-plan">
          <p className={label}>Plan</p>
          <div>
            <h2 id="plan-h" className="font-display text-2xl font-semibold">
              {PLAN_NAMES[s.plan]}
            </h2>
            <p className="text-muted">{planNote(s)}</p>
          </div>
          {s.plan !== "none" && (
            <p className="flex flex-wrap gap-2 text-sm">
              <span className="rounded-full bg-ink/5 px-3 py-0.5">
                {s.narratorSlots} storyteller {s.narratorSlots === 1 ? "slot" : "slots"}
                {s.extraNarratorSlots > 0 ? ` (${s.extraNarratorSlots} extra${s.extraSlotsMonthlyCents ? `, ${formatPrice(s.extraSlotsMonthlyCents)} a month` : ""})` : ""}
              </span>
              <Link href="/family/narrators" className="rounded-full px-1 py-0.5 font-semibold underline underline-offset-4">
                Family storytellers
              </Link>
            </p>
          )}
          {s.plan === "subscription" && owns && <ManagePlan paymentsOn={paymentsOn} />}
        </section>

        <section className={card} aria-labelledby="credits-h" data-testid="credit-balance">
          <h2 id="credits-h" className={label}>
            Credits
          </h2>
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-display text-4xl font-semibold tabular-nums">{n(b.available)}</span>
            <span className="text-muted">
              available
              {!trial && b.renewsAt ? ` · ${n(b.allowance)} more on ${shortDay(b.renewsAt)}` : ""}
            </span>
          </p>
          {b.allowance > 0 && (
            <div className="h-2.5 overflow-hidden rounded-full bg-ink/10" aria-hidden="true">
              <div className="h-full rounded-full bg-mint-deep" style={{ width: `${Math.round(monthlyLeft * 100)}%` }} />
            </div>
          )}
          <ul className="flex flex-wrap gap-2 text-sm tabular-nums">
            <li className="rounded-full bg-ink/5 px-3 py-0.5">
              {trial ? "Free trial" : "Monthly"} {n(b.bySource.subscription + b.bySource.trial)}
            </li>
            <li className="rounded-full bg-ink/5 px-3 py-0.5">Promotional {n(b.bySource.promotional)}</li>
            <li className="rounded-full bg-ink/5 px-3 py-0.5">Purchased {n(b.bySource.purchased)}</li>
          </ul>
          <p className="text-sm text-muted">
            {trial ? "Trial credits" : "Monthly credits"} are used first
            {!trial && !plan.subscriptionRolloverMonths ? " and don't roll over" : ""}, then promotional, then purchased.{" "}
            {plan.purchasedCreditMonths ? `Purchased credits expire ${plan.purchasedCreditMonths} months after purchase.` : "Purchased credits never expire."}
          </p>
          {b.held > 0 && <p className="text-sm">{n(b.held)} credits are set aside for narration being prepared. Anything not used comes back.</p>}
        </section>
      </div>

      {gift && <GiftCard gift={gift} ends={gift.endsAt ?? s.endsAt} />}

      {s.canStartPlan && owns && (
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

      {owns && (
        <CreditsPanel
          packs={store.plan.creditPacks}
          need={need}
          returnTo={returnTo}
          canBuy={store.plan.narrationPurchasesEnabled || (store.plan.simulatedCheckout && !page.session.account)}
          simulated={!store.plan.narrationPurchasesEnabled && store.plan.simulatedCheckout && !page.session.account}
        />
      )}

      <section className="flex flex-col gap-2" aria-labelledby="history-h" data-testid="credit-history">
        <h2 id="history-h" className="font-display text-xl font-semibold">
          Credit activity
        </h2>
        {history.length === 0 ? (
          <p className="text-muted">No credit activity yet.</p>
        ) : (
          <ul className="divide-y-2 divide-ink/5 rounded-3xl bg-surface ring-2 ring-ink/10">
            {shown.map((h, i) => (
              <li key={i} className="flex items-center gap-3 px-4 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{h.text}</span>
                  <span className="text-sm text-muted">
                    {day(h.at)} · {h.status}
                  </span>
                </span>
                <span className={`font-display text-lg tabular-nums ${h.credits >= 0 ? "text-ink" : "text-coral-deep"}`}>
                  {h.credits >= 0 ? "+" : "−"}
                  {n(Math.abs(h.credits))}
                </span>
              </li>
            ))}
          </ul>
        )}
        {history.length > shown.length && (
          <Link href="/family/settings/plan?history=all#history-h" className="self-start font-semibold underline underline-offset-4">
            See all {history.length}
          </Link>
        )}
      </section>

      <p className="text-sm text-muted">
        A storyteller slot lets one more family voice read to your kids. Credits pay for preparing new stories, at {store.plan.charactersPerCredit.toLocaleString("en-US")}{" "}
        characters of story text per credit, and you see the exact cost first. Listening to anything already prepared is always free. Storytellers never pay to record or share
        their voice.
      </p>
    </SettingsShell>
  );
}
