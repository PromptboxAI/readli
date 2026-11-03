import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { HearMyVoice } from "@/components/accounts/HearMyVoice";
import { SetupSeen } from "@/components/family/SetupSteps";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import { AdultPage } from "@/components/invites/AdultPage";
import { Welcome } from "@/components/onboarding/Welcome";
import { chosenName } from "@/lib/account/names";
import { currentAdult } from "@/lib/auth/adult";
import { familyPage } from "@/lib/family/page-data";
import { VOICE_SETUP_SEEN_COOKIE } from "@/lib/family/setup-cookie";
import { myVoices } from "@/lib/family/service";
import { familyAccountsEnabled, familyStore } from "@/lib/family/session";
import { isParent } from "@/lib/family/storyteller";
import { invitationContext } from "@/lib/invitations/context";
import { invitationSettings, listInvitations } from "@/lib/invitations/server";
import { pendingJoinPath } from "@/lib/invites/pending";
import { shareKeptVoice } from "@/lib/invites/share-on-keep";
import { serverConfig } from "@/lib/server/config";
import { accountVoiceDeps } from "@/lib/voice/account-voices";
import {
  STORYTELLER_STEP_LABELS,
  STORYTELLER_STEPS,
  storytellerHref,
  storytellerStep,
  storytellerStepAfter,
  storytellerStepBefore,
  type StorytellerStep,
} from "@/lib/voice/storyteller-setup";

export const metadata: Metadata = { title: "Get started | Readli Voice", robots: { index: false } };
export const dynamic = "force-dynamic";

const NEXT_LABEL: Record<StorytellerStep, string> = {
  welcome: "Let's get started!",
  voice: "Next: record your voice",
  share: "Next: share it with a family",
  listen: "Next: hear it read a story",
  done: "Finish",
};

function Stepper({ step, done }: { step: StorytellerStep; done: Record<(typeof STORYTELLER_STEPS)[number], boolean> }) {
  const at = step === "done" ? STORYTELLER_STEPS.length : (STORYTELLER_STEPS as readonly string[]).indexOf(step);
  return (
    <nav aria-label="Setup steps">
      <ol className="grid grid-cols-3 gap-2" data-testid="storyteller-stepper">
        {STORYTELLER_STEPS.map((s, i) => {
          const current = s === step;
          // Like family setup: steps fill in order, and listening counts once you're past it.
          const ok = i <= at && (done[s] || (s === "listen" && i < at));
          return (
            <li key={s} className="min-w-0">
              <Link href={storytellerHref(s)} aria-current={current ? "step" : undefined} className="flex flex-col gap-1.5 rounded-xl p-1 text-sm hover:bg-ink/5">
                <span className={`rounded-full ${current ? "h-3" : "h-2"} ${ok ? "bg-mint" : current ? "bg-coral-deep" : "bg-ink/15"}`} aria-hidden="true" />
                <span className={`truncate ${current ? "font-semibold" : "text-muted"}`}>
                  <span aria-hidden="true">{ok ? "✓ " : `${i + 1}. `}</span>
                  {STORYTELLER_STEP_LABELS[s]}
                  {ok && <span className="sr-only"> (done)</span>}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function StepNav({ step, ready, skip = "Skip for now", nextHref }: { step: StorytellerStep; ready: boolean; skip?: string; nextHref?: string }) {
  const back = storytellerStepBefore(step);
  const next = storytellerStepAfter(step);
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-ink/10 pt-5">
      <Link href={nextHref ?? storytellerHref(next)} className={ready ? buttonPrimary : buttonSecondary} data-testid="storyteller-next">
        {ready ? NEXT_LABEL[next] : skip}
      </Link>
      {back && (
        <Link href={storytellerHref(back)} className="font-semibold underline underline-offset-4">
          Back
        </Link>
      )}
      <Link href="/voice" className="ml-auto text-sm text-muted underline underline-offset-4 hover:text-ink">
        Finish later
      </Link>
    </div>
  );
}

function Done({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-3 rounded-2xl bg-mint/50 p-4 font-semibold">
      <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full bg-mint text-ink">
        ✓
      </span>
      {children}
    </p>
  );
}

/**
 * A new storyteller's walkthrough, one screen at a time: what Readli is, then record your voice, share it
 * with a family (the one that invited you, or one you invite) and hear it read a story. Signing up for
 * Readli Voice and accepting a family's invitation both land here; parents have family setup instead.
 */
export default async function StorytellerSetupPage({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  const q = await searchParams;
  const accounts = familyAccountsEnabled();
  const user = accounts ? await currentAdult() : null;
  const page = await familyPage();
  // Without accounts this is the website preview, played as one of the example family's storytellers.
  const preview = !accounts && page.enabled && page.session?.actor.kind === "adult" ? page.session.actor.adultId : null;
  const adultId = user?.id ?? preview;
  if (!adultId) {
    if (accounts) redirect("/login?next=/voice/setup");
    return (
      <AdultPage>
        <Welcome kind="storyteller" startHref="/voice/record" />
      </AdultPage>
    );
  }
  if (!page.enabled || !page.session || !page.state || page.session.actor.kind !== "adult") return redirect("/login?next=/voice/setup");
  const { session, state } = page;
  if (isParent(state, adultId)) redirect("/family/setup");
  // An invitation this browser was in the middle of accepting comes first; it brings them back here.
  const pending = user ? await pendingJoinPath(adultId) : null;
  if (pending) redirect(pending);
  // A voice kept before keeping also shared it reaches the families that invited them now.
  if (user) await shareKeptVoice();

  const store = (await familyStore(session))!;
  const voice = (await myVoices(store, session.actor))[0] ?? null;
  const deps = user ? accountVoiceDeps(serverConfig()) : null;
  const waiting = !voice && deps ? Boolean(await deps.store.findCandidate(adultId).catch(() => null)) : false;
  const ready = voice?.status === "ready";
  const families = state.members
    .filter((m) => m.adultId === adultId && m.removedAt === null)
    .map((m) => ({ id: m.householdId, name: state.households.find((h) => h.id === m.householdId)?.name ?? "Your family", shared: Boolean(voice?.households.find((h) => h.id === m.householdId)?.shared) }));
  const shared = families.some((f) => f.shared);
  const ctx = user ? invitationContext() : null;
  const invitations = ctx ? await listInvitations(ctx.db, ctx.secret, adultId, await invitationSettings(ctx.db)).catch(() => []) : [];
  const step = storytellerStep(q.step, { voice: Boolean(voice), shared });
  const me = state.adults.find((a) => a.id === adultId);
  const name = chosenName(me?.displayName ?? user?.name, user?.email, user?.named);
  const invitedBy = families[0]?.name;

  if (step === "welcome") {
    return (
      <AdultPage>
        <SetupSeen cookie={VOICE_SETUP_SEEN_COOKIE} />
        {invitedBy && (
          <p className="rounded-2xl bg-sunshine/50 px-4 py-3 font-semibold" data-testid="welcome-invited">
            {invitedBy} invited you to read their kids bedtime stories. Here&apos;s how it works.
          </p>
        )}
        <Welcome kind="storyteller" startHref={storytellerHref("voice")} name={name ? name.split(" ")[0] : null} />
      </AdultPage>
    );
  }

  const done = { voice: Boolean(voice), share: shared || invitations.length > 0, listen: false };
  const n = (STORYTELLER_STEPS as readonly string[]).indexOf(step) + 1;
  const record = `/voice/record?next=${encodeURIComponent(storytellerHref("share"))}`;

  let body: React.ReactNode;
  if (step === "voice") {
    body = (
      <>
        <header className="flex flex-col gap-2">
          <h1 className="font-display text-3xl font-semibold sm:text-4xl">{voice ? "Your voice is recorded" : "First, record your voice"}</h1>
          <p className="max-w-2xl text-lg">
            {voice
              ? "Families you share it with can have any story read in it. You can record again any time from My Voice."
              : "You'll agree to how your voice is used, then read a short passage aloud in your bedtime-story voice. It takes about five minutes, and you only do it once."}
          </p>
        </header>
        {voice ? (
          <Done>{ready ? "Your voice is ready." : "Your voice is being made. It usually takes a minute, so carry on."}</Done>
        ) : (
          <div className="flex flex-col items-start gap-3 rounded-3xl bg-surface p-5 ring-2 ring-ink/10 sm:p-6">
            <ul className="flex list-disc flex-col gap-1 pl-5">
              <li>Find a quiet room and use your phone or computer&apos;s microphone.</li>
              <li>Read the words on the screen the way you&apos;d read to a child.</li>
              <li>Your voice stays private. Only families you choose can use it, and their parents choose which kids hear it.</li>
            </ul>
            <Link href={record} className={buttonPrimary} data-testid="storyteller-record">
              {waiting ? "Hear and keep my voice" : "Record my voice"}
            </Link>
            {waiting && <p className="text-sm text-muted">You recorded your voice but haven&apos;t kept it yet. Listen to it, then tap Keep This Voice.</p>}
          </div>
        )}
        <StepNav step="voice" ready={Boolean(voice)} skip="Skip, I'll record later" />
      </>
    );
  } else if (step === "share") {
    body = (
      <>
        <header className="flex flex-col gap-2">
          <h1 className="font-display text-3xl font-semibold sm:text-4xl">{families.length > 0 ? "Share it with your family" : "Invite a family to hear you"}</h1>
          <p className="max-w-2xl text-lg">
            {families.length > 0
              ? "Once you share, the family can have stories read in your voice. Their parents choose which kids hear it, and you can stop sharing any time."
              : "Pick a story to send to a family you love. They hear a little of it in your voice, and you choose together which kids get bedtime stories from you."}
          </p>
        </header>
        {!voice && (
          <p className="rounded-2xl bg-sunshine/50 p-4">
            Record your voice first, so there&apos;s something to share.{" "}
            <Link href={storytellerHref("voice")} className="font-semibold underline underline-offset-4">
              Record my voice
            </Link>
          </p>
        )}
        {families.length > 0 && (
          <ul className="flex flex-col gap-2" data-testid="storyteller-families">
            {families.map((f) =>
              f.shared ? (
                <li key={f.id}>
                  <Done>{f.name} can use your voice now.</Done>
                </li>
              ) : (
                <li key={f.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-surface p-4 ring-2 ring-ink/10">
                  <span className="font-semibold">{f.name}</span>
                  <span className="text-muted">{ready ? "is waiting for your voice." : voice ? "Your voice is still being made. Check back in a minute." : "Not shared yet."}</span>
                  {ready && (
                    <Link href={`/voice/join/${f.id}?from=setup`} className={`${buttonPrimary} ml-auto`}>
                      Share with {f.name}
                    </Link>
                  )}
                </li>
              ),
            )}
          </ul>
        )}
        {invitations.length > 0 && <Done>You&apos;ve invited {invitations.length === 1 ? "a family" : `${invitations.length} families`}. You&apos;ll see them on My Voice when they say yes.</Done>}
        {ready && (
          <Link href="/voice/invite" className={`${families.length > 0 || invitations.length > 0 ? buttonSecondary : buttonPrimary} self-start`} data-testid="storyteller-invite">
            {families.length > 0 || invitations.length > 0 ? "Invite another family" : "Invite a family"}
          </Link>
        )}
        <StepNav step="share" ready={done.share} />
      </>
    );
  } else if (step === "listen") {
    body = (
      <>
        <header className="flex flex-col gap-2">
          <h1 className="font-display text-3xl font-semibold sm:text-4xl">{voice ? "Hear your voice read a story" : "Record your voice first"}</h1>
          <p className="max-w-2xl text-lg">
            {voice
              ? "This is how you'll sound to the kids at bedtime. Every story in the Readli library can be read this way."
              : "Once your voice is recorded, you can hear it read a story here."}
          </p>
        </header>
        {voice ? (
          <div className="flex flex-col gap-3 rounded-3xl bg-surface p-5 ring-2 ring-ink/10 sm:p-6" data-testid="storyteller-play">
            {!ready && <p className="rounded-2xl bg-sunshine/50 p-4">Your voice is still being made, usually a minute. Refresh this page in a moment to play it.</p>}
            <HearMyVoice ready={ready} />
          </div>
        ) : (
          <Link href={storytellerHref("voice")} className={`${buttonSecondary} self-start`}>
            Record my voice
          </Link>
        )}
        <StepNav step="listen" ready={ready} skip="Finish without listening" nextHref={voice && done.share ? "/voice" : undefined} />
      </>
    );
  } else {
    const left = [!voice && "record your voice", !done.share && "share it with a family"].filter(Boolean) as string[];
    body = (
      <>
        <header className="flex flex-col gap-2">
          <h1 className="font-display text-3xl font-semibold sm:text-4xl">{left.length === 0 ? "You're all set" : "Nearly there"}</h1>
          <p className="max-w-2xl text-lg">
            {left.length === 0
              ? "Your voice is ready for bedtime. My Voice shows the families using it, and you can invite more any time."
              : `You can still ${left.join(" and ")}. My Voice has everything you need when you're ready.`}
          </p>
        </header>
        <div className="flex flex-wrap items-center gap-4 border-t border-ink/10 pt-5">
          <Link href="/voice" className={buttonPrimary} data-testid="storyteller-finish">
            Go to My Voice
          </Link>
          <Link href={storytellerHref("listen")} className={buttonSecondary}>
            Back
          </Link>
        </div>
      </>
    );
  }

  return (
    <AdultPage>
      <SetupSeen cookie={VOICE_SETUP_SEEN_COOKIE} />
      <div className="flex flex-col gap-4">
        <p className="text-sm font-bold tracking-wider text-muted uppercase" data-testid="storyteller-progress">
          Getting started · {step === "done" ? "All set" : `Step ${n} of ${STORYTELLER_STEPS.length}`}
        </p>
        <Stepper step={step} done={done} />
      </div>
      <div className="flex flex-col gap-6" data-testid={`storyteller-${step}`}>
        {body}
      </div>
    </AdultPage>
  );
}
