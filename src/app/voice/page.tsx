import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ContributorDashboard } from "@/components/accounts/ContributorDashboard";
import { AcceptInvite } from "@/components/invites/AcceptInvite";
import { AdultPage, PreviewNote } from "@/components/invites/AdultPage";
import { inviteeLanding } from "@/lib/invites/page-data";

export const metadata: Metadata = { title: "My voice | Readli Voice", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Free contributor dashboard. With accounts, an ?invite= link lets the signed-in adult join that family. */
export default async function VoiceDashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const p = await searchParams;
  const token = typeof p.invite === "string" ? p.invite : null;
  const landing = token ? await inviteeLanding(token) : null;
  if (token && landing && !landing.signedIn) redirect(`/login?next=${encodeURIComponent(`/voice?invite=${token}`)}`);
  return (
    <AdultPage>
      {token && landing && <AcceptInvite token={token} invite={landing.invite} />}
      <PreviewNote>This is an example Readli Voice dashboard. Nothing here changes a real voice.</PreviewNote>
      <ContributorDashboard invited={Boolean(token) && !landing} />
    </AdultPage>
  );
}
