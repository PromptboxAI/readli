import type { Metadata } from "next";
import Link from "next/link";
import { GiftBuilder } from "@/components/gifting/GiftBuilder";
import { TheirHome } from "@/components/gifting/TheirHome";
import { AdultPage, Eyebrow } from "@/components/invites/AdultPage";
import { GiftBoxArt } from "@/components/invites/illustrations";
import { draftFromParams } from "@/lib/gifting/params";

export const metadata: Metadata = { title: "Invite & Gift | Readli", robots: { index: false } };

export default async function InviteGiftPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  // Coming back from checkout ("Edit gift") refills the form.
  const initial = params.plan ? draftFromParams(params) : undefined;
  const today = new Date().toISOString().slice(0, 10);
  return (
    <AdultPage>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <GiftBoxArt className="w-28 shrink-0" />
        <div className="flex flex-col gap-2">
          <Link href="/invite" className="w-fit font-display font-semibold underline-offset-4 hover:underline">
            ← Invite
          </Link>
          <Eyebrow>Invite &amp; Gift</Eyebrow>
          <h1 className="font-display text-4xl font-semibold sm:text-5xl">Give a family Readli</h1>
          <p className="text-lg">Their own library of classic stories, read by the people they love.</p>
        </div>
      </header>
      <div className="flex justify-end">
        <Link href="/invite/gift/manage" className="font-display font-semibold underline underline-offset-4">
          Manage gifts you&apos;ve given
        </Link>
      </div>
      <GiftBuilder today={today} initial={initial} />
      <TheirHome />
    </AdultPage>
  );
}
