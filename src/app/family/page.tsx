import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AskName } from "@/components/account/AskName";
import { CreateFamily } from "@/components/family/CreateFamily";
import { InviteActions } from "@/components/invites/InviteActions";
import { FamilyRewardsCard } from "@/components/rewards/FamilyRewardsCard";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import { FamilyOff, FamilyShell, PreviewNote } from "@/components/family/FamilyShell";
import { ResetButton } from "@/components/family/ResetButton";
import { SessionButton } from "@/components/family/SessionButton";
import { SetKidsPin } from "@/components/family/SetKidsPin";
import { StorytellerAvatar } from "@/components/family/StorytellerAvatar";
import { FamilyBookshelf, KidCards, StorytellersCard, UnassignedBooks } from "@/components/family/HomeShelf";
import { HomeNotice } from "@/components/family/HomeNotice";
import { StoryRequests } from "@/components/family/StoryRequests";
import { DEMO_HOUSEHOLD_ID, demoFamilyState } from "@/lib/family/demo-family";
import { calledIn } from "@/lib/family/names";
import { familyHome, homeNotice, noticeText } from "@/lib/family/home";
import { homeHousehold } from "@/lib/family/service";
import { planConfig } from "@/lib/family/plan";
import { familyPage, guardianChildren } from "@/lib/family/page-data";
import { activeEntitlement, liveSlots, narratorSlotCount } from "@/lib/family/permissions";
import { deviceRegistry, familyPreviewEnabled, TEMPORARY_KIDS_HOURS } from "@/lib/family/session";
import { chosenName } from "@/lib/account/names";
import { authConfigured } from "@/lib/auth/supabase";
import { carriedInvitationToken, invitationContext } from "@/lib/invitations/context";
import { invitationUnfinished } from "@/lib/invitations/journey";
import { landingFor } from "@/lib/invitations/server";
import { pendingJoinPath } from "@/lib/invites/pending";
import { isParent, isStorytellerOnly } from "@/lib/family/storyteller";
import { accountVoiceDeps } from "@/lib/voice/account-voices";
import { serverConfig } from "@/lib/server/config";
import { creditBalance, displayCredits } from "@/lib/narration/credits";

function SignOutButton() {
  return (
    <form action="/auth/signout" method="post">
      <button type="submit" className={buttonSecondary}>
        Sign out
      </button>
    </form>
  );
}

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Readli Family" };

export default async function FamilyHome({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const page = await familyPage();
  if (!page.enabled) return <FamilyOff />;
  const { session, state } = page;
  const adult = session?.actor.kind === "adult" && state ? state.adults.find((a) => a.id === (session.actor as { adultId: string }).adultId) : null;
  const account = session?.account;

  if (account && !adult) {
    // A kids profile is open on this device. Leaving it means signing in again, so a child can't.
    return (
      <FamilyShell>
        <h1 className="font-display text-4xl font-semibold">Readli Family</h1>
        <p className="text-lg">Grown-ups, sign in again to leave the kids profile.</p>
        <SignOutButton />
      </FamilyShell>
    );
  }

  if (!account && !familyPreviewEnabled()) {
    return (
      <FamilyShell>
        <h1 className="font-display text-4xl font-semibold">Readli Family</h1>
        <p className="text-lg">Log in to set up your family, add kids profiles and listen together.</p>
        <Link href="/login?next=/family" className={`${buttonPrimary} self-start`}>
          Log in
        </Link>
      </FamilyShell>
    );
  }

  if (!adult || !state) {
    const demo = demoFamilyState();
    const people = demo.adults.map((a) => calledIn(demo, a, DEMO_HOUSEHOLD_ID)!);
    return (
      <FamilyShell>
        <h1 className="font-display text-4xl font-semibold">Readli Family</h1>
        <PreviewNote />
        <p className="text-lg">
          {session?.actor.kind === "child" ? "Grown-ups, sign in to leave the kids profile. " : ""}
          Choose who you are to explore the preview family.
        </p>
        {authConfigured() && (
          <Link href="/login?next=/family" className="self-start font-semibold underline underline-offset-4">
            Or log in to your own family
          </Link>
        )}
        <ul className="grid gap-3 sm:grid-cols-2">
          {people.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-3xl bg-surface p-3 ring-2 ring-ink/10">
              <StorytellerAvatar name={p.displayName} avatarUrl={p.avatarUrl} tint={p.tint} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="font-display text-lg font-semibold">{p.displayName}</p>
                <p className="text-sm text-muted">{p.relationship}</p>
              </div>
              <SessionButton as={`adult:${p.id}`} next="/family" className={buttonSecondary}>
                <span className="sr-only">Sign in as {p.displayName}</span>
                <span aria-hidden="true">I&apos;m {p.displayName.split(" ").pop()}</span>
              </SessionButton>
            </li>
          ))}
        </ul>
      </FamilyShell>
    );
  }

  // Set by Family signup: this grown-up came to start Readli Family, not to see the portal.
  const startingFamily = (await searchParams).start === "1";
  // Until they've told us what to call them, all we have is their email address: ask, don't greet with it.
  const myName = account ? chosenName(adult.displayName, account.email) : adult.displayName;
  if (account && !isParent(state, adult.id)) {
    // Storytellers have a free Readli Voice account, not a family: never send them into family setup.
    const pending = await pendingJoinPath(adult.id);
    if (pending) redirect(pending);
    const deps = startingFamily || isStorytellerOnly(state, adult.id) ? null : accountVoiceDeps(serverConfig());
    const ownVoice = deps ? await deps.store.findVoice(adult.id).catch(() => null) : null;
    if (!startingFamily && (isStorytellerOnly(state, adult.id) || ownVoice)) redirect("/voice");
  }
  const kids = guardianChildren(state, adult.id);
  if (account && !state.members.some((m) => m.adultId === adult.id && m.removedAt === null)) {
    return (
      <FamilyShell>
        <div>
          <p className="text-muted">Signed in as</p>
          <h1 className="font-display text-4xl font-semibold">{myName ?? account.email ?? "you"}</h1>
        </div>
        {!myName && <AskName />}
        <CreateFamily />
        <div className="flex flex-wrap gap-2">
          <Link href="/family/account" className={buttonSecondary}>
            Account settings
          </Link>
          <SignOutButton />
        </div>
      </FamilyShell>
    );
  }
  const isGuardian = state.members.some((m) => m.adultId === adult.id && m.role === "guardian" && m.removedAt === null);
  const home = homeHousehold(state, adult.id) ?? undefined;
  const entitlement = home ? activeEntitlement(state, home) : null;
  const hasPlan = Boolean(entitlement);
  // Family signup continues to choosing a plan, so nobody lands on an empty portal with no way to check out.
  if (startingFamily && isGuardian && !hasPlan) redirect("/family/billing");
  // An invitation carried through signup or checkout: offer the next step until a child can listen.
  const carried = account && isGuardian && home ? await carriedInvitationToken() : null;
  const inviteCtx = carried ? invitationContext() : null;
  const carriedLanding = carried && inviteCtx ? await landingFor(inviteCtx.db, inviteCtx.secret, carried).catch(() => null) : null;
  const invited = carriedLanding && invitationUnfinished(state, carriedLanding, home!) ? { token: carried!, name: carriedLanding.contributorName } : null;
  // A voice made on an older reading model can be heard on the newest one and switched, by its owner.
  const ownVoice = state.voices.find((v) => v.ownerId === adult.id && v.status === "ready" && v.deletedAt === null);
  const newerModel = Boolean(account && ownVoice?.modelId && ownVoice.modelId !== serverConfig().elevenLabsModel);
  const plan = planConfig();
  const view = home ? familyHome(state, home, plan, adult.id) : null;
  const familyName = account && home ? state.households.find((h) => h.id === home)?.name : null;
  const pinRegistry = isGuardian && home ? deviceRegistry(Boolean(account)) : null;
  const needsPin = Boolean(pinRegistry && kids.length > 0 && !(await pinRegistry.pinHash(home!)));
  const balance = isGuardian && home ? creditBalance(state, plan, home) : null;
  const credits = balance ? displayCredits(balance.available, balance.unitsPerCredit).toLocaleString("en-US") : null;
  const notice = isGuardian && home ? homeNotice(state, home, adult.id) : null;
  const slots = home ? narratorSlotCount(state, home, plan) : 0;
  const slotLine = home && entitlement && slots ? `${liveSlots(state, home, plan).length} of ${slots} ${entitlement.extraNarratorSlots ? "" : "included "}narrator slots in use` : null;
  const kidIds = new Set(kids.map((k) => k.id));
  const kidCards = view ? view.kids.filter((k) => kidIds.has(k.id)) : [];
  return (
    <FamilyShell>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-center gap-4">
          <StorytellerAvatar name={adult.displayName} avatarUrl={adult.avatarUrl} tint={adult.tint} size="lg" />
          <div className="min-w-0">
            {familyName && <p className="font-display text-lg text-muted">{familyName}</p>}
            <h1 className="font-display text-3xl font-semibold sm:text-4xl">{myName ? `Welcome back, ${myName}` : "Welcome back!"}</h1>
            {!isGuardian && <p className="text-lg text-muted">{calledIn(state, adult, home)?.relationship}</p>}
            {account && !adult.avatarUrl && (
              <Link href="/family/account#photo" className="text-sm font-semibold underline underline-offset-4">
                Add your photo
              </Link>
            )}
          </div>
        </div>
        {notice && (
          <div className="lg:max-w-xl">
            <HomeNotice text={noticeText(notice)} through={notice.through} />
          </div>
        )}
      </div>
      {!myName && <AskName />}
      <PreviewNote />
      {invited && (
        <Link href={`/v/${invited.token}/connect`} className="rounded-2xl bg-sky/50 px-4 py-3 font-semibold underline-offset-4 hover:underline" data-testid="invitation-waiting">
          Continue adding {invited.name} →
        </Link>
      )}
      {newerModel && (
        <Link href="/family/my-voice" className="rounded-2xl bg-sunshine/50 px-4 py-3 font-semibold underline-offset-4 hover:underline" data-testid="voice-model-banner">
          A new version of your Readli voice is ready to try. Hear it and choose →
        </Link>
      )}

      {isGuardian && (
        // On phones, the way to the next story sits above the kids, in one slim strip.
        <section className="flex items-center justify-between gap-3 rounded-3xl bg-ink px-4 py-3 text-white lg:hidden" aria-label="Find your next story" data-testid="next-story-strip">
          <div className="min-w-0">
            <p className="font-display text-lg font-semibold leading-tight">Find your next story</p>
            {credits !== null && (
              <p className="text-sm text-white/80">
                <strong className="text-white">{credits}</strong> credits available
              </p>
            )}
          </div>
          <Link
            href="/family/books"
            className="inline-flex min-h-12 shrink-0 items-center rounded-full bg-coral-deep px-4 font-display font-semibold text-white shadow-[0_4px_0_#8f2a1e] hover:-translate-y-0.5"
          >
            Browse Books
          </Link>
        </section>
      )}

      {isGuardian && (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
          <div className="flex min-w-0 flex-col gap-8">
            <section className="flex flex-col gap-3" aria-labelledby="kids-h">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 id="kids-h" className="font-display text-2xl font-semibold">
                  Your kids
                </h2>
                {kids.length >= plan.maxChildProfiles ? (
                  <span className="text-muted">
                    {kids.length} of {plan.maxChildProfiles} profiles
                  </span>
                ) : (
                  <Link href="/family/kids" className="font-semibold underline underline-offset-4">
                    {kids.length ? "Add a child" : "Add your first child"}
                  </Link>
                )}
              </div>
              {account && !hasPlan && (
                <p className="rounded-2xl bg-sunshine/50 p-3 text-sm">
                  Kids profiles come with Readli Family. Checkout isn&apos;t switched on yet, so this unlocks when it is.
                </p>
              )}
              {needsPin && <SetKidsPin />}
              {kidCards.length > 0 ? (
                <KidCards kids={kidCards} />
              ) : (
                <Link
                  href="/family/kids"
                  className="flex min-h-28 flex-col items-center justify-center gap-1 rounded-3xl border-[3px] border-dashed border-ink/20 p-4 text-center font-display text-lg font-semibold text-muted hover:border-ink/50"
                  data-testid="home-kids"
                >
                  <span aria-hidden="true" className="text-3xl leading-none">
                    +
                  </span>
                  Add your first child
                </Link>
              )}
              {kidCards.length > 0 && (
                <p className="text-sm text-muted" data-testid="kids-mode-note">
                  <span className="hidden sm:inline">
                    Open Readli Kids starts Kids Mode for that child on this browser. A grown-up leaves it with the family PIN, and it ends on its own after{" "}
                    {TEMPORARY_KIDS_HOURS} hours. To give a child their own iPad,{" "}
                    <Link href="/family/devices" className="font-semibold underline underline-offset-4">
                      set up a kids device
                    </Link>
                    .
                  </span>
                  <span className="sm:hidden">
                    Kids Mode stays on this browser until a grown-up enters the family PIN. It ends on its own after {TEMPORARY_KIDS_HOURS} hours.
                  </span>
                </p>
              )}
            </section>

            {view && view.requests.length > 0 && <StoryRequests requests={view.requests} />}

            {view && (
              <section id="bookshelf" className="flex scroll-mt-24 flex-col gap-3" aria-labelledby="bookshelf-h">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <h2 id="bookshelf-h" className="font-display text-2xl font-semibold">
                    Family bookshelf
                  </h2>
                  {view.shelf.length > 0 && (
                    <span className="text-muted">
                      {view.shelf.length} {view.shelf.length === 1 ? "audiobook" : "audiobooks"} in family voices
                    </span>
                  )}
                </div>
                {view.shelf.length > 0 ? (
                  <>
                    <FamilyBookshelf books={view.shelf} />
                    <p className="text-sm text-muted">Listen plays here for you, from the start. Each child keeps their own place, which only moves when they listen in Readli Kids.</p>
                  </>
                ) : (
                  <div className="flex flex-col items-start gap-3 rounded-3xl bg-surface p-5 ring-2 ring-ink/10" data-testid="shelf-ready-empty">
                    <p>Pick a story and choose who reads it. Prepared audiobooks show up here, with each child&apos;s place.</p>
                    <Link href="/family/books" className={buttonPrimary}>
                      Choose a story
                    </Link>
                  </div>
                )}
              </section>
            )}

            {view && view.unassigned.length > 0 && <UnassignedBooks books={view.unassigned} />}
          </div>

          <aside className="flex min-w-0 flex-col gap-6">
            <section className="hidden flex-col gap-3 rounded-3xl bg-ink p-6 text-white lg:flex" aria-labelledby="next-story-h" data-testid="next-story">
              <h2 id="next-story-h" className="font-display text-2xl font-semibold">
                Find your next story
              </h2>
              <p className="text-white/85">Prepare another book in a family voice. Anything already prepared plays free.</p>
              {credits !== null && (
                <p>
                  <strong>{credits} credits</strong> available
                </p>
              )}
              <Link href="/family/books" className={buttonPrimary}>
                Browse Books
              </Link>
            </section>
            {view && <StorytellersCard storytellers={view.storytellers} slotLine={slotLine} />}
          </aside>
        </div>
      )}

      {!isGuardian && (
        <section className="flex flex-col gap-3 rounded-panel bg-surface p-5" aria-labelledby="my-voice-h">
          <h2 id="my-voice-h" className="font-display text-2xl font-semibold">Your voice</h2>
          <p>Your voice is private until you share it. You decide which families can use it, and you can record it again at any time.</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/family/my-voice" className={buttonSecondary}>
              My voice
            </Link>
            {account && (
              <Link href="/voice/record" className="self-center font-semibold underline underline-offset-4">
                Record or re-record my voice
              </Link>
            )}
          </div>
        </section>
      )}

      {isGuardian && !account && (
        <section className="flex flex-col gap-3" aria-labelledby="invite-h">
          <h2 id="invite-h" className="font-display text-2xl font-semibold">Grow your family circle</h2>
          <InviteActions headingLevel={3} />
          <FamilyRewardsCard />
        </section>
      )}

      {!account && (
        <div className="flex flex-wrap gap-2">
          <SessionButton as={null} next="/family" className={buttonSecondary}>
            Sign out
          </SessionButton>
          <ResetButton />
        </div>
      )}
    </FamilyShell>
  );
}
