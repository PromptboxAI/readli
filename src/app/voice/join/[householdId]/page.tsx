import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonPrimary } from "@/components/brand/buttons";
import { AdultPage, Eyebrow } from "@/components/invites/AdultPage";
import { JoinSteps } from "@/components/invites/JoinSteps";
import { currentAdult } from "@/lib/auth/adult";
import { familyPage } from "@/lib/family/page-data";
import { isActiveMember } from "@/lib/family/permissions";
import { myVoices } from "@/lib/family/service";
import { familyStore } from "@/lib/family/session";

export const metadata: Metadata = { title: "Your storyteller steps | Readli Voice", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * After accepting a family's invitation: record (skipped when a ready voice exists), then share with
 * that family. Only the voice owner sees this; the family's parents still add them to a slot and
 * approve each child themselves.
 */
export default async function JoinStepsPage({ params }: { params: Promise<{ householdId: string }> }) {
  const { householdId } = await params;
  const here = `/voice/join/${householdId}`;
  const user = await currentAdult();
  if (!user) redirect(`/login?next=${encodeURIComponent(here)}`);
  const page = await familyPage();
  const store = page.enabled && page.session?.account && page.session.actor.kind === "adult" ? await familyStore(page.session) : null;
  const state = page.enabled ? page.state : null;
  const family = state?.households.find((h) => h.id === householdId);
  if (!store || !state || !family || !isActiveMember(state, user.id, householdId)) {
    return (
      <AdultPage>
        <section role="alert" className="flex flex-col items-start gap-3 rounded-[var(--radius-panel)] bg-coral/20 p-6">
          <h1 className="font-display text-2xl font-semibold">You&apos;re not part of that family yet</h1>
          <p>Open the invitation link the family sent you to join them first.</p>
          <Link href="/family/my-voice" className={buttonPrimary}>
            My voice
          </Link>
        </section>
      </AdultPage>
    );
  }
  const voice = (await myVoices(store, { kind: "adult", adultId: user.id }))[0] ?? null;
  const shared = voice?.households.find((h) => h.id === householdId)?.shared ?? false;
  return (
    <AdultPage>
      <header className="flex flex-col gap-2">
        <Eyebrow>Joining {family.name}</Eyebrow>
        <h1 className="font-display text-4xl font-semibold sm:text-5xl">Your storyteller steps</h1>
      </header>
      <JoinSteps
        householdId={householdId}
        familyName={family.name}
        voice={voice ? { id: voice.voiceId, ready: voice.status === "ready" } : null}
        shared={shared}
        recordHref={`/voice/record?next=${encodeURIComponent(here)}`}
      />
    </AdultPage>
  );
}
