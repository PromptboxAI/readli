import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { parentPrimary, parentSecondary } from "@/components/brand/buttons";
import { CheckoutDone } from "@/components/family/BillingActions";
import { ChildProfiles } from "@/components/family/ChildProfiles";
import { FamilyOff, FamilyShell, NeedsGrownUp } from "@/components/family/FamilyShell";
import { FamilyParents } from "@/components/family/FamilyParents";
import { NameFamily } from "@/components/family/NameFamily";
import { PlanStarting } from "@/components/family/PlanStarting";
import { SetupSeen, SetupStorytellerInvites, SetupUseMyVoice } from "@/components/family/SetupSteps";
import { billingConfig } from "@/lib/billing/config";
import { confirmCheckout } from "@/lib/billing/confirm";
import { StripeApi } from "@/lib/billing/stripe-api";
import { accountDb } from "@/lib/family/account-store";
import { familyPage, guardianChildren } from "@/lib/family/page-data";
import { activeEntitlement, activeShare } from "@/lib/family/permissions";
import { childProfiles, familyParents, homeHousehold, PROVISIONAL_FAMILY_NAME } from "@/lib/family/service";
import { familyStore } from "@/lib/family/session";
import {
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

const STARTER_BOOKS = 3;

/** Where each step's "Next" goes, in words. */
const NEXT_LABEL: Record<SetupStep, string> = {
  voice: "Next: your voice",
  kids: "Next: add your kids",
  family: "Next: invite your family",
  book: "Next: your first book",
  done: "Finish",
};

/** The steps across the top: where you are, what's done, and a way to jump to any of them. */
function Stepper({ step, done }: { step: SetupStep; done: Record<(typeof SETUP_STEPS)[number], boolean> }) {
  return (
    <nav aria-label="Setup steps">
      <ol className="grid grid-cols-4 gap-2" data-testid="setup-stepper">
        {SETUP_STEPS.map((s, i) => {
          const current = s === step;
          // The bar fills in order: a step ahead of the one you're on stays grey even if it's already done (a family
          // that added a child elsewhere), and turns green once you reach or pass it. The optional family step
          // counts as done once you're past it. A step you skipped stays grey.
          const at = step === "done" ? SETUP_STEPS.length : (SETUP_STEPS as readonly string[]).indexOf(step);
          const ok = i <= at && (done[s] || (s === "family" && i < at));
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
function StepNav({ step, ready, skip = "Skip for now" }: { step: SetupStep; ready: boolean; skip?: string }) {
  const back = stepBefore(step);
  const next = stepAfter(step);
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-ink/10 pt-5">
      <Link href={setupHref(next)} className={ready ? parentPrimary : parentSecondary} data-testid="setup-next">
        {ready ? NEXT_LABEL[next] : skip}
      </Link>
      {back && (
        <Link href={setupHref(back)} className="font-semibold underline underline-offset-4">
          Back
        </Link>
      )}
      <Link href="/family" className="ml-auto text-sm text-muted underline underline-offset-4 hover:text-ink">
        Finish setting up later
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
 * New families' walkthrough, one screen at a time: record your own voice, add your kids, invite a
 * co-parent and other storytellers, then prepare a first book. Family checkout and claimed gifts both
 * land here, and Family Home sends a new family here the first time it opens.
 */
export default async function FamilySetupPage({ searchParams }: { searchParams: Promise<{ checkout?: string; session_id?: string; step?: string }> }) {
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
  const progress = setupProgress({ voice, kids: kids.length > 0, story: firstStoryChosen(state, home) });
  const step = setupStep(q.step, progress);
  const mine = plan ? myVoiceForKids(state, adultId, home, store.plan) : null;
  const askMyVoice = Boolean(mine && !mine.on && kids.length > 0);
  const kidNames = kids.map((k) => k.nickname);
  const invitesOn = Boolean(db && session.account);
  const done = { voice, kids: kids.length > 0, family: false, book: progress.story };
  const opensLater = <p className="rounded-2xl bg-sunshine/50 p-4">This step opens as soon as your plan starts. You can record your voice while you wait.</p>;
  const n = (SETUP_STEPS as readonly string[]).indexOf(step) + 1;
  const eyebrow = step === "done" ? "All set" : `Step ${n} of ${SETUP_STEPS.length}`;

  let body: React.ReactNode;
  if (step === "voice") {
    body = (
      <>
        <header className="flex flex-col gap-2">
          <h1 className="font-display text-3xl font-semibold sm:text-4xl">{recorded ? "Your voice is recorded" : "First, record your voice"}</h1>
          <p className="max-w-2xl text-lg">
            {recorded
              ? "Readli will read your kids' stories in it. You can re-record it any time from My Voice."
              : "Read a short passage aloud, about five minutes. Readli then reads every story to your kids in your voice, even when you're not there."}
          </p>
        </header>
        {recorded ? (
          <Done>{ownInState?.status === "ready" ? "Your voice is ready." : "Your voice is being made. It usually takes a few minutes, so carry on."}</Done>
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
        <StepNav step="voice" ready={recorded} skip="Skip, I'll record later" />
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
    // The quickest (and cheapest) story leads, so a family hears it work within minutes; recommended picks fill the rest.
    const quickest = lib ? [...lib.all].sort((a, b) => a.minutes - b.minutes)[0] : undefined;
    const starters = lib
      ? [quickest, ...lib.recommended, ...[...lib.all].sort((a, b) => a.minutes - b.minutes)]
          .filter((b, i, list): b is NonNullable<typeof b> => Boolean(b) && list.findIndex((x) => x?.slug === b!.slug) === i)
          .slice(0, STARTER_BOOKS)
      : [];
    body = (
      <>
        <header className="flex flex-col gap-2">
          <h1 className="font-display text-3xl font-semibold sm:text-4xl">{progress.story ? "Your first book is on its way" : "Prepare their first book"}</h1>
          <p className="max-w-2xl text-lg">
            {progress.story
              ? "It shows on Family Home while it's being prepared, then on each child's bookshelf in Readli Kids."
              : "Pick a short story to start with and choose whose voice reads it. Your monthly credits cover it."}
          </p>
        </header>
        {!plan ? (
          opensLater
        ) : (
          <>
            {recorded && !mine && (
              <p className="rounded-2xl bg-sunshine/50 p-4">
                Your voice is still being made, usually a few minutes. Choose a book now and you can prepare it as soon as your voice is ready.
              </p>
            )}
            {progress.story && <Done>Your first book is being prepared.</Done>}
            {kids.length === 0 && (
              <p className="rounded-2xl bg-sunshine/50 p-4">
                Add a child first, so there&apos;s someone to read to.{" "}
                <Link href={setupHref("kids")} className="font-semibold underline underline-offset-4">
                  Add your kids
                </Link>
              </p>
            )}
            {starters.length > 0 && (
              <section className="flex flex-col gap-3" aria-labelledby="starters-h">
                <h2 id="starters-h" className="font-display text-2xl font-semibold">
                  {progress.story ? "Another good one to start with" : "Good first stories"}
                </h2>
                <ul className="grid grid-cols-3 gap-3 sm:gap-4" data-testid="setup-books">
                  {starters.map((b) => (
                    <li key={b.slug} className="min-w-0">
                      <Link href={`/family/books/${b.slug}?from=setup`} className="flex flex-col gap-2 rounded-2xl p-1 hover:bg-ink/5">
                        <span className="block overflow-hidden rounded-xl bg-bookcase shadow-[0_3px_0_rgba(40,53,72,0.12)]">
                          {b.coverUrl ? (
                            <Image src={b.coverUrl} alt="" width={240} height={320} className="aspect-[3/4] w-full object-cover" />
                          ) : (
                            <span className={`flex aspect-[3/4] w-full items-center justify-center p-3 text-center font-display font-semibold ${b.tint}`}>{b.title}</span>
                          )}
                        </span>
                        <span className="line-clamp-2 font-semibold leading-snug">{b.title}</span>
                        <span className="text-sm text-muted">
                          {b.minutes} min{b.slug === quickest?.slug ? " · quickest to try" : ""}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-muted">The whole library is in Books whenever you want more.</p>
              </section>
            )}
          </>
        )}
        <StepNav step="book" ready={progress.story} skip="Skip, I'll choose later" />
      </>
    );
  } else {
    const left = [!voice && "record your voice", kids.length === 0 && "add your kids", !progress.story && "prepare a first book"].filter(Boolean) as string[];
    body = (
      <>
        <header className="flex flex-col gap-2">
          <h1 className="font-display text-3xl font-semibold sm:text-4xl">{left.length === 0 ? "You're all set" : "Nearly there"}</h1>
          <p className="max-w-2xl text-lg">
            {left.length === 0
              ? "Your voice is in, your kids are set up and their first book is on its way. Open Readli Kids from Family Home when it's story time."
              : `You can still ${left.join(", ")}. Family Home keeps a reminder until it's done.`}
          </p>
        </header>
        <ul className="flex flex-col gap-2">
          {[
            [voice, "Your voice", "voice"],
            [kids.length > 0, kids.length > 0 ? `Kids: ${kidNames.join(", ")}` : "Your kids", "kids"],
            [progress.story, "First book", "book"],
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
        {!named && plan && (
          <section aria-labelledby="optional" className="flex flex-col gap-3 rounded-2xl p-5 ring-1 ring-ink/10 sm:p-6">
            <h2 id="optional" className="text-lg font-semibold">
              Optional: name your family
            </h2>
            <NameFamily current="" />
          </section>
        )}
        <div className="flex flex-wrap items-center gap-4 border-t border-ink/10 pt-5">
          <Link href="/family" className={parentPrimary} data-testid="setup-finish">
            Go to Family Home
          </Link>
          <Link href={setupHref("book")} className={parentSecondary}>
            Back
          </Link>
        </div>
      </>
    );
  }

  return (
    <FamilyShell>
      <SetupSeen />
      {/* Your voice reads to your kids as soon as both exist, without a separate button. */}
      {askMyVoice && <SetupUseMyVoice />}
      {q.checkout === "success" && <CheckoutDone sessionId={q.session_id} />}
      {!plan && <PlanStarting waiting="Thank you! Your plan starts as soon as the payment goes through, usually within a minute. You can record your voice while you wait." />}
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
