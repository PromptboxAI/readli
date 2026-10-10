import type { Metadata } from "next";
import Link from "next/link";
import { AdultPage, Eyebrow, PreviewNote } from "@/components/invites/AdultPage";
import { InviteFamilyForm } from "@/components/invites/InviteFamilyForm";
import { TwoYeses } from "@/components/invites/TwoYeses";

export const metadata: Metadata = { title: "Invite Family | Readli", robots: { index: false } };

export default function InviteFamilyPage() {
  return (
    <AdultPage wide>
      <header className="flex flex-col gap-2">
        <Link href="/invite" className="w-fit font-display font-semibold underline-offset-4 hover:underline">
          ← Invite
        </Link>
        <Eyebrow>Invite Family</Eyebrow>
        <h1 className="font-display text-4xl font-semibold sm:text-5xl">Invite a storyteller</h1>
        <p className="max-w-2xl text-lg">
          They join your family circle and record their own voice. Their voice stays theirs until they choose to share it.
        </p>
      </header>
      <PreviewNote />
      <InviteFamilyForm />
      <TwoYeses />
    </AdultPage>
  );
}
