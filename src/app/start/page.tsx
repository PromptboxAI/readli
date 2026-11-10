import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountVoiceSetup } from "@/components/accounts/AccountVoiceSetup";
import { HearStoryShelf } from "@/components/accounts/HearStoryShelf";
import { welcomeStoryTexts } from "@/lib/content/welcome-stories";
import { Welcome } from "@/components/onboarding/Welcome";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import { AdultPage } from "@/components/invites/AdultPage";
import { StartStepper } from "@/components/onboarding/StartStepper";
import { FAMILY_NAME_MAX, startHref, startStep, startStepBefore, type StartStep } from "@/lib/onboarding/start";
import { startContext } from "@/lib/onboarding/start-server";
import { recorderProps } from "@/lib/voice/recorder";

export const metadata: Metadata = {
  title: "Welcome | Readli",
  robots: { index: false },
};
export const dynamic = "force-dynamic";

const field = "min-h-14 w-full max-w-md rounded-2xl border-[3px] border-ink/20 bg-surface px-4 text-xl focus:border-ink";

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

function Back({ step }: { step: StartStep }) {
  const back = startStepBefore(step);
  return back ? (
    <Link href={startHref(back)} className="font-semibold underline underline-offset-4">
      Back
    </Link>
  ) : null;
}

/**
 * The welcome for a new grown-up who signed up by email or Google: what to call them, their family's
 * name, their voice, and hearing it read a story, all before anything is bought. The last step is the
 * plan page (/start/plan): start Readli Family, or keep the free Readli Voice account. Invited storytellers
 * never come here, and a family with a plan goes home.
 */
export default async function StartPage({ searchParams }: { searchParams: Promise<{ step?: string; error?: string }> }) {
  const q = await searchParams;
  const ctx = await startContext("/start", { plan: false });
  const step = startStep(q.step, {
    familyNamed: Boolean(ctx.familyName),
    voice: ctx.voice !== "none",
  });
  if (step === "plan") redirect(startHref("plan"));
  const done = {
    name: Boolean(ctx.name),
    family: Boolean(ctx.familyName),
    voice: ctx.voice !== "none",
    listen: false,
    plan: false,
  };
  const first = ctx.name ? ctx.name.split(" ")[0] : null;

  let body: React.ReactNode;
  if (step === "name") {
    // The same welcome family and storyteller setup open with: how Readli works, a peek at the library, then their name.
    body = <Welcome kind="family" startHref={startHref("family")} name={first} askName={ctx.name ?? ""} nameNext={startHref("family")} />;
  } else if (step === "family") {
    body = (
      <>
        <header className="flex flex-col gap-2">
          <h1 className="font-display text-3xl font-semibold sm:text-4xl">{first ? `Nice to meet you, ${first}! ` : ""}What&apos;s your family called?</h1>
          <p className="max-w-2xl text-lg">Your kids see it in Readli Kids, and the grandparents and others you invite see it on their invitation. You can change it later.</p>
        </header>
        <form method="post" action="/start/family" className="flex flex-col gap-3 rounded-3xl bg-surface p-5 ring-2 ring-ink/10 sm:p-6" data-testid="start-family">
          <label htmlFor="family-name" className="font-display text-xl font-semibold">
            Family name
          </label>
          <input
            id="family-name"
            name="name"
            className={field}
            defaultValue={ctx.familyName ?? ""}
            placeholder="The Godfrey Family"
            autoComplete="off"
            maxLength={FAMILY_NAME_MAX}
            required
            aria-invalid={q.error === "name" ? true : undefined}
          />
          {q.error === "name" && (
            <p role="alert" className="font-semibold text-coral-deep">
              Give your family a name.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-5 pt-2">
            <button type="submit" className={buttonPrimary}>
              Next: record your voice
            </button>
            <Back step="family" />
          </div>
        </form>
      </>
    );
  } else if (step === "voice") {
    const recorder = ctx.voice === "none" ? await recorderProps(ctx.userId) : null;
    body = (
      <>
        <header className="flex flex-col gap-2">
          <h1 className="font-display text-3xl font-semibold sm:text-4xl">{ctx.voice === "none" ? "Now, record your voice" : "Your voice is recorded"}</h1>
          <p className="max-w-2xl text-lg">
            {ctx.voice === "none"
              ? "Read a short passage aloud in your bedtime-story voice. It takes about a minute, and you only do it once. Your voice stays private: only the families you choose can use it."
              : "Next, hear it read a bedtime story. You can record again any time from My Voice."}
          </p>
        </header>
        {ctx.voice !== "none" ? (
          <Done>{ctx.voice === "ready" ? "Your voice is ready." : "Your voice is being made. It usually takes a minute, so carry on."}</Done>
        ) : recorder ? (
          <AccountVoiceSetup
            hasVoice={recorder.hasVoice}
            guestTake={recorder.guestTake}
            waiting={recorder.waiting}
            next={startHref("listen")}
            nextLabel="Next: hear it read a story"
          />
        ) : (
          <p className="rounded-2xl bg-sunshine/50 p-4">Recording isn&apos;t switched on here yet, so you can go straight on to choosing a plan.</p>
        )}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-ink/10 pt-5">
          {ctx.voice !== "none" ? (
            <Link href={startHref("listen")} className={buttonPrimary} data-testid="start-next">
              Next: hear it read a story
            </Link>
          ) : (
            <Link href={startHref("plan")} className={buttonSecondary} data-testid="start-skip">
              Skip, I&apos;ll record later
            </Link>
          )}
          <Back step="voice" />
        </div>
      </>
    );
  } else {
    body = (
      <>
        <header className="flex flex-col gap-2">
          <h1 className="font-display text-3xl font-semibold sm:text-4xl">{ctx.voice !== "none" ? "Hear your voice read a story" : "Record your voice first"}</h1>
          <p className="max-w-2xl text-lg">
            {ctx.voice !== "none"
              ? "This is how you'll sound to your kids at bedtime. Every book in the Readli library can be read in your voice, and in the voices of anyone you invite."
              : "Once your voice is recorded, you can hear it read a story here."}
          </p>
        </header>
        {ctx.voice !== "none" ? (
          <div className="flex flex-col gap-3" data-testid="start-listen">
            {ctx.voice !== "ready" && <p className="rounded-2xl bg-sunshine/50 p-4">Your voice is still being made, usually a minute. Refresh this page in a moment to play it.</p>}
            <HearStoryShelf ready={ctx.voice === "ready"} texts={welcomeStoryTexts()} />
          </div>
        ) : (
          <Link href={startHref("voice")} className={`${buttonSecondary} self-start`}>
            Record my voice
          </Link>
        )}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-ink/10 pt-5">
          <Link href={startHref("plan")} className={buttonPrimary} data-testid="start-next">
            Next: choose your plan
          </Link>
          <Back step="listen" />
        </div>
      </>
    );
  }

  return (
    <AdultPage>
      <StartStepper step={step} done={done} />
      <div className="flex flex-col gap-6" data-testid={`start-${step}`}>
        {body}
      </div>
    </AdultPage>
  );
}
