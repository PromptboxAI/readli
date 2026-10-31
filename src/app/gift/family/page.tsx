import type { Metadata } from "next";
import Link from "next/link";
import { buttonPrimary } from "@/components/brand/buttons";
import { AdultPage, Eyebrow } from "@/components/invites/AdultPage";
import { GiftBoxArt } from "@/components/invites/illustrations";
import { GiveFamilyForm } from "@/components/sponsorship/GiveFamilyForm";
import { SponsorDashboard } from "@/components/sponsorship/SponsorDashboard";
import { currentAdult } from "@/lib/auth/adult";
import { sponsorshipContext } from "@/lib/sponsorship/http";
import { sponsorGifts } from "@/lib/sponsorship/view";
import { serverConfig } from "@/lib/server/config";
import { accountVoiceDeps } from "@/lib/voice/account-voices";

export const metadata: Metadata = { title: "Give Readli Family | Readli", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Anyone gives Readli Family to up to two families, and later manages it
 * here. Selling needs the sponsored_family switch; a sponsor with a gift can always see and manage it.
 */
export default async function GiveFamilyPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  const [ctx, selling] = await Promise.all([sponsorshipContext(), sponsorshipContext({ newGifts: true })]);
  const user = await currentAdult();
  if (!ctx || !user) {
    return (
      <AdultPage>
        <section className="flex flex-col items-center gap-4 text-center">
          <GiftBoxArt className="w-32" />
          <Eyebrow>Readli Family gift</Eyebrow>
          <h1 className="font-display text-4xl font-semibold sm:text-5xl">Give Readli Family as a gift</h1>
          {!ctx ? (
            <p className="max-w-lg text-lg">Family gifts are coming soon.</p>
          ) : (
            <>
              <p className="max-w-lg text-lg">Sign in to give a gift or to see one you gave.</p>
              <Link href="/login?next=/gift/family" className={buttonPrimary}>
                Sign in
              </Link>
            </>
          )}
        </section>
      </AdultPage>
    );
  }

  const gifts = await sponsorGifts(ctx.db, user.id);
  const giving = Boolean(selling) && (gifts.length === 0 || q.new === "1");
  // The same lookup My Voice uses, so a voice that's ready there can be shared here.
  const deps = accountVoiceDeps(serverConfig());
  const voice = deps
    ? await deps.store.findVoice(user.id).catch((err) => {
        console.error("gift page: voice lookup failed", err);
        return null;
      })
    : null;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <AdultPage wide>
      {q.checkout === "success" && (
        <p role="status" className="flex items-center gap-3 rounded-2xl bg-mint/40 px-4 py-3">
          <GiftBoxArt open className="w-12 shrink-0" />
          <span>
            <span className="font-display text-lg font-semibold">Thank you, your gift is on its way!</span> It shows here as soon as the payment goes through, usually within a minute.
          </span>
        </p>
      )}
      {q.checkout === "canceled" && <p role="status" className="rounded-2xl bg-surface px-4 py-3 ring-2 ring-ink/10">Checkout was canceled. Nothing was charged.</p>}
      {giving ? (
        <>
          <header className="flex flex-col gap-2">
            <Eyebrow>Readli Family gift</Eyebrow>
            <h1 className="font-display text-4xl font-semibold sm:text-5xl">Give Readli Family as a gift</h1>
            <p className="max-w-2xl text-lg">You pay for one plan. Each family runs its own home, children and approvals.</p>
          </header>
          <GiveFamilyForm today={today} hasVoice={voice?.status === "ready"} defaultGiverName="" />
        </>
      ) : gifts.length ? (
        <>
          {gifts.map((g) => (
            <SponsorDashboard key={g.id} gift={g} />
          ))}
          {selling && (
            <aside className="flex flex-col items-center gap-5 rounded-[32px] bg-lavender/30 px-6 py-8 text-center sm:flex-row sm:text-left">
              <GiftBoxArt className="w-24 shrink-0" />
              <div className="flex flex-1 flex-col gap-1">
                <p className="font-display text-2xl font-semibold">Know another family who&apos;d love bedtime stories?</p>
                <p className="text-lg text-ink/80">Another gift covers two more families, with their own stories every month.</p>
              </div>
              <Link href="/gift/family?new=1" className={`${buttonPrimary} shrink-0`}>
                Give another gift
              </Link>
            </aside>
          )}
        </>
      ) : (
        <p className="text-lg">Family gifts are coming soon.</p>
      )}
    </AdultPage>
  );
}
