import type { Metadata } from "next";
import Link from "next/link";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import { AdultPage, Eyebrow } from "@/components/invites/AdultPage";
import { GiftBoxArt } from "@/components/invites/illustrations";
import { GiveFamilyForm } from "@/components/sponsorship/GiveFamilyForm";
import { SponsorDashboard } from "@/components/sponsorship/SponsorDashboard";
import { currentAdult } from "@/lib/auth/adult";
import { sponsorshipContext } from "@/lib/sponsorship/http";
import { sponsorGifts } from "@/lib/sponsorship/view";

export const metadata: Metadata = { title: "Give Readli Family | Readli", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * A grandparent gives Readli Family to up to two of their children's families, and later manages it
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
          <h1 className="font-display text-4xl font-semibold sm:text-5xl">Give your grandchildren Readli Family</h1>
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
  const { data: voice } = await ctx.db.from("voice_profiles").select("id").eq("owner_id", user.id).eq("status", "ready").is("deleted_at", null).limit(1);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <AdultPage wide>
      {q.checkout === "success" && (
        <p role="status" className="rounded-2xl bg-mint/40 px-4 py-3">
          Thank you! Your gift is paid. It shows here as soon as the payment goes through, usually within a minute.
        </p>
      )}
      {q.checkout === "canceled" && <p role="status" className="rounded-2xl bg-surface px-4 py-3 ring-2 ring-ink/10">Checkout was canceled. Nothing was charged.</p>}
      {giving ? (
        <>
          <header className="flex flex-col gap-2">
            <Eyebrow>Readli Family gift</Eyebrow>
            <h1 className="font-display text-4xl font-semibold sm:text-5xl">Give your grandchildren Readli Family</h1>
            <p className="max-w-2xl text-lg">You pay for one plan. Each family runs its own home, children and approvals.</p>
          </header>
          <GiveFamilyForm today={today} hasVoice={Boolean(voice?.length)} defaultGiverName="" />
        </>
      ) : gifts.length ? (
        <>
          {gifts.map((g) => (
            <SponsorDashboard key={g.id} gift={g} />
          ))}
          {selling && (
            <Link href="/gift/family?new=1" className={`${buttonSecondary} self-start`}>
              Give another gift
            </Link>
          )}
        </>
      ) : (
        <p className="text-lg">Family gifts are coming soon.</p>
      )}
    </AdultPage>
  );
}
