import type { Metadata } from "next";
import { RedeemForm } from "@/components/gifting/RedeemForm";
import { AdultPage, Eyebrow } from "@/components/invites/AdultPage";
import { GiftBoxArt } from "@/components/invites/illustrations";

export const metadata: Metadata = { title: "Redeem a gift | Readli", robots: { index: false } };

export default function RedeemGiftPage() {
  return (
    <AdultPage>
      <section className="flex flex-col items-center gap-4 text-center">
        <GiftBoxArt className="w-32" />
        <Eyebrow>Readli gift</Eyebrow>
        <h1 className="font-display text-4xl font-semibold sm:text-5xl">Someone sent you Readli</h1>
        <p className="max-w-lg text-lg">Type the code from your gift email, or tap the link in it to open your gift.</p>
        <RedeemForm />
      </section>
    </AdultPage>
  );
}
