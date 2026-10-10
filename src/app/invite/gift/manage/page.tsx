import type { Metadata } from "next";
import Link from "next/link";
import { buttonPrimary } from "@/components/brand/buttons";
import { GiftManager } from "@/components/gifting/GiftManager";
import { AdultPage, Eyebrow, PreviewNote } from "@/components/invites/AdultPage";

export const metadata: Metadata = { title: "Your gifts | Readli", robots: { index: false } };
export const dynamic = "force-dynamic";

export default function ManageGiftsPage() {
  return (
    <AdultPage>
      <header className="flex flex-col gap-2">
        <Link href="/invite/gift" className="w-fit font-display font-semibold underline-offset-4 hover:underline">
          ← Invite &amp; Gift
        </Link>
        <Eyebrow>Invite &amp; Gift</Eyebrow>
        <h1 className="font-display text-4xl font-semibold sm:text-5xl">Gifts you&apos;ve given</h1>
        <p className="text-lg">See what&apos;s been opened, stop a sponsorship, or send another.</p>
      </header>
      <PreviewNote>These are example gifts. Nothing here changes a real gift or payment.</PreviewNote>
      <GiftManager nowIso={new Date().toISOString()} />
      <Link href="/invite/gift" className={`${buttonPrimary} w-fit`}>
        Give a new gift
      </Link>
    </AdultPage>
  );
}
