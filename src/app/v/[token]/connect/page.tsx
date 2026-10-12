import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { buttonSecondary } from "@/components/brand/buttons";
import { CreateFamily } from "@/components/family/CreateFamily";
import { CircleSetup } from "@/components/invitations/CircleSetup";
import { ConnectStoryteller } from "@/components/invitations/ConnectStoryteller";
import { AdultPage, Eyebrow } from "@/components/invites/AdultPage";
import { paymentsOn } from "@/lib/billing/config";
import { familyPage, guardianChildren } from "@/lib/family/page-data";
import { activeEntitlement, activeSlot } from "@/lib/family/permissions";
import { formatPrice } from "@/lib/family/plan";
import { guardianHousehold, narratorSlots } from "@/lib/family/service";
import { familyStore } from "@/lib/family/session";
import { invitationContext } from "@/lib/invitations/context";
import { landingFor } from "@/lib/invitations/server";

export const metadata: Metadata = { title: "Add a storyteller | Readli", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** From an invitation: sign in, set up the family if needed, connect the storyteller, then choose a slot and each child. */
export default async function ConnectInvitationPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { token } = await params;
  const billing = (await searchParams).billing === "annual" ? "annual" : "monthly";
  const ctx = invitationContext();
  if (!ctx) notFound();
  const landing = await landingFor(ctx.db, ctx.secret, token);
  if (!landing) notFound();
  const page = await familyPage();
  if (!page.enabled) notFound();
  if (!page.session?.account || page.session.actor.kind !== "adult") redirect(`/login?next=${encodeURIComponent(`/v/${token}/connect?billing=${billing}`)}`);
  const actor = page.session.actor;
  const store = (await familyStore(page.session))!;
  const state = await store.read();
  const name = landing.contributorName;
  const householdId = await guardianHousehold(store, actor);
  const header = (
    <header className="flex flex-col gap-2">
      <Eyebrow>Readli Family</Eyebrow>
      <h1 className="font-display text-4xl font-semibold sm:text-5xl">Add {name} as a storyteller</h1>
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
  if (!householdId) {
    const member = state.members.some((m) => m.adultId === actor.adultId && m.removedAt === null);
    return (
      <AdultPage>
        {header}
        {member ? (
          <p className="text-lg">Only a parent or guardian can add a storyteller. Ask the parent who set up your family to open this link.</p>
        ) : (
          <>
            <p className="text-lg">First, name your family. Then we&apos;ll add {name}.</p>
            <CreateFamily />
          </>
        )}
      </AdultPage>
    );
  }
  if (landing.status !== "accepted") {
    const familyName = state.households.find((h) => h.id === householdId)?.name ?? "your family";
    return (
      <AdultPage>
        {header}
        <ConnectStoryteller token={token} name={name} familyName={familyName} />
      </AdultPage>
    );
  }

  const voice = state.voices.find((v) => v.ownerId === landing.contributorId && v.deletedAt === null);
  if (!voice) {
    return (
      <AdultPage>
        {header}
        <p className="text-lg">{name}&apos;s voice isn&apos;t available right now.</p>
      </AdultPage>
    );
  }
  const slots = await narratorSlots(store, actor, householdId);
  const kids = guardianChildren(state, actor.adultId).filter((c) => c.householdId === householdId);
  return (
    <AdultPage>
      {header}
      <CircleSetup
        name={name}
        voiceId={voice.id}
        hasPlan={Boolean(activeEntitlement(state, householdId))}
        active={Boolean(activeSlot(state, voice.id, householdId, store.plan))}
        slotsUsed={slots.active.length}
        slotsTotal={slots.total}
        slotPrice={formatPrice(slots.extraSlotPriceCents)}
        slotsForSale={slots.extraSlotPriceApproved}
        kids={kids.map((k) => ({ id: k.id, nickname: k.nickname, approved: state.approvals.some((a) => a.voiceId === voice.id && a.childId === k.id && a.revokedAt === null) }))}
        checkout={{ invitationId: landing.id, billing, paymentsOn: paymentsOn() }}
      />
    </AdultPage>
  );
}
