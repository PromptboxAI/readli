import type { Metadata } from "next";
import { BackLink } from "@/components/family/BackLink";
import { NarratorSlotPurchase } from "@/components/accounts/NarratorSlotPurchase";
import { AdultPage, Eyebrow, PreviewNote } from "@/components/invites/AdultPage";

export const metadata: Metadata = { title: "Add narrator slots | Readli", robots: { index: false } };

export default function NarratorSlotsPage() {
  return (
    <AdultPage wide>
      <header className="flex flex-col gap-2">
        <BackLink href="/family/narrators" label="Storytellers" />
        <Eyebrow>Readli Family</Eyebrow>
        <h1 className="font-display text-4xl font-semibold sm:text-5xl">Add a storyteller slot</h1>
        <p className="max-w-2xl text-lg">Room for more of the voices your kids love.</p>
      </header>
      <PreviewNote>This is an example family. Nothing here changes a real plan.</PreviewNote>
      <NarratorSlotPurchase />
    </AdultPage>
  );
}
