import type { Metadata } from "next";
import Link from "next/link";
import { buttonPrimary } from "@/components/brand/buttons";
import { AdultPage, Eyebrow } from "@/components/invites/AdultPage";
import { GiftCardDesigner } from "@/components/sponsorship/GiftCardDesigner";
import { currentAdult } from "@/lib/auth/adult";
import { sponsorshipContext } from "@/lib/sponsorship/http";
import { sponsorGifts } from "@/lib/sponsorship/view";
import { BackTo } from "@/components/nav/BackTrail";

export const metadata: Metadata = { title: "Print a gift card | Readli", robots: { index: false } };
export const dynamic = "force-dynamic";

/** The giver designs, previews and downloads a printable card for one of their Readli Family gifts. */
export default async function GiftCardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  const ctx = await sponsorshipContext();
  const user = await currentAdult();
  const id = typeof q.gift === "string" ? q.gift : "";
  if (!ctx || !user) {
    return (
      <AdultPage>
        <section className="flex flex-col items-center gap-4 text-center">
          <Eyebrow>Readli Family gift</Eyebrow>
          <h1 className="font-display text-4xl font-semibold">Print a gift card</h1>
          <p className="max-w-lg text-lg">Sign in to make a card for a gift you gave.</p>
          <Link href={`/login?next=${encodeURIComponent(`/gift/family/card?gift=${id}`)}`} className={buttonPrimary}>
            Sign in
          </Link>
        </section>
      </AdultPage>
    );
  }
  const gifts = (await sponsorGifts(ctx.db, user.id)).filter((g) => g.status !== "ended" && g.status !== "refunded" && g.places.some((p) => p.state !== "ended"));
  const gift = gifts.find((g) => g.id === id) ?? gifts[0];
  if (!gift) {
    return (
      <AdultPage>
        <section className="flex flex-col items-center gap-4 text-center">
          <Eyebrow>Readli Family gift</Eyebrow>
          <h1 className="font-display text-4xl font-semibold">Print a gift card</h1>
          <p className="max-w-lg text-lg">You don&apos;t have a gift to make a card for yet.</p>
          <Link href="/gift/family" className={buttonPrimary}>
            Give Readli Family
          </Link>
        </section>
      </AdultPage>
    );
  }
  return (
    <AdultPage wide>
      <header className="flex flex-col gap-2">
        <BackTo fallback={{ href: "/gift/family", label: "your gift" }} look="back-to" className="w-fit font-semibold underline underline-offset-4" />
        <Eyebrow>Readli Family gift</Eyebrow>
        <h1 className="font-display text-4xl font-semibold sm:text-5xl">Print a gift card</h1>
        <p className="max-w-2xl text-lg">
          Something to hand over in person or tuck into a holiday card. Change the words, check the preview, then download it and print it on regular letter paper.
        </p>
      </header>
      <GiftCardDesigner gift={gift} origin={ctx.base} />
    </AdultPage>
  );
}
