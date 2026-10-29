import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AskName } from "@/components/account/AskName";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import { CheckoutDone } from "@/components/family/BillingActions";
import { FamilyOff, FamilyShell, NeedsGrownUp } from "@/components/family/FamilyShell";
import { NameFamily } from "@/components/family/NameFamily";
import { PlanStarting } from "@/components/family/PlanStarting";
import { chosenName } from "@/lib/account/names";
import { billingConfig } from "@/lib/billing/config";
import { confirmCheckout } from "@/lib/billing/confirm";
import { StripeApi } from "@/lib/billing/stripe-api";
import { accountDb } from "@/lib/family/account-store";
import { familyPage, guardianChildren } from "@/lib/family/page-data";
import { activeEntitlement } from "@/lib/family/permissions";
import { homeHousehold, PROVISIONAL_FAMILY_NAME } from "@/lib/family/service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Set up your family | Readli", robots: { index: false } };

function Step({ n, done, title, children }: { n: number; done: boolean; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4 rounded-[var(--radius-panel)] bg-surface p-5 ring-2 ring-ink/10 sm:p-6" data-testid={`setup-step-${n}`}>
      <span aria-hidden="true" className={`grid size-10 shrink-0 place-items-center rounded-full font-display font-semibold ${done ? "bg-mint" : "bg-coral text-white"}`}>
        {done ? "✓" : n}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <h2 className="font-display text-xl font-semibold">
          {title}
          {done && <span className="sr-only"> (done)</span>}
        </h2>
        {children}
      </div>
    </li>
  );
}

/**
 * Where Family checkout from signup comes back to: waits for the payment to turn the plan on, then
 * walks through naming the family, what to call you, the first kids profile and the first book.
 * Personal, family and storyteller names stay separate, each asked for in its own place.
 */
export default async function FamilySetupPage({ searchParams }: { searchParams: Promise<{ checkout?: string; session_id?: string }> }) {
  const q = await searchParams;
  const page = await familyPage();
  if (!page.enabled) return <FamilyOff />;
  const { session, state } = page;
  if (!session || !state) redirect("/login?next=/family/setup");
  if (session.actor.kind !== "adult") return <NeedsGrownUp text="Only a parent or guardian can set up the family." />;
  const adultId = session.actor.adultId;
  const adult = state.adults.find((a) => a.id === adultId);
  const home = homeHousehold(state, adultId);
  if (!adult || !home) redirect("/signup/family");
  let plan = Boolean(activeEntitlement(state, home));
  // Back from Stripe: confirm the checkout now rather than waiting on the webhook to turn the plan on.
  const config = billingConfig();
  const db = accountDb();
  if (!plan && q.checkout === "success" && q.session_id && db && config.mode !== "off") {
    const stripe = new StripeApi(config);
    const outcome = await confirmCheckout(db, (id) => stripe.getCheckoutSession(id), q.session_id, home).catch(() => null);
    plan = outcome?.status === "done";
  }
  const familyName = state.households.find((h) => h.id === home)?.name ?? "";
  const named = familyName !== "" && familyName !== PROVISIONAL_FAMILY_NAME;
  const myName = session.account ? chosenName(adult.displayName, session.account.email, session.account.named) : adult.displayName;
  const kids = guardianChildren(state, adultId).length;

  return (
    <FamilyShell>
      {q.checkout === "success" && <CheckoutDone sessionId={q.session_id} />}
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-4xl font-semibold">{plan ? "Welcome to Readli Family!" : "Almost there"}</h1>
        <p className="text-lg">A few quick steps and your kids can start listening.</p>
      </header>
      {!plan && <PlanStarting />}
      <ol className="flex flex-col gap-4">
        <Step n={1} done={named} title={named ? `Your family: ${familyName}` : "Name your family"}>
          <NameFamily current={named ? familyName : ""} />
        </Step>
        <Step n={2} done={Boolean(myName)} title={myName ? `We'll call you ${myName}` : "What should we call you?"}>
          {myName ? (
            <Link href="/family/settings/account" className="self-start text-sm font-semibold underline underline-offset-4">
              Change it in Settings
            </Link>
          ) : (
            <AskName />
          )}
        </Step>
        <Step n={3} done={kids > 0} title={kids > 0 ? `${kids} kids ${kids === 1 ? "profile" : "profiles"} added` : "Add your first child"}>
          <p>Each child gets their own bookshelf and place in every story.</p>
          {plan ? (
            <Link href="/family/kids" className={`${kids > 0 ? buttonSecondary : buttonPrimary} self-start`}>
              {kids > 0 ? "Manage kids profiles" : "Add a child"}
            </Link>
          ) : (
            <p className="text-sm text-muted">Opens as soon as your plan starts.</p>
          )}
        </Step>
        <Step n={4} done={false} title="Prepare your first book">
          <p>Pick a story and choose whose voice reads it. Your monthly narration credits cover it.</p>
          {plan ? (
            <Link href="/family/books" className={`${buttonPrimary} self-start`}>
              Choose a story
            </Link>
          ) : (
            <p className="text-sm text-muted">Opens as soon as your plan starts.</p>
          )}
        </Step>
      </ol>
      <Link href="/family" className="self-start font-semibold underline underline-offset-4">
        Go to my family
      </Link>
    </FamilyShell>
  );
}
