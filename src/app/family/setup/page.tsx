import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { FAMILY_NAME_COOKIE } from "@/lib/onboarding/start";
import { redirect } from "next/navigation";
import { parentPrimary, parentSecondary } from "@/components/brand/buttons";
import { AccountVoiceSetup } from "@/components/accounts/AccountVoiceSetup";
import { CheckoutDone } from "@/components/family/BillingActions";
import { SetKidsPin } from "@/components/family/SetKidsPin";
import { SessionButton } from "@/components/family/SessionButton";
import { CATALOG } from "@/lib/library/catalog";
import { NAMED_COOKIE } from "@/lib/family/setup-cookie";
import { SetupMiniPlayer } from "@/components/family/SetupMiniPlayer";
import { SetupPrepareBook } from "@/components/family/SetupPrepareBook";
import { ChildProfiles } from "@/components/family/ChildProfiles";
import { FamilyOff, FamilyShell, NeedsGrownUp } from "@/components/family/FamilyShell";
import { FamilyParents } from "@/components/family/FamilyParents";
import { NameFamily } from "@/components/family/NameFamily";
import { PlanStarting } from "@/components/family/PlanStarting";
import { Welcome } from "@/components/onboarding/Welcome";
import { SetupStorytellerInvites, SetupUseMyVoice } from "@/components/family/SetupSteps";
import { billingConfig } from "@/lib/billing/config";
import { confirmCheckout } from "@/lib/billing/confirm";
import { StripeApi } from "@/lib/billing/stripe-api";
import { chosenName } from "@/lib/account/names";
import { currentAdult } from "@/lib/auth/adult";
import { accountDb } from "@/lib/family/account-store";
import { familyPage, guardianChildren } from "@/lib/family/page-data";
import { activeEntitlement, activeShare } from "@/lib/family/permissions";
import { childProfiles, familyParents, homeHousehold, PROVISIONAL_FAMILY_NAME } from "@/lib/family/service";
import { deviceRegistry, familyStore } from "@/lib/family/session";
import { listenView, prepareView } from "@/lib/narration/narration";
import { recorderProps } from "@/lib/voice/recorder";
import {
  familyInvited,
  firstStoryChosen,
  myVoiceForKids,
  SETUP_STEP_LABELS,
  SETUP_STEPS,
  setupHref,
  setupProgress,
  setupStep,
  stepAfter,
  stepBefore,
  type SetupStep,
} from "@/lib/family/setup";
import { listInvites } from "@/lib/invites/server";
import { familyLibrary } from "@/lib/library/discovery";
import { serverConfig } from "@/lib/server/config";
import { accountVoiceDeps } from "@/lib/voice/account-voices";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Set up your family | Readli", robots: { index: false } };

/** Setup's one intro book: about a minute long, so it's quick and cheap to hear working. */
const INTRO_BOOK = "the-lion-and-the-mouse";

/** Where each step's "Next" goes, in words. */
const NEXT_LABEL: Record<SetupStep, string> = {
  voice: "Next: your voice",
  kids: "Next: add your kids",
  family: "Next: invite your family",
  book: "Next: your first book",
  listen: "Next: listen to it",
  done: "Finish",
};

/** The steps across the top: where you are, what's done, and a way to jump to any of them. */
function Stepper({ step, done }: { step: SetupStep; done: Record<(typeof SETUP_STEPS)[number], boolean> }) {
  return (
    <nav aria-label="Setup steps">
      <ol className="grid grid-cols-5 gap-2" data-testid="setup-stepper">
        {SETUP_STEPS.map((s, i) => {
          const current = s === step;
          // The bar fills in order: a step ahead of the one you're on stays grey even if it's already done (a family
          // that added a child elsewhere), and turns green once you reach or pass it. The optional family step
          // and the listen step count as done once you're past them. A step you skipped stays grey.
          const at = step === "done" ? SETUP_STEPS.length : (SETUP_STEPS as readonly string[]).indexOf(step);
          const ok = i <= at && (done[s] || ((s === "family" || s === "listen") && i < at));
          return (
            <li key={s} className="min-w-0">
              <Link
                href={setupHref(s)}
                aria-current={current ? "step" : undefined}
                className="flex flex-col gap-1.5 rounded-xl p-1 text-sm hover:bg-ink/5"
                data-testid={`setup-step-${s}`}
              >
                <span className={`rounded-full ${current ? "h-3" : "h-2"} ${ok ? "bg-mint" : current ? "bg-coral-deep" : "bg-ink/15"}`} aria-hidden="true" />
                <span className={`truncate ${current ? "font-semibold" : "text-muted"}`}>
                  <span aria-hidden="true">{ok ? "✓ " : <span className="hidden sm:inline">{i + 1}. </span>}</span>
                  {SETUP_STEP_LABELS[s]}
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

/** The bottom of every step: back, skip or next. */
function StepNav({ step, ready, skip = "Skip for now", nextHref, required }: { step: SetupStep; ready: boolean; skip?: string; nextHref?: string; required?: string }) {
  const before = stepBefore(step);
  // The first step goes back to the welcome page.
  const backHref = before ? setupHref(before) : step === "voice" ? "/family/setup?step=welcome" : null;
  const next = stepAfter(step);
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-ink/10 pt-5">
      {backHref && (
        <Link href={backHref} className="font-semibold underline underline-offset-4">
          Back
        </Link>
      )}
      <div className="ml-auto flex flex-wrap items-center justify-end gap-x-5 gap-y-3">
        <Link href="/family/setup/later" className="text-sm text-muted underline underline-offset-4 hover:text-ink">
          Finish setting up later
        </Link>
        {!ready && required ? (
          // A step that can't be skipped: Next waits until it's done.
          <button type="button" className={`${parentPrimary} cursor-not-allowed opacity-50`} disabled data-testid="setup-next">
            {required}
          </button>
        ) : (
          <Link href={nextHref ?? setupHref(next)} className={ready ? parentPrimary : parentSecondary} data-testid="setup-next">
            {ready ? NEXT_LABEL[next] : skip}
          </Link>
        )}
      </div>
    </div>
  );
}

/** No plan on this family and no payment on its way: say so plainly, with the way to start or restore one. */
function NoPlan() {
  return (
    <p className="rounded-2xl bg-sunshine/50 p-4" data-testid="setup-no-plan">
      Readli Family isn&apos;t active for your family right now, so adding kids and preparing books are paused. You can still record your voice.{" "}
      <Link href="/family/settings/plan" className="font-semibold underline underline-offset-4">
        See plans
      </Link>
    </p>
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
 * New families' walkthrough, one screen at a time: record your own voice, add your kids, invite a
 * co-parent and other storytellers, then prepare a first book. Family checkout and claimed gifts both
 * land here, and Family Home sends a new family here the first time it opens.
 */
export default async function FamilySetupPage({ searchParams }: { searchParams: Promise<{ checkout?: string; session_id?: string; step?: string; book?: string; voice?: string; named?: string; from?: string }> }) {
  const q = await searchParams;
  const page = await familyPage();
  if (!page.enabled) return <FamilyOff />;
  const { session, state } = page;
  if (!session || !state) redirect("/login?next=/family/setup");
  if (session.actor.kind !== "adult") return <NeedsGrownUp text="Only a parent or guardian can set up the family." />;
  const actor = session.actor;
  const adultId = actor.adultId;
  const adult = state.adults.find((a) => a.id === adultId);
  const home = homeHousehold(state, adultId);
  if (!adult || !home) redirect("/signup/family");
  let plan = Boolean(activeEntitlement(state, home));
  // Back from Stripe: confirm the checkout now rather than waiting on the webhook to turn the plan on.
  const config = billingConfig();
  const db = accountDb();
  if (!plan && q.checkout === "success" && q.session_id && db && config.mode !== "off") {
    const stripe = new StripeApi(config);
    const outcome = await confirmCheckout(db, (id) => stripe.getCheckoutSession(id), q.session_id, home).catch(() => null);
    plan = outcome?.status === "done";
  }
  const store = (await familyStore(session))!;
  const familyName = state.households.find((h) => h.id === home)?.name ?? "";
  const named = familyName !== "" && familyName !== PROVISIONAL_FAMILY_NAME;
  const kids = guardianChildren(state, adultId).filter((c) => c.householdId === home);
  // Your own recording counts as soon as it's made, even while it's still processing.
  const deps = session.account ? accountVoiceDeps(serverConfig()) : null;
  const ownRecording = deps ? await deps.store.findVoice(adultId).catch(() => null) : null;
  const ownInState = state.voices.find((v) => v.ownerId === adultId && v.deletedAt === null);
  const recorded = Boolean(ownRecording || ownInState);
  const sharedVoice = state.voices.some((v) => v.status === "ready" && v.deletedAt === null && activeShare(state, v.id, home) !== null);
  const voice = recorded || sharedVoice;
  const pendingInvites = db ? (await listInvites(db, home).catch(() => [])).filter((i) => i.status === "invited").length : 0;
  const invited = familyInvited(state, adultId, home, pendingInvites);
  const progress = setupProgress({ voice, kids: kids.length > 0, story: firstStoryChosen(state, home), family: invited });
  // A family that hasn't started yet sees the welcome page first: what Readli is, then "Let's get started!".
  // Someone who came through the signup welcome (/start) already saw it, named themselves and heard their voice:
  // they carry on from the first step still to do, never the welcome again.
  const throughStart = q.from === "start" || Boolean((await cookies()).get(FAMILY_NAME_COOKIE));
  const welcome = q.step === "welcome" || (!q.step && !throughStart && !voice && kids.length === 0 && !progress.story);
  const step = setupStep(q.step, progress);
  // The first story can't be skipped: Listen and the last page wait until one is prepared (or being prepared).
  const storyLib = plan && (step === "listen" || step === "done") ? await familyLibrary(store, actor, home) : null;
  const hasStory = progress.story || Boolean(storyLib?.all.some((b) => b.narrators.some((n) => n.availability === "ready" || n.availability === "partial")));
  if ((step === "listen" || step === "done") && !hasStory) redirect(setupHref("book"));
  const mine = plan ? myVoiceForKids(state, adultId, home, store.plan) : null;
  const askMyVoice = Boolean(mine && !mine.on && kids.length > 0);
  const kidNames = kids.map((k) => k.nickname);
  // A few books to try next on the last page, after the one setup prepared.
  const moreBooks = CATALOG.filter((b) => b.coverUrl && b.slug !== INTRO_BOOK).slice(0, 6);
  const invitesOn = Boolean(db && session.account);
  const done = { voice, kids: kids.length > 0, family: invited, book: hasStory, listen: false };
  // Just back from Stripe, the payment may still be confirming; otherwise there's simply no plan on this family.
  const paying = !plan && q.checkout === "success";
  const opensLater = paying ? (
    <p className="rounded-2xl bg-sunshine/50 p-4">This step opens as soon as your plan starts. You can record your voice while you wait.</p>
  ) : (
    <NoPlan />
  );
  const n = (SETUP_STEPS as readonly string[]).indexOf(step) + 1;
  const eyebrow = step === "done" ? "All set" : `Step ${n} of ${SETUP_STEPS.length}`;

  // Sign-in fills the name from Google, which can be a business name; the welcome page asks them to keep or change it.
  const signedIn = session.account ? await currentAdult() : null;
  // Named on the gift page just now: setup greets them instead of asking again.
  const namedOnGift = (await cookies()).get(NAMED_COOKIE)?.value === "1";
  const myName = chosenName(adult.displayName, signedIn?.email, signedIn?.named);
  if (welcome) {
    return (
      <FamilyShell>
        {q.checkout === "success" && <CheckoutDone sessionId={q.session_id} />}
        {paying && <PlanStarting waiting="Thank you! Your plan starts as soon as the payment goes through, usually within a minute. Have a look around while you wait." />}
        {!plan && !paying && <NoPlan />}
        <Welcome kind="family" startHref={setupHref("voice")} name={myName?.split(" ")[0]} askName={session.account && !((q.named === "1" || namedOnGift) && myName) ? (myName ?? "") : undefined} />
      </FamilyShell>
    );
  }

  const recorder = step === "voice" && !recorded && session.account ? await recorderProps(adultId) : null;
  const pinRegistry = step === "kids" && kids.length > 0 ? deviceRegistry(Boolean(session.account)) : null;
  const needsPin = Boolean(pinRegistry && !(await pinRegistry.pinHash(home).catch(() => "unknown")));

  let body: React.ReactNode;
  if (step === "voice") {
    const intro = (
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-semibold sm:text-4xl">{recorded ? "Your voice is recorded" : "First, record your voice"}</h1>
        <p className="max-w-2xl text-lg">
          {recorded
            ? "Readli will read your kids' stories in it. You can re-record it any time from My Voice."
            : "Read a short passage aloud, about one minute. Readli then reads every story to your kids in your voice, even when you're not there."}
        </p>
      </header>
    );
    body = (
      <>
        {!recorder && intro}
        {recorded ? (
          <Done>{ownInState?.status === "ready" ? "Your voice is ready." : "Your voice is being made. It usually takes a few minutes, so carry on."}</Done>
        ) : recorder ? (
          // Recording, making and keeping the voice all happen right here, so setup never leaves for another page.
          <AccountVoiceSetup
            hasVoice={recorder.hasVoice}
            guestTake={recorder.guestTake}
            waiting={recorder.waiting}
            parent
            next={setupHref("kids")}
            nextLabel="Next: add your kids"
            intro={intro}
            footer={<StepNav step="voice" ready={false} skip="Skip, I'll record later" />}
            doneFooter={<StepNav step="voice" ready />}
          />
        ) : (
          <div className="flex flex-col items-start gap-3 rounded-3xl bg-surface p-5 ring-2 ring-ink/10 sm:p-6">
            <ul className="flex list-disc flex-col gap-1 pl-5">
              <li>Find a quiet room and use your phone or computer&apos;s microphone.</li>
              <li>Read the words on the screen in your normal bedtime-story voice.</li>
              <li>Your voice stays private. Only the kids you choose ever hear it.</li>
            </ul>
            <Link href={`/voice/record?next=${encodeURIComponent(setupHref("kids"))}`} className={parentPrimary} data-testid="setup-record">
              Record my voice
            </Link>
          </div>
        )}
        {!recorder && <StepNav step="voice" ready={recorded} skip="Skip, I'll record later" />}
      </>
    );
  } else if (step === "kids") {
    body = (
      <>
        <header className="flex flex-col gap-2">
          <h1 className="font-display text-3xl font-semibold sm:text-4xl">Add your kids</h1>
          <p className="max-w-2xl text-lg">Each child gets their own bookshelf and keeps their own place in every book. A first name or nickname is enough.</p>
        </header>
        {plan ? <ChildProfiles initial={await childProfiles(store, actor, home)} inSetup /> : opensLater}
        {needsPin && (
          <section className="flex flex-col gap-2" aria-labelledby="pin-h">
            <h2 id="pin-h" className="font-display text-2xl font-semibold">
              Set your family PIN
            </h2>
            <p className="text-muted">Your kids&apos; space is locked so little fingers stay in it. You&apos;ll use this 4-digit PIN to get back to Readli Family.</p>
            <SetKidsPin intro="Choose 4 digits you'll remember. Kids won't see it." />
          </section>
        )}
        <StepNav step="kids" ready={kids.length > 0} />
      </>
    );
  } else if (step === "family") {
    const parents = plan ? await familyParents(store, actor, home) : null;
    const coParentInvites = db && parents?.youOwn ? (await listInvites(db, home, { role: "guardian" }).catch(() => [])).filter((i) => i.status === "invited") : [];
    const storytellerInvites = db ? (await listInvites(db, home).catch(() => [])).filter((i) => i.status === "invited").map((i) => ({ id: i.id, name: i.name })) : [];
    const otherParents = parents ? parents.parents.filter((p) => !p.you) : [];
    body = (
      <>
        <header className="flex flex-col gap-2">
          <h1 className="font-display text-3xl font-semibold sm:text-4xl">Invite your family</h1>
          <p className="max-w-2xl text-lg">Bring in the people who share bedtime. Both of these are optional, and you can do them any time from Family.</p>
        </header>
        {!plan || !parents ? (
          opensLater
        ) : (
          <>
            <section className="flex flex-col gap-3" aria-labelledby="co-parent-h">
              <div className="flex flex-col gap-1">
                <h2 id="co-parent-h" className="font-display text-2xl font-semibold">
                  Your partner or co-parent
                </h2>
                <p className="text-muted">They get their own sign-in and every parent control except billing, and can record their voice too. It&apos;s free for them.</p>
              </div>
              {otherParents.length > 0 ? (
                <Done>
                  {otherParents.map((p) => p.name).join(" and ")} {otherParents.length === 1 ? "is" : "are"} already a parent in your family.
                </Done>
              ) : (
                parents.youOwn && <FamilyParents view={parents} initialInvites={coParentInvites} live={invitesOn} inSetup />
              )}
            </section>
            <section className="flex flex-col gap-3" aria-labelledby="storytellers-h">
              <div className="flex flex-col gap-1">
                <h2 id="storytellers-h" className="font-display text-2xl font-semibold">
                  Grandparents and other storytellers
                </h2>
                <p className="text-muted">They record their voice for free from their own phone, and you choose which kids hear it.</p>
              </div>
              <SetupStorytellerInvites live={invitesOn} initial={storytellerInvites} />
            </section>
          </>
        )}
        <StepNav step="family" ready skip="Next: your first book" />
      </>
    );
  } else if (step === "book") {
    const lib = plan ? await familyLibrary(store, actor, home) : null;
    // One intro book, the quickest to prepare: The Lion and the Mouse when the library has it.
    const intro = lib ? (lib.all.find((b) => b.slug === INTRO_BOOK) ?? [...lib.all].sort((a, b) => a.minutes - b.minutes)[0]) : undefined;
    const prep = intro && mine ? await prepareView(store, actor, home, intro.slug).catch(() => null) : null;
    const introReady = Boolean(prep?.voices.some((v) => v.voiceId === mine?.voiceId && v.availability === "ready"));
    body = (
      <>
        <header className="flex flex-col gap-2">
          <h1 className="font-display text-3xl font-semibold sm:text-4xl">Prepare their first book</h1>
          <p className="max-w-2xl text-lg">
            We&apos;ll start with a short one, read in your voice, so you can hear how it works. It goes straight onto your kids&apos; bookshelves. The whole library is in Books whenever you want more.
          </p>
        </header>
        {!plan ? (
          opensLater
        ) : kids.length === 0 ? (
          <p className="rounded-2xl bg-sunshine/50 p-4">
            Add a child first, so there&apos;s someone to read to.{" "}
            <Link href={setupHref("kids")} className="font-semibold underline underline-offset-4">
              Add your kids
            </Link>
          </p>
        ) : !intro ? (
          <p className="rounded-2xl bg-sunshine/50 p-4">The library is still loading its first books. Try again in a moment.</p>
        ) : prep && mine ? (
          <SetupPrepareBook key={String(mine.on)} initial={prep} voiceId={mine.voiceId} listenHref={`${setupHref("listen")}&book=${intro.slug}&voice=${encodeURIComponent(mine.voiceId)}`} />
        ) : (
          <p className="rounded-2xl bg-sunshine/50 p-4">
            {recorded ? "Your voice is still being made, usually a few minutes. Refresh this page in a moment to prepare the book." : "Record your voice first, so the book can be read in it."}{" "}
            {!recorded && (
              <Link href={setupHref("voice")} className="font-semibold underline underline-offset-4">
                Record my voice
              </Link>
            )}
          </p>
        )}
        <StepNav step="book" ready={progress.story || introReady} required="Prepare the book to continue" />
      </>
    );
  } else if (step === "listen") {
    const lib = plan ? await familyLibrary(store, actor, home) : null;
    const playable = (b: NonNullable<typeof lib>["all"][number]) => b.narrators.find((n) => n.availability === "ready" || n.availability === "partial");
    // The book setup just prepared (named in the link from the Book step), or else the first one ready to play.
    const asked = lib?.all.find((b) => b.slug === q.book && playable(b));
    const book = asked ?? lib?.all.find((b) => playable(b)) ?? null;
    const reader = book ? (book.narrators.find((n) => n.voiceId === q.voice && (n.availability === "ready" || n.availability === "partial")) ?? playable(book)!) : null;
    const preparing = !book && Boolean(lib?.all.some((b) => b.narrators.some((n) => n.availability === "preparing")));
    const heard = book && reader ? await listenView(store, actor, home, book.slug).catch(() => null) : null;
    const hv = heard?.voices.find((v) => v.voiceId === reader?.voiceId) ?? null;
    const text = heard && hv ? (heard.texts.texts[hv.revision] ?? heard.texts.texts[heard.texts.current]) : null;
    body = (
      <>
        <header className="flex flex-col gap-2">
          <h1 className="font-display text-3xl font-semibold sm:text-4xl">{book ? "Listen to it together" : preparing ? "Your first book is almost ready" : "Prepare a book first"}</h1>
          <p className="max-w-2xl text-lg">
            {book
              ? "Play it here to hear how it sounds. It's already on your kids' bookshelves in Readli Kids."
              : preparing
                ? "It's being prepared now, usually a minute or two. Refresh this page in a moment to play it."
                : "Once a book is prepared, you can play it here."}
          </p>
        </header>
        {book && reader ? (
          <div className="flex flex-wrap items-start gap-5 rounded-3xl bg-surface p-5 ring-2 ring-ink/10" data-testid="setup-listen">
            <span className="block w-28 shrink-0 overflow-hidden rounded-xl bg-bookcase shadow-[0_3px_0_rgba(40,53,72,0.12)]">
              {book.coverUrl ? (
                <Image src={book.coverUrl} alt="" width={160} height={213} className="aspect-[3/4] w-full object-cover" />
              ) : (
                <span className={`flex aspect-[3/4] w-full items-center justify-center p-2 text-center font-display text-sm font-semibold ${book.tint}`}>{book.title}</span>
              )}
            </span>
            <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
              <p className="font-display text-2xl font-semibold">{book.title}</p>
              <p className="text-muted">Read by {reader.name}</p>
              {hv && text ? (
                <SetupMiniPlayer
                  slug={book.slug}
                  voiceId={hv.voiceId}
                  revision={hv.revision}
                  sentences={text.sentences}
                  sentenceIds={text.sentenceIds}
                  chapters={text.chapters}
                  ready={text.sentenceIds.map((id) => hv.readySentenceIds.includes(id))}
                />
              ) : (
                <p className="text-muted">It&apos;s still being prepared. Refresh in a moment to play it.</p>
              )}
            </div>
          </div>
        ) : (
          !preparing && (
            <Link href={setupHref("book")} className={`${parentSecondary} self-start`}>
              Prepare a first book
            </Link>
          )
        )}
        {/* Finish leads to the last page: what's left, and what to do next. */}
        <StepNav step="listen" ready={Boolean(book)} skip="Finish without listening" />
      </>
    );
  } else {
    const left = [!voice && "record your voice", kids.length === 0 && "add your kids", !hasStory && "prepare a first book"].filter(Boolean) as string[];
    body = (
      <>
        <header className="flex flex-col gap-2">
          <h1 className="font-display text-3xl font-semibold sm:text-4xl">You&apos;re all set!</h1>
          <p className="max-w-2xl text-lg">
            {left.length === 0
              ? "Your voice is in, your kids are set up and their first book is on their bookshelves. Here's what you can do next."
              : `You can still ${left.join(", ")}. Family Home keeps a reminder until it's done.`}
          </p>
        </header>
        <ul className="flex flex-col gap-2">
          {[
            [voice, "Your voice", "voice"],
            [kids.length > 0, kids.length > 0 ? `Kids: ${kidNames.join(", ")}` : "Your kids", "kids"],
            [hasStory, "First book", "book"],
          ].map(([ok, label, s]) => (
            <li key={s as string}>
              <Link href={setupHref(s as SetupStep)} className="flex items-center gap-3 rounded-2xl bg-surface p-3 ring-2 ring-ink/10 hover:ring-ink/30">
                <span aria-hidden="true" className={`grid size-7 shrink-0 place-items-center rounded-full text-sm font-semibold ${ok ? "bg-mint" : "bg-ink/10"}`}>
                  {ok ? "✓" : "!"}
                </span>
                <span className="font-semibold">{label as string}</span>
                <span className="ml-auto text-sm text-muted">{ok ? "Done" : "To do"}</span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-6" data-testid="setup-whats-next">
          {kids.length > 0 && (
            <section aria-labelledby="next-kids-h" className="flex flex-col gap-3 rounded-3xl bg-sky/40 p-5 sm:p-6">
              <h2 id="next-kids-h" className="font-display text-2xl font-semibold">
                It&apos;s story time
              </h2>
              <p>Open Readli Kids on this device, or on your child&apos;s tablet, and their books are waiting on their bookshelf.</p>
              <div className="flex flex-wrap gap-3">
                {kids.map((k) => (
                  <SessionButton key={k.id} as={`child:${k.id}`} next="/kids" className={parentPrimary}>
                    Open {k.nickname}&apos;s Readli Kids
                  </SessionButton>
                ))}
              </div>
            </section>
          )}
          <section aria-labelledby="next-books-h" className="flex flex-col gap-3 rounded-3xl bg-surface p-5 ring-2 ring-ink/10 sm:p-6">
            <h2 id="next-books-h" className="font-display text-2xl font-semibold">
              Add more books
            </h2>
            <p>Pick a story, choose whose voice reads it, and it appears on your kids&apos; bookshelves once it&apos;s prepared. A few to start with:</p>
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              {moreBooks.map((b) => (
                <li key={b.slug} className="min-w-0">
                  <Link href={`/family/books/${b.slug}`} className="flex flex-col gap-1 hover:opacity-90">
                    <span className="block overflow-hidden rounded-xl bg-bookcase shadow-[0_3px_0_rgba(40,53,72,0.12)]">
                      <Image src={b.coverUrl!} alt="" width={160} height={213} className="aspect-[3/4] w-full object-cover" />
                    </span>
                    <span className="line-clamp-2 text-sm leading-snug font-semibold">{b.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link href="/family/books" className={`${parentSecondary} self-start`} data-testid="setup-browse-books">
              Browse all books
            </Link>
          </section>
          <section aria-labelledby="next-voices-h" className="flex flex-col gap-3 rounded-3xl bg-surface p-5 ring-2 ring-ink/10 sm:p-6">
            <h2 id="next-voices-h" className="font-display text-2xl font-semibold">
              Add more voices
            </h2>
            <p>Invite grandparents, a co-parent or anyone else who reads to your kids. They record their voice once, for free, and every book can be read in it.</p>
            <Link href="/family/narrators#invite" className={`${parentSecondary} self-start`} data-testid="setup-invite-voices">
              Invite a storyteller
            </Link>
          </section>
        </div>
        {!named && plan && (
          <section aria-labelledby="optional" className="flex flex-col gap-3 rounded-2xl p-5 ring-1 ring-ink/10 sm:p-6">
            <h2 id="optional" className="text-lg font-semibold">
              Optional: name your family
            </h2>
            <NameFamily current="" />
          </section>
        )}
        <div className="flex flex-wrap items-center gap-4 border-t border-ink/10 pt-5">
          <Link href={setupHref("listen")} className={parentSecondary}>
            Back
          </Link>
          <Link href="/family/setup/later" className={`${parentPrimary} ml-auto`} data-testid="setup-finish">
            Go to Family Home
          </Link>
        </div>
      </>
    );
  }

  return (
    <FamilyShell>
      {/* Your voice reads to your kids as soon as both exist, without a separate button. */}
      {askMyVoice && <SetupUseMyVoice />}
      {q.checkout === "success" && <CheckoutDone sessionId={q.session_id} />}
      {paying && <PlanStarting waiting="Thank you! Your plan starts as soon as the payment goes through, usually within a minute. You can record your voice while you wait." />}
      <div className="flex flex-col gap-4">
        <p className="text-sm font-bold tracking-wider text-muted uppercase" data-testid="setup-progress">
          Setting up {named ? familyName : "your family"} · {eyebrow}
        </p>
        <Stepper step={step} done={done} />
      </div>
      <div className="flex flex-col gap-6" data-testid={`setup-${step}`}>
        {body}
      </div>
    </FamilyShell>
  );
}
