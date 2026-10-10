import type { Metadata } from "next";
import Link from "next/link";
import { VoiceSetup } from "@/components/accounts/VoiceSetup";
import { AdultPage, Eyebrow, PreviewNote } from "@/components/invites/AdultPage";

export const metadata: Metadata = { title: "Record your voice | Readli Voice", robots: { index: false } };

export default function VoiceRecordPage() {
  return (
    <AdultPage wide>
      <header className="flex flex-col gap-2">
        <Link href="/voice" className="w-fit font-display font-semibold underline-offset-4 hover:underline">
          ← My voice
        </Link>
        <Eyebrow>Readli Voice</Eyebrow>
        <h1 className="font-display text-4xl font-semibold sm:text-5xl">Make your Readli voice</h1>
      </header>
      <PreviewNote>Your recording stays in this browser. Nothing is saved yet.</PreviewNote>
      <VoiceSetup />
    </AdultPage>
  );
}
