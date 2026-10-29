import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { parentPrimary, parentSecondary } from "@/components/brand/buttons";
import { CheckoutDone } from "@/components/family/BillingActions";
import { FamilyOff, FamilyShell, NeedsGrownUp } from "@/components/family/FamilyShell";
import { NameFamily } from "@/components/family/NameFamily";
import { PlanStarting } from "@/components/family/PlanStarting";
import { billingConfig } from "@/lib/billing/config";
import { confirmCheckout } from "@/lib/billing/confirm";
import { StripeApi } from "@/lib/billing/stripe-api";
import { accountDb } from "@/lib/family/account-store";
import { familyPage, guardianChildren } from "@/lib/family/page-data";
import { activeEntitlement, activeShare } from "@/lib/family/permissions";
import { homeHousehold, PROVISIONAL_FAMILY_NAME } from "@/lib/family/service";
import { serverConfig } from "@/lib/server/config";
import { accountVoiceDeps } from "@/lib/voice/account-voices";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Set up your family | Readli", robots: { index: false } };

function Step({ n, done, title, children }: { n: number; done: boolean; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4 rounded-2xl bg-surface p-5 ring-1 ring-ink/15 sm:p-6" data-testid={`setup-step-${n}`}>
      <span
        aria-hidden="true"
        className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold ${done ? "bg-mint text-ink" : "bg-ink/10 text-ink"}`}
      >
        {done ? "✓" : n}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <h2 className="text-lg font-semibold">
          {title}
          {done && <span className="sr-only"> (done)</span>}
        </h2>
        {children}
      </div>
    </li>
  );
}

/**
 * Where Family checkout from signup comes back to: thanks them, waits for the payment to turn the plan
 * on, then walks through what makes Readli work, in order: a voice to read, a child to hear it, and a
 * first story. The family's name is optional and waits at the bottom; what to call you lives in Settings.
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
  const kids = guardianChildren(state, adultId).length;
  // A voice to read with: your own recording (even while it's still processing), or a storyteller's shared with the family.
  const deps = session.account ? accountVoiceDeps(serverConfig()) : null;
  const ownRecording = deps ? await deps.store.findVoice(adultId).catch(() => null) : null;
  const sharedVoice = state.voices.some((v) => v.status === "ready" && v.deletedAt === null && activeShare(state, v.id, home) !== null);
  const voice = Boolean(ownRecording) || sharedVoice;
  const opensLater = <p className="text-sm text-muted">Opens as soon as your plan starts.</p>;

  return (
    <FamilyShell>
      {q.checkout === "success" && <CheckoutDone sessionId={q.session_id} />}
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-semibold sm:text-4xl">
          {!plan ? "Almost there" : q.checkout === "success" ? "Thank you! Readli Family is on." : "Welcome to Readli Family"}
        </h1>
        <p>Three steps and your kids can start listening.</p>
      </header>
      {!plan && <PlanStarting waiting="Thank you! Your plan starts as soon as the payment goes through, usually within a minute. You can record your voice while you wait." />}
      <ol className="flex flex-col gap-3">
        <Step n={1} done={voice} title={voice ? "A voice is ready to read" : "Record your voice"}>
          {voice ? (
            <Link href="/family/my-voice" className="self-start text-sm font-semibold underline underline-offset-4">
              Manage my voice
            </Link>
          ) : (
            <>
              <p>Read a short passage aloud. Readli uses it to read every story to your kids in your voice.</p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <Link href="/voice/record?next=/family/setup" className={parentPrimary}>
                  Record my voice
                </Link>
                <Link href="/family/narrators#invite" className="text-sm font-semibold underline underline-offset-4">
                  Or invite a grandparent to record
                </Link>
              </div>
            </>
          )}
        </Step>
        <Step n={2} done={kids > 0} title={kids > 0 ? `${kids} ${kids === 1 ? "child" : "children"} added` : "Add your kids"}>
          <p>Each child gets their own bookshelf, and you choose whose voices they hear.</p>
          {plan ? (
            <Link href="/family/kids" className={`${kids > 0 || !voice ? parentSecondary : parentPrimary} self-start`}>
              {kids > 0 ? "Manage kids" : "Add a child"}
            </Link>
          ) : (
            opensLater
          )}
        </Step>
        <Step n={3} done={false} title="Pick their first story">
          <p>Choose a book and whose voice reads it. Your monthly narration credits cover it.</p>
          {plan ? (
            <Link href="/family/books" className={`${voice && kids > 0 ? parentPrimary : parentSecondary} self-start`}>
              Choose a story
            </Link>
          ) : (
            opensLater
          )}
        </Step>
      </ol>
      <section aria-labelledby="optional" className="flex flex-col gap-3 rounded-2xl p-5 ring-1 ring-ink/10 sm:p-6">
        <h2 id="optional" className="text-lg font-semibold">
          Optional: name your family
        </h2>
        <NameFamily current={named ? familyName : ""} />
      </section>
      <Link href="/family" className="self-start font-semibold underline underline-offset-4">
        Go to my family
      </Link>
    </FamilyShell>
  );
}
