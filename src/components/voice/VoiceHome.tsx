import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AskName } from "@/components/account/AskName";
import { HearStoryShelf } from "@/components/accounts/HearStoryShelf";
import { buttonPrimary, buttonSecondary, buttonSmall } from "@/components/brand/buttons";
import { InvitationList } from "@/components/invitations/InvitationList";
import { AdultPage, Eyebrow } from "@/components/invites/AdultPage";
import { VoiceModelUpgrade } from "@/components/family/VoiceModelUpgrade";
import { chosenName } from "@/lib/account/names";
import { DEMO_BOOKS } from "@/lib/content/demo-books";
import { welcomeStoryTexts } from "@/lib/content/welcome-stories";
import { accountDb } from "@/lib/family/account-store";
import type { FamilyState } from "@/lib/family/model";
import { VOICE_SETUP_LATER_COOKIE, chosenBy } from "@/lib/family/setup-cookie";
import { myVoices } from "@/lib/family/service";
import { familyStore } from "@/lib/family/session";
import { isStorytellerOnly } from "@/lib/family/storyteller";
import type { familyPage } from "@/lib/family/page-data";
import { invitationContext } from "@/lib/invitations/context";
import { PREVIEW_PASSAGES } from "@/lib/invitations/passages";
import { invitationSettings, listInvitations } from "@/lib/invitations/server";
import { START_CHOSE_VOICE_COOKIE } from "@/lib/onboarding/start";
import { serverConfig } from "@/lib/server/config";
import { sponsorshipContext } from "@/lib/sponsorship/http";
import { accountVoiceDeps, voiceModelStatus } from "@/lib/voice/account-voices";
import { hasGivenGift, openVoiceHome, readVoiceHomeProgress, showVoiceHomeSteps, voiceHomeSteps } from "@/lib/voice/home-progress";

type Page = Awaited<ReturnType<typeof familyPage>>;
type User = { id: string; name: string; email: string | null; named?: boolean };

/** Books on the shelf that can also be sent: each has a preview passage families hear first. */
const SENDABLE = DEMO_BOOKS.filter((b) => PREVIEW_PASSAGES.some((p) => p.book === b.slug));

/**
 * Where a free Readli Voice account checks in on its voice: the voice and the families hearing it, nothing
 * of a family's own. A new account with no voice yet goes through the signup welcome (or a storyteller's
 * setup) first. Also used by the welcome screen, which shares the same gate.
 */
export async function freeVoiceGate(user: User, state: FamilyState | null, voiceCount: number): Promise<void> {
  const deps = accountVoiceDeps(serverConfig());
  if (!deps || voiceCount > 0) return;
  const recording = await deps.store.findVoice(user.id).catch(() => null);
  if (recording) return;
  const candidate = await deps.store.findCandidate(user.id).catch(() => null);
  if (candidate) return;
  const jar = await cookies();
  if (chosenBy(jar.get(VOICE_SETUP_LATER_COOKIE)?.value, user.id)) return;
  // Someone brand new (no family invited them, and they haven't picked free Readli Voice in the signup welcome)
  // goes through the signup welcome. Storytellers get their own steps.
  const fresh = !(state && isStorytellerOnly(state, user.id)) && !chosenBy(jar.get(START_CHOSE_VOICE_COOKIE)?.value, user.id);
  redirect(fresh ? "/start" : "/voice/setup");
}

export async function VoiceHome({ user, page }: { user: User; page: Page }) {
  if (!page.enabled || !page.session) redirect("/login?next=/home");
  const { session, state } = page;
  const store = await familyStore(session);
  const voices = store ? await myVoices(store, session.actor).catch(() => []) : [];
  await freeVoiceGate(user, state, voices.length);

  const db = accountDb();
  const deps = accountVoiceDeps(serverConfig());
  const recording = deps ? await deps.store.findVoice(user.id).catch(() => null) : null;
  const model = deps ? await voiceModelStatus(deps, user.id).catch(() => null) : null;
  const ctx = invitationContext();
  const [invitations, gifting, gave, progress] = await Promise.all([
    ctx ? listInvitations(ctx.db, ctx.secret, user.id, await invitationSettings(ctx.db)).catch(() => []) : Promise.resolve([]),
    sponsorshipContext({ newGifts: true })
      .then(Boolean)
      .catch(() => false),
    hasGivenGift(db, user.id).catch(() => false),
    readVoiceHomeProgress(db, user.id),
    openVoiceHome(db, user.id),
  ]);

  const me = state?.adults.find((a) => a.id === user.id);
  const name = chosenName(me?.displayName ?? user.name, user.email, user.named);
  const ready = recording?.status === "ready";
  const families = voices.flatMap((v) => v.households.filter((h) => h.shared)).filter((h, i, all) => all.findIndex((x) => x.id === h.id) === i);
  const steps = voiceHomeSteps({
    recorded: Boolean(recording && recording.status !== "deleted") || voices.length > 0,
    heard: Boolean(progress.storyHeardAt),
    sent: invitations.length > 0 || families.length > 0,
    gave,
    gifting,
  });
  const showSteps = showVoiceHomeSteps(steps, progress);
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <AdultPage wide>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Eyebrow>Readli Voice · Free</Eyebrow>
          <h1 className="font-display text-4xl font-semibold sm:text-5xl">{name ? `Hi, ${name}` : "Welcome to Readli"}</h1>
        </div>
        <p className="flex flex-wrap items-center gap-3 rounded-full bg-mint/50 py-2 pr-2 pl-4 font-semibold" data-testid="voice-status">
          <span aria-hidden="true" className="size-2.5 rounded-full bg-mint-deep" />
          {ready ? "Your voice is ready" : recording ? "Your voice is still being made" : "No voice recorded yet"}
          <Link href="/voice" className={buttonSmall}>
            Manage my voice
          </Link>
        </p>
      </header>
      {!name && <AskName label="What should families call you?" hint="Invitations use this name, like “Grandpa Joe has a bedtime story for your family.”" placeholder="Grandpa Joe, Nana, Aunt Sue…" />}
      {model?.canUpgrade && <VoiceModelUpgrade />}

      {showSteps && (
        <section aria-labelledby="steps-h" className="flex flex-col gap-4 rounded-[var(--radius-panel)] bg-sunshine/40 p-5 sm:p-7" data-testid="voice-home-steps">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="steps-h" className="font-display text-2xl font-semibold">
              Get your voice to the kids
            </h2>
            <p className="font-semibold text-muted">
              {doneCount} of {steps.length} done
            </p>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-surface" aria-hidden="true">
            <div className="h-full rounded-full bg-mint-deep" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
          </div>
          <ol className="flex flex-col gap-2">
            {steps.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-surface p-3 sm:p-4" data-testid={`voice-step-${s.id}`} data-done={s.done ? "1" : "0"}>
                <span
                  aria-hidden="true"
                  className={`grid size-8 shrink-0 place-items-center rounded-full border-[3px] font-bold ${s.done ? "border-mint-deep bg-mint-deep text-white" : "border-ink text-transparent"}`}
                >
                  ✓
                </span>
                <span className="flex min-w-48 flex-1 flex-col">
                  <span className={`font-semibold ${s.done ? "text-muted line-through" : ""}`}>
                    {s.title}
                    <span className="sr-only">{s.done ? " (done)" : ""}</span>
                  </span>
                  <span className="text-sm text-muted">{s.hint}</span>
                </span>
                {s.action && (
                  <Link href={s.action.href} className={buttonSmall}>
                    {s.action.label}
                  </Link>
                )}
              </li>
            ))}
          </ol>
          <form action="/home/steps/hide" method="post" className="self-end">
            <button type="submit" className="text-sm font-semibold underline underline-offset-4">
              Hide this list
            </button>
          </form>
        </section>
      )}

      <section id="stories" aria-labelledby="stories-h" className="flex scroll-mt-24 flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="stories-h" className="scroll-mt-24 font-display text-3xl font-semibold">
            Stories in your voice
          </h2>
          <p className="text-muted">Tap a book to hear its opening read by you.</p>
        </div>
        {recording ? (
          <HearStoryShelf ready={ready} texts={welcomeStoryTexts()} scrollTo="stories-h" />
        ) : (
          <Link href="/voice/record" className={`${buttonPrimary} self-start`}>
            Record my voice
          </Link>
        )}
        <p className="text-muted">
          Want every book read in your voice for the kids? That happens in their family&apos;s Readli Family.{" "}
          <Link href="/gift/family" className="font-semibold text-ink underline underline-offset-4">
            Give it as a gift
          </Link>
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <section aria-labelledby="send-h" className="flex min-w-0 flex-col gap-4 rounded-[var(--radius-panel)] bg-surface p-5 ring-2 ring-ink/10 sm:p-7" data-testid="voice-home-send">
          <h2 id="send-h" className="font-display text-2xl font-semibold">
            Families hearing your voice
          </h2>
          {families.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {families.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-mint/30 px-4 py-3">
                  <span className="font-semibold">{f.name}</span>
                  <span className="text-sm">{f.approvedFor.length ? `Read to ${f.approvedFor.join(", ")}` : "Waiting for a parent to choose who hears you"}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-2xl bg-lavender/40 p-4">
              No family yet. Send a story to the kids&apos; parents: they hear it in your voice for free, and once they say yes on Readli Family, the kids can pick you at bedtime.
            </p>
          )}
          {invitations.length > 0 && <InvitationList items={invitations} />}
          {ready && (
            <div className="flex flex-col gap-3">
              <Link href="/voice/invite" className={`${buttonPrimary} self-start`} data-testid="send-story">
                Send a story
              </Link>
              <p className="text-sm text-muted">
                Or pick the story:{" "}
                {SENDABLE.map((b, i) => (
                  <span key={b.slug}>
                    {i > 0 && " · "}
                    <Link href={`/voice/invite?book=${b.slug}`} className="font-semibold text-ink underline underline-offset-4">
                      {b.title}
                    </Link>
                  </span>
                ))}
              </p>
            </div>
          )}
        </section>

        {gifting && (
          <section aria-labelledby="gift-h" className="flex min-w-0 flex-col items-start gap-3 self-start rounded-[var(--radius-panel)] bg-coral/15 p-5 sm:p-7" data-testid="voice-gift">
            <h2 id="gift-h" className="font-display text-2xl font-semibold">
              Give Readli as a gift
            </h2>
            <p>Cover Readli Family for up to two families you love. They add their kids and your voice is ready on their shelf; you pay for the plan.</p>
            <Link href="/gift/family" className={buttonSecondary}>
              Give a gift
            </Link>
          </section>
        )}
      </div>

      <nav aria-label="More" className="flex flex-wrap gap-x-6 gap-y-2 font-semibold">
        <Link href="/voice" className="underline underline-offset-4">
          Manage my voice
        </Link>
        <Link href="/family/settings" className="underline underline-offset-4">
          Settings
        </Link>
        <Link href="/signup/family" className="underline underline-offset-4">
          Start Readli Family for my own kids
        </Link>
      </nav>
    </AdultPage>
  );
}
