import type { Metadata } from "next";
import Link from "next/link";
import { CreateFamily } from "@/components/family/CreateFamily";
import { InviteActions } from "@/components/invites/InviteActions";
import { FamilyRewardsCard } from "@/components/rewards/FamilyRewardsCard";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import { FamilyOff, FamilyShell, PreviewNote } from "@/components/family/FamilyShell";
import { ResetButton } from "@/components/family/ResetButton";
import { SessionButton } from "@/components/family/SessionButton";
import { StorytellerAvatar } from "@/components/family/StorytellerAvatar";
import { BookShelf, StorytellerRow } from "@/components/family/HomeShelf";
import { demoFamilyState } from "@/lib/family/demo-family";
import { familyHome } from "@/lib/family/home";
import { planConfig } from "@/lib/family/plan";
import { familyPage, guardianChildren } from "@/lib/family/page-data";
import { activeEntitlement } from "@/lib/family/permissions";
import { familyPreviewEnabled } from "@/lib/family/session";
import { authConfigured } from "@/lib/auth/supabase";
import { carriedInvitationToken } from "@/lib/invitations/context";
import { serverConfig } from "@/lib/server/config";

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

export default async function FamilyHome() {
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
    const people = demoFamilyState().adults;
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

  const kids = guardianChildren(state, adult.id);
  if (account && !state.members.some((m) => m.adultId === adult.id && m.removedAt === null)) {
    return (
      <FamilyShell>
        <div>
          <p className="text-muted">Signed in as</p>
          <h1 className="font-display text-4xl font-semibold">{adult.displayName}</h1>
        </div>
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
  const homes = new Set(state.members.filter((m) => m.adultId === adult.id && m.role === "guardian" && m.removedAt === null).map((m) => m.householdId));
  const notes = state.notifications.filter((n) => homes.has(n.householdId)).slice(-3).reverse();
  const home = [...homes][0];
  const hasPlan = home ? Boolean(activeEntitlement(state, home)) : false;
  const invited = account && isGuardian ? await carriedInvitationToken() : null;
  // A voice made on an older reading model can be heard on the newest one and switched, by its owner.
  const ownVoice = state.voices.find((v) => v.ownerId === adult.id && v.status === "ready" && v.deletedAt === null);
  const newerModel = Boolean(account && ownVoice?.modelId && ownVoice.modelId !== serverConfig().elevenLabsModel);
  const view = home ? familyHome(state, home, planConfig(), adult.id) : null;
  const familyName = account && home ? state.households.find((h) => h.id === home)?.name : null;
  return (
    <FamilyShell>
      <div className="flex items-center gap-4">
        <StorytellerAvatar name={adult.displayName} avatarUrl={adult.avatarUrl} tint={adult.tint} size="lg" />
        <div>
          {familyName && <p className="font-display text-lg text-muted">{familyName}</p>}
          <h1 className="font-display text-4xl font-semibold">Welcome back, {adult.displayName}</h1>
          <p className="text-lg text-muted">{isGuardian && kids.length ? "Who\u2019s listening tonight?" : adult.relationship}</p>
          {account && (
            <Link href="/family/account#photo" className="text-sm font-semibold underline underline-offset-4">
              {adult.avatarUrl ? "Change your photo" : "Add your photo"}
            </Link>
          )}
        </div>
      </div>
      <PreviewNote />
      {invited && (
        <Link href={`/v/${invited}/connect`} className="rounded-2xl bg-sky/50 px-4 py-3 font-semibold underline-offset-4 hover:underline" data-testid="invitation-waiting">
          A storyteller invited your family. Add them to your Family Circle →
        </Link>
      )}
      {newerModel && (
        <Link href="/family/my-voice" className="rounded-2xl bg-sunshine/50 px-4 py-3 font-semibold underline-offset-4 hover:underline" data-testid="voice-model-banner">
          A new version of your Readli voice is ready to try. Hear it and choose →
        </Link>
      )}
      {isGuardian && notes.length > 0 && (
        <section className="flex flex-col gap-2 rounded-panel bg-mint/40 p-4" aria-label="Updates" data-testid="notifications">
          {notes.map((n) => (
            <Link key={n.id} href={n.href} className="font-semibold underline underline-offset-4">
              {n.text}
            </Link>
          ))}
        </section>
      )}

      {isGuardian && (
        <section className="flex flex-col gap-3" aria-labelledby="kids-h">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="kids-h" className="font-display text-2xl font-semibold">Your kids</h2>
            <Link href="/family/devices" className="font-display font-semibold text-coral-deep underline-offset-4 hover:underline">
              Kids devices and PIN
            </Link>
          </div>
          {account && !hasPlan && (
            <p className="rounded-2xl bg-sunshine/50 p-3 text-sm">
              Kids profiles come with Readli Family. Checkout isn&apos;t switched on yet, so this unlocks when it is.
            </p>
          )}
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="home-kids">
            {kids.map((c) => {
              const playing = view?.kids.find((k) => k.id === c.id)?.nowPlaying;
              return (
                <li key={c.id} className="flex flex-col gap-3 rounded-3xl bg-surface p-4 ring-2 ring-ink/10">
                  <div className="flex items-center gap-3">
                    <StorytellerAvatar name={c.nickname} avatarUrl={null} tint={c.tint} />
                    <div className="min-w-0">
                      <p className="font-display text-2xl font-semibold">{c.nickname}</p>
                      <p className="text-sm text-muted">{playing ? `Listening to ${playing}` : "No story started yet"}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <SessionButton as={`child:${c.id}`} next="/kids" className={buttonPrimary}>
                      Open {c.nickname}&apos;s Readli Kids
                    </SessionButton>
                    <Link href={`/family/kids/${c.id}/storytellers`} className="font-semibold underline underline-offset-4">
                      Manage storytellers
                    </Link>
                  </div>
                </li>
              );
            })}
            <li>
              <Link
                href="/family/kids"
                className="flex h-full min-h-28 flex-col items-center justify-center gap-1 rounded-3xl border-[3px] border-dashed border-ink/20 p-4 text-center font-display text-lg font-semibold text-muted hover:border-ink/50"
              >
                <span aria-hidden="true" className="text-3xl leading-none">
                  +
                </span>
                {kids.length ? "Add or remove kids" : "Add your first child"}
              </Link>
            </li>
          </ul>
          <p className="text-sm text-muted">
            Opening Readli Kids sets up this device for your kids and signs you out on it. A grown-up PIN or signing in again gets you
            back.
          </p>
        </section>
      )}

      {isGuardian && view && view.continueListening.length > 0 && (
        <BookShelf id="continue" title="Continue listening" books={view.continueListening} more={{ href: "/family/books", label: "All stories" }} />
      )}
      {isGuardian && view && (
        view.ready.length > 0 ? (
          <BookShelf id="ready" title="Ready to play" books={view.ready} more={{ href: "/family/books", label: "See all" }} />
        ) : (
          <section className="flex flex-col items-start gap-3 rounded-panel bg-surface p-5" data-testid="shelf-ready-empty">
            <h2 className="font-display text-2xl font-semibold">Ready to play</h2>
            <p>Pick a story and choose who reads it. Prepared stories show up here for the kids.</p>
            <Link href="/family/books" className={buttonPrimary}>
              Choose a story
            </Link>
          </section>
        )
      )}
      {isGuardian && view && view.fresh.length > 0 && (
        <BookShelf id="new" title="New stories" books={view.fresh} more={{ href: "/family/books", label: "Browse stories" }} />
      )}

      {isGuardian && view && (
        <section className="flex flex-col gap-3" aria-labelledby="storytellers-h">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="storytellers-h" className="font-display text-2xl font-semibold">Family storytellers</h2>
            <Link href="/family/narrators" className="font-display font-semibold text-coral-deep underline-offset-4 hover:underline">
              Family Circle
            </Link>
          </div>
          {view.storytellers.length > 0 ? (
            <StorytellerRow storytellers={view.storytellers} />
          ) : (
            <p className="text-muted">No storytellers yet. Invite a grandparent, aunt or uncle to record their voice.</p>
          )}
          {!account && (
            <Link href="/billing/narrator-slots" className="self-start font-semibold underline underline-offset-4">
              Add a narrator slot
            </Link>
          )}
        </section>
      )}

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

      {isGuardian && !account && (
        <section className="flex flex-col gap-3" aria-labelledby="invite-h">
          <h2 id="invite-h" className="font-display text-2xl font-semibold">Grow your family circle</h2>
          <InviteActions headingLevel={3} />
          <FamilyRewardsCard />
        </section>
      )}

      {isGuardian && (
        <section className="flex flex-col gap-3" aria-labelledby="controls-h">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="controls-h" className="font-display text-2xl font-semibold">Parent controls</h2>
            <Link href="/family/controls" className="font-display font-semibold text-coral-deep underline-offset-4 hover:underline">
              All parent controls
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/family/books" className={buttonSecondary}>
              Family library
            </Link>
            <Link href="/family/billing" className={buttonSecondary}>
              Plan and billing
            </Link>
            <Link href="/family/credits" className={buttonSecondary}>
              Readli credits
            </Link>
            <Link href="/family/narrators" className={buttonSecondary}>
              Narrator slots
            </Link>
          </div>
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        {account ? (
          <>
            <Link href="/family/account" className={buttonSecondary}>
              Account settings
            </Link>
            <SignOutButton />
          </>
        ) : (
          <>
            <SessionButton as={null} next="/family" className={buttonSecondary}>
              Sign out
            </SessionButton>
            <ResetButton />
          </>
        )}
      </div>
    </FamilyShell>
  );
}
