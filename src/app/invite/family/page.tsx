import type { Metadata } from "next";
import Link from "next/link";
import { AdultPage, Eyebrow, PreviewNote } from "@/components/invites/AdultPage";
import { InviteFamilyForm } from "@/components/invites/InviteFamilyForm";
import { TwoYeses } from "@/components/invites/TwoYeses";
import { buttonPrimary } from "@/components/brand/buttons";
import { inviterPage } from "@/lib/invites/page-data";

export const metadata: Metadata = { title: "Invite Family | Readli", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function InviteFamilyPage() {
  const page = await inviterPage();
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
      {page.mode === "live" && <InviteFamilyForm live fromName={page.fromName} initial={page.invites} />}
      {page.mode === "preview" && (
        <>
          <PreviewNote />
          <InviteFamilyForm />
        </>
      )}
      {page.mode !== "live" && page.mode !== "preview" && (
        <section className="flex flex-col items-start gap-3 rounded-[var(--radius-panel)] bg-sunshine/50 p-6" data-testid="invite-gate">
          <p className="text-lg">
            {page.mode === "sign_in" ? "Log in to invite family to your circle." : "Create your family first, then invite your storytellers."}
          </p>
          <Link href={page.mode === "sign_in" ? "/login?next=/invite/family" : "/family"} className={buttonPrimary}>
            {page.mode === "sign_in" ? "Log in" : "Set up my family"}
          </Link>
        </section>
      )}
      <TwoYeses />
    </AdultPage>
  );
}
