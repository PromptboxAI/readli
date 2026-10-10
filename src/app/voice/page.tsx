import type { Metadata } from "next";
import { ContributorDashboard } from "@/components/accounts/ContributorDashboard";
import { AdultPage, PreviewNote } from "@/components/invites/AdultPage";

export const metadata: Metadata = { title: "My voice | Readli Voice", robots: { index: false } };

/** Free contributor dashboard. With accounts, an ?invite= link adds that family's request for the signed-in adult. */
export default async function VoiceDashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const p = await searchParams;
  return (
    <AdultPage>
      <PreviewNote>This is an example Readli Voice dashboard. Nothing here changes a real voice.</PreviewNote>
      <ContributorDashboard invited={typeof p.invite === "string"} />
    </AdultPage>
  );
}
