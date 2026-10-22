import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ContributorDashboard } from "@/components/accounts/ContributorDashboard";
import { AdultPage, PreviewNote } from "@/components/invites/AdultPage";
import { currentAdult } from "@/lib/auth/adult";
import { familyAccountsEnabled } from "@/lib/family/session";

export const metadata: Metadata = { title: "My voice | Readli Voice", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Free contributor dashboard. Older invitation links (/voice?invite=) go to the join page. */
export default async function VoiceDashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const p = await searchParams;
  if (typeof p.invite === "string" && p.invite) redirect(`/voice/join?invite=${encodeURIComponent(p.invite)}`);
  // A real account manages its real voice, not this example.
  if (familyAccountsEnabled() && (await currentAdult())) redirect("/family/my-voice");
  return (
    <AdultPage>
      <PreviewNote>This is an example Readli Voice dashboard. Nothing here changes a real voice.</PreviewNote>
      <ContributorDashboard invited={false} />
    </AdultPage>
  );
}
