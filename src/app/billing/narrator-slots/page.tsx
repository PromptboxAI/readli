import type { Metadata } from "next";
import Link from "next/link";
import { NarratorSlotPurchase } from "@/components/accounts/NarratorSlotPurchase";
import { AdultPage, Eyebrow, PreviewNote } from "@/components/invites/AdultPage";

export const metadata: Metadata = { title: "Add narrator slots | Readli", robots: { index: false } };

export default function NarratorSlotsPage() {
  return (
    <AdultPage wide>
      <header className="flex flex-col gap-2">
        <Link href="/family" className="w-fit font-display font-semibold underline-offset-4 hover:underline">
          ← Family
        </Link>
        <Eyebrow>Readli Family</Eyebrow>
        <h1 className="font-display text-4xl font-semibold sm:text-5xl">Add a storyteller slot</h1>
        <p className="max-w-2xl text-lg">Room for more of the voices your kids love.</p>
      </header>
      <PreviewNote>This is an example family. Nothing here changes a real plan.</PreviewNote>
      <NarratorSlotPurchase />
    </AdultPage>
  );
}
