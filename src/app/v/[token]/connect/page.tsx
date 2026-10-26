import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { buttonSecondary } from "@/components/brand/buttons";
import { CheckoutDone } from "@/components/family/BillingActions";
import { StorytellerSteps } from "@/components/invitations/StorytellerSteps";
import { AdultPage, Eyebrow } from "@/components/invites/AdultPage";
import { paymentsOn } from "@/lib/billing/config";
import { familyPage, guardianChildren } from "@/lib/family/page-data";
import { activeEntitlement, activeSlot } from "@/lib/family/permissions";
import { pricing } from "@/lib/content/pricing";
import { formatPrice } from "@/lib/family/plan";
import { guardianHousehold, narratorSlots } from "@/lib/family/service";
import { familyStore } from "@/lib/family/session";
import { invitationContext } from "@/lib/invitations/context";
import { landingFor } from "@/lib/invitations/server";

export const metadata: Metadata = { title: "Add a storyteller | Readli", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * From an invitation: sign in, then one guided sequence. Connect the storyteller (starting a family if
 * needed), start Readli Family, give them a storyteller slot, choose each child, prepare the book.
 * Checkout returns here, so the invitation survives sign-in, Stripe and the webhook.
 */
export default async function ConnectInvitationPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { token } = await params;
  const q = await searchParams;
  const billing = q.billing === "annual" ? "annual" : "monthly";
  const ctx = invitationContext();
  if (!ctx) notFound();
  const landing = await landingFor(ctx.db, ctx.secret, token);
  if (!landing) notFound();
  const page = await familyPage();
  if (!page.enabled) notFound();
  if (!page.session?.account || page.session.actor.kind !== "adult") redirect(`/login?next=${encodeURIComponent(`/v/${token}/connect?billing=${billing}${q.connect === "1" ? "&connect=1" : ""}`)}`);
  const actor = page.session.actor;
  const store = (await familyStore(page.session))!;
  const state = await store.read();
  const name = landing.contributorName;
  const householdId = await guardianHousehold(store, actor);
  const header = (
    <header className="flex flex-col gap-2">
      <Eyebrow>Readli Family</Eyebrow>
      <h1 className="font-display text-3xl font-semibold sm:text-5xl">Add {name} to your family</h1>
    </header>
  );

  if (landing.status === "accepted" && landing.householdId !== householdId) {
    return (
      <AdultPage>
        {header}
        <p className="text-lg">This invitation has already been used.</p>
      </AdultPage>
    );
  }
  if (landing.status !== "accepted" && landing.status !== "pending" && landing.status !== "opened") {
    return (
      <AdultPage>
        {header}
        <p className="text-lg">{landing.status === "expired" ? `This invitation has expired. Ask ${name} to send a new one.` : "This invitation isn't available any more."}</p>
        <Link href="/family" className={`${buttonSecondary} w-fit`}>
          Go to your family
        </Link>
      </AdultPage>
    );
  }
  const member = state.members.some((m) => m.adultId === actor.adultId && m.removedAt === null);
  if (!householdId && member) {
    return (
      <AdultPage>
        {header}
        <p className="text-lg">Only a parent or guardian can add a storyteller. Ask the parent who set up your family to open this link.</p>
      </AdultPage>
    );
  }

  const connected = landing.status === "accepted";
  const voice = connected ? state.voices.find((v) => v.ownerId === landing.contributorId && v.deletedAt === null) : undefined;
  if (connected && !voice) {
    return (
      <AdultPage>
        {header}
        <p className="text-lg">{name}&apos;s voice isn&apos;t available right now.</p>
      </AdultPage>
    );
  }
  const P = await pricing();
  const hasPlan = Boolean(householdId && activeEntitlement(state, householdId));
  const slots = householdId ? await narratorSlots(store, actor, householdId) : null;
  const kids = householdId ? guardianChildren(state, actor.adultId).filter((c) => c.householdId === householdId) : [];
  return (
    <AdultPage>
      {q.checkout === "success" && <CheckoutDone sessionId={typeof q.session_id === "string" ? q.session_id : undefined} />}
      {header}
      <StorytellerSteps
        token={token}
        name={name}
        connected={connected}
        needsFamily={!householdId}
        autoConnect={q.connect === "1"}
        voiceId={voice?.id ?? null}
        plan={hasPlan ? "active" : q.checkout === "success" ? "starting" : "none"}
        checkout={{
          invitationId: landing.id,
          billing,
          paymentsOn: paymentsOn(),
          canceled: q.checkout === "canceled",
          monthlyCents: P.familyMonthlyCents,
          annualCents: P.familyAnnualCents,
          monthly: formatPrice(P.familyMonthlyCents),
          annual: formatPrice(P.familyAnnualCents),
          monthlyCredits: P.monthlyCredits,
        }}
        active={Boolean(voice && householdId && activeSlot(state, voice.id, householdId, store.plan))}
        slotsUsed={slots?.active.length ?? 0}
        slotsTotal={slots?.total ?? 0}
        slotPrice={formatPrice(slots?.extraSlotPriceCents ?? 0)}
        slotsForSale={Boolean(slots?.extraSlotPriceApproved)}
        kids={kids.map((k) => ({ id: k.id, nickname: k.nickname, approved: Boolean(voice) && state.approvals.some((a) => a.voiceId === voice!.id && a.childId === k.id && a.revokedAt === null) }))}
        book={landing.hasPreview && landing.book ? { slug: landing.book.slug, title: landing.book.title, coverUrl: landing.book.coverUrl } : null}
      />
    </AdultPage>
  );
}
