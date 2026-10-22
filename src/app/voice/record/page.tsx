import type { Metadata } from "next";
import Link from "next/link";
import { AccountVoiceSetup } from "@/components/accounts/AccountVoiceSetup";
import { VoiceSetup } from "@/components/accounts/VoiceSetup";
import { currentAdult } from "@/lib/auth/adult";
import { safeNext } from "@/lib/auth/supabase";
import { serverConfig } from "@/lib/server/config";
import { accountVoiceDeps } from "@/lib/voice/account-voices";
import { familyPage } from "@/lib/family/page-data";
import { isParent } from "@/lib/family/storyteller";
import { AdultPage, Eyebrow, PreviewNote } from "@/components/invites/AdultPage";

export const metadata: Metadata = { title: "Record your voice | Readli Voice", robots: { index: false } };

export const dynamic = "force-dynamic";

/** Signed in, with voices switched on: the real flow. Otherwise the in-browser preview. */
export default async function VoiceRecordPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const p = await searchParams;
  // A storyteller invitation sends people here and expects them back to share with that family.
  const next = typeof p.next === "string" ? safeNext(p.next, "") : "";
  const deps = accountVoiceDeps(serverConfig());
  const user = deps ? await currentAdult() : null;
  const existing = deps && user ? await deps.store.findVoice(user.id).catch(() => null) : null;
  const page = user ? await familyPage() : null;
  const parent = Boolean(user && page?.enabled && isParent(page.state, user.id));
  return (
    <AdultPage wide>
      <header className="flex flex-col gap-2">
        <Link href={parent ? "/family/my-voice" : "/voice"} className="w-fit font-display font-semibold underline-offset-4 hover:underline">
          ← My voice
        </Link>
        <Eyebrow>Readli Voice</Eyebrow>
        <h1 className="font-display text-4xl font-semibold sm:text-5xl">Make your Readli voice</h1>
      </header>
      {user ? (
        <AccountVoiceSetup hasVoice={Boolean(existing)} next={next || undefined} parent={parent} />
      ) : (
        <>
          <PreviewNote>Your recording stays in this browser. Nothing is saved yet.</PreviewNote>
          <VoiceSetup />
        </>
      )}
    </AdultPage>
  );
}
