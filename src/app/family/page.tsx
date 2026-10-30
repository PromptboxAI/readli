import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AskName } from "@/components/account/AskName";
import { CreateFamily } from "@/components/family/CreateFamily";
import { InviteActions } from "@/components/invites/InviteActions";
import { FamilyRewardsCard } from "@/components/rewards/FamilyRewardsCard";
import { parentPrimary, parentSecondary } from "@/components/brand/buttons";
import { FamilyOff, FamilyShell, PreviewNote } from "@/components/family/FamilyShell";
import { ResetButton } from "@/components/family/ResetButton";
import { SessionButton } from "@/components/family/SessionButton";
import { SetKidsPin } from "@/components/family/SetKidsPin";
import { StorytellerAvatar } from "@/components/family/StorytellerAvatar";
import { FamilyBookshelf, HOME_SHELF_BOOKS, KidCards, StorytellersCard, UnassignedBooks } from "@/components/family/HomeShelf";
import { HomeNotice } from "@/components/family/HomeNotice";
import { StoryRequests } from "@/components/family/StoryRequests";
import { DEMO_HOUSEHOLD_ID, demoFamilyState } from "@/lib/family/demo-family";
import { calledIn } from "@/lib/family/names";
import { familyHome, homeNotice, noticeText } from "@/lib/family/home";
import { homeHousehold } from "@/lib/family/service";
import { planConfig } from "@/lib/family/plan";
import { familyCheckoutOpen } from "@/lib/accounts/checkout";
import { familyPage, guardianChildren } from "@/lib/family/page-data";
import { activeEntitlement, childProfileLimit, countedSlots, narratorSlotCount } from "@/lib/family/permissions";
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
import { creditBalance, displayCredits, type CreditBalance } from "@/lib/narration/credits";

function SignOutButton() {
  return (
    <form action="/auth/signout" method="post">
      <button type="submit" className={parentSecondary}>
        Sign out
      </button>
    </form>
  );
}

/** "23.3 of 40 monthly credits remaining", plus any bought or bonus credits on top. */
function creditSummary(b: CreditBalance, trial: boolean): { amount: string; rest: string } {
  const n = (units: number) => displayCredits(units, b.unitsPerCredit).toLocaleString("en-US");
  if (!b.allowance) return { amount: n(b.available), rest: "credits remaining" };
  const included = b.bySource.subscription + b.bySource.trial;
  const extra = b.bySource.promotional + b.bySource.purchased;
  return {
    amount: `${n(included)} of ${n(b.allowance)}`,
    rest: `${trial ? "trial" : "monthly"} credits remaining${extra > 0 ? `, plus ${n(extra)} extra` : ""}`,
  };
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
        <Link href="/login?next=/family" className={`${parentPrimary} self-start`}>
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
              <SessionButton as={`adult:${p.id}`} next="/family" className={parentSecondary}>
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
  const myName = account ? chosenName(adult.displayName, account.email, account.named) : adult.displayName;
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
          <Link href="/family/settings" className={parentSecondary}>
            Settings
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
  // A family whose paid plan (or gift) has ended: everything they set up is kept, so offer to restart rather than start.
  const pastPlans = home && !hasPlan ? state.entitlements.filter((e) => e.householdId === home && e.source !== "trial") : [];
  const lapsed = isGuardian && pastPlans.length > 0;
  const endedAt = pastPlans.map((e) => e.endsAt).filter((d): d is string => d !== null && d <= new Date().toISOString()).sort().at(-1) ?? null;
  // Family signup continues to choosing a plan, so nobody lands on an empty portal with no way to check out.
  if (startingFamily && isGuardian && !hasPlan) redirect("/family/settings/plan");
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
  const creditLine = balance ? creditSummary(balance, entitlement?.source === "trial") : null;
  const notice = isGuardian && home ? homeNotice(state, home, adult.id) : null;
  const slots = home ? narratorSlotCount(state, home, plan) : 0;
  const kidsMax = home ? childProfileLimit(state, home, plan) : plan.maxChildProfiles;
  const slotLine = home && entitlement && slots ? `${countedSlots(state, home, plan).length} of ${slots} ${entitlement.extraNarratorSlots ? "" : "included "}narrator slots in use` : null;
  const kidIds = new Set(kids.map((k) => k.id));
  const kidCards = view ? view.kids.filter((k) => kidIds.has(k.id)) : [];
  const allBooks = (await searchParams).shelf === "all";
  const shelfShown = view ? (allBooks ? view.shelf : view.shelf.slice(0, HOME_SHELF_BOOKS)) : [];
  return (
    <FamilyShell>
      <div className="flex items-center gap-4">
        <StorytellerAvatar name={adult.displayName} avatarUrl={adult.avatarUrl} tint={adult.tint} />
        <div className="min-w-0 flex-1">
          {familyName && <p className="font-display text-muted">{familyName}</p>}
          {/* The account's own chosen name, never the email: a household's nickname for this grown-up belongs to that family's view of them. */}
          <h1 className="font-display text-2xl leading-tight font-semibold sm:text-3xl">{myName ? `Welcome back, ${myName}` : "Welcome back!"}</h1>
          {!isGuardian && <p className="text-muted">{calledIn(state, adult, home)?.relationship}</p>}
          {account && !adult.avatarUrl && (
            <Link href="/family/settings/account#profile" className="text-sm font-semibold underline underline-offset-4">
              Add your photo
            </Link>
          )}
        </div>
      </div>
      {notice && <HomeNotice text={noticeText(notice)} through={notice.through} />}
      {lapsed && (
        <section className="flex flex-col items-start gap-3 rounded-2xl bg-surface p-5 ring-1 ring-ink/15" data-testid="plan-ended">
          <h2 className="text-lg font-semibold">
            Your Readli Family plan has ended
            {endedAt ? ` (${new Date(endedAt).toLocaleDateString("en-US", { month: "long", day: "numeric" })})` : ""}
          </h2>
          <p>Your kids&apos; profiles, storytellers and prepared books are saved. Restart any time to pick up where you left off.</p>
          <Link href="/family/settings/plan" className={parentPrimary}>
            Restart Readli Family
          </Link>
        </section>
      )}
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
            {creditLine && (
              <Link href="/family/settings/plan" className="block text-sm text-white/80 underline-offset-4 hover:underline">
                <strong className="text-white">{creditLine.amount}</strong> {creditLine.rest}
                <span className="sr-only">. How credits work</span>
              </Link>
            )}
          </div>
          <Link
            href="/family/books"
            className={`${parentSecondary} shrink-0`}
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
                {kids.length >= kidsMax ? (
                  <span className="text-muted">
                    {kids.length} of {kidsMax} profiles
                  </span>
                ) : (
                  <Link href="/family/kids" className="font-semibold underline underline-offset-4">
                    {kids.length ? "Add a child" : "Add your first child"}
                  </Link>
                )}
              </div>
              {account && !hasPlan && !lapsed && (
                <p className="rounded-2xl bg-sunshine/50 p-3 text-sm">
                  Kids profiles come with Readli Family.{" "}
                  {familyCheckoutOpen() ? (
                    <Link href="/family/settings/plan" className="font-semibold underline underline-offset-4">
                      Choose a plan
                    </Link>
                  ) : (
                    "Checkout isn't switched on yet, so this unlocks when it is."
                  )}
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
                <details className="group self-start text-sm" data-testid="kids-mode-note">
                  <summary className="cursor-pointer list-none font-semibold text-muted underline underline-offset-4 hover:text-ink [&::-webkit-details-marker]:hidden">
                    About Kids Mode
                  </summary>
                  <p className="mt-2 max-w-prose rounded-2xl bg-surface p-3 ring-2 ring-ink/10">
                    Open Readli Kids starts Kids Mode for that child on this browser. A grown-up leaves it with the family PIN, and it ends on its own after{" "}
                    {TEMPORARY_KIDS_HOURS} hours. To give a child their own iPad,{" "}
                    <Link href="/family/settings/kids-mode" className="font-semibold underline underline-offset-4">
                      set up a kids device
                    </Link>
                    .
                  </p>
                </details>
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
                    <FamilyBookshelf books={shelfShown} />
                    {view.shelf.length > HOME_SHELF_BOOKS && (
                      <Link
                        href={allBooks ? "/family#bookshelf" : "/family?shelf=all#bookshelf"}
                        className="self-start font-semibold underline underline-offset-4"
                        data-testid="shelf-view-all"
                        scroll={false}
                      >
                        {allBooks ? "Show fewer" : `View all ${view.shelf.length} books`}
                      </Link>
                    )}
                    <p className="text-sm text-muted">Listen plays here for you, from the start. Each child keeps their own place, which only moves when they listen in Readli Kids.</p>
                  </>
                ) : (
                  <div className="flex flex-col items-start gap-3 rounded-3xl bg-surface p-5 ring-2 ring-ink/10" data-testid="shelf-ready-empty">
                    <p>Pick a story and choose who reads it. Prepared audiobooks show up here, with each child&apos;s place.</p>
                    <Link href="/family/books" className={parentPrimary}>
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
              {creditLine && (
                <p>
                  <strong>{creditLine.amount}</strong> {creditLine.rest}{" "}
                  <Link href="/family/settings/plan" className="text-sm whitespace-nowrap text-white/85 underline underline-offset-4 hover:text-white">
                    How credits work
                  </Link>
                </p>
              )}
              <Link href="/family/books" className={parentSecondary}>
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
            <Link href="/family/my-voice" className={parentSecondary}>
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
          <SessionButton as={null} next="/family" className={parentSecondary}>
            Sign out
          </SessionButton>
          <ResetButton />
        </div>
      )}
    </FamilyShell>
  );
}
