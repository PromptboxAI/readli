import type { Metadata } from "next";
import Link from "next/link";
import { GiftCartForm } from "@/components/gifting/GiftCartForm";
import { AdultPage, Eyebrow } from "@/components/invites/AdultPage";
import { billingConfig } from "@/lib/billing/config";
import { PREPAID_PLAN_IDS } from "@/lib/gifting/cart";
import { GIFT_PLANS, giftPaymentsOpen } from "@/lib/gifting/plans";

export const metadata: Metadata = { title: "Send several gifts | Readli", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function SeveralGiftsPage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const q = await searchParams;
  const plans = GIFT_PLANS.filter((p) => (PREPAID_PLAN_IDS as readonly string[]).includes(p.id));
  const open = billingConfig().mode !== "off" && giftPaymentsOpen();
  return (
    <AdultPage>
      <header className="flex flex-col gap-2">
        <Link href="/invite/gift" className="w-fit font-display font-semibold underline-offset-4 hover:underline">
          ← One gift
        </Link>
        <Eyebrow>Invite &amp; Gift</Eyebrow>
        <h1 className="font-display text-4xl font-semibold sm:text-5xl">Give Readli to several families</h1>
        <p className="text-lg">One checkout for everyone. Pick how long each family gets, and when their gift arrives.</p>
      </header>
      {q.checkout === "canceled" && (
        <p role="status" className="rounded-2xl bg-surface px-4 py-3 ring-2 ring-ink/10">
          Checkout was canceled. Nothing was charged and no gifts were sent.
        </p>
      )}
      <GiftCartForm plans={plans} today={new Date().toISOString().slice(0, 10)} open={open} />
    </AdultPage>
  );
}
