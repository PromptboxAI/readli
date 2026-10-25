import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { AccountFields } from "@/components/accounts/AccountFields";
import { PlanList } from "@/components/accounts/PlanList";
import { buttonPrimary } from "@/components/brand/buttons";
import { AdultPage, Eyebrow, PreviewNote } from "@/components/invites/AdultPage";
import { ACCOUNT_TYPES } from "@/lib/accounts/accounts";
import { currentAdult } from "@/lib/auth/adult";
import { familyAccountsEnabled } from "@/lib/family/session";

export const metadata: Metadata = { title: "Share Your Voice | Readli", robots: { index: false } };

const STEPS_FROM_TRY = [
  ["Create your free account", "Just you. Your voice belongs to you."],
  ["Verify it's you", "A quick identity check, so only you can make your voice."],
  ["Use your Try recording", "No need to read again. We make your voice from the story you just read."],
  ["Invite your family", "Approve each family that asks. Change your mind any time."],
] as const;

const STEPS = [
  ["Create your free account", "Just you. Your voice belongs to you."],
  ["Verify it's you", "A quick identity check, so only you can make your voice."],
  ["Record with the teleprompter", "Read a short story out loud. We'll guide you."],
  ["Choose who can use it", "Approve each family that asks. Change your mind any time."],
] as const;

/** Readli Voice: free contributor signup. With accounts on, it signs in for real; otherwise it previews. */
export default async function VoiceSignupPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const p = await searchParams;
  // Invitation links always go to the join page, which keeps the invitation through sign-in.
  if (typeof p.invite === "string" && p.invite) redirect(`/voice/join?invite=${encodeURIComponent(p.invite)}`);
  const accounts = familyAccountsEnabled();
  // From /try: the voice is made from the take already recorded there, then straight on to inviting family.
  const fromTry = p.from === "try";
  const record = fromTry ? `/voice/record?from=try&next=${encodeURIComponent("/voice/invite")}${p.cleanup === "1" ? "&cleanup=1" : ""}` : "/voice/record";
  if (fromTry && accounts && (await currentAdult())) redirect(record);
  return (
    <AdultPage wide>
      <header className="flex flex-col gap-2">
        <Link href={fromTry ? `/try?resume=1${p.cleanup === "1" ? "&cleanup=1" : ""}` : "/signup"} className="w-fit font-display font-semibold underline-offset-4 hover:underline">
          ← Back
        </Link>
        <Eyebrow>Readli Voice · Free</Eyebrow>
        <h1 className="font-display text-4xl font-semibold sm:text-5xl">Share your voice</h1>
        <p className="max-w-2xl text-lg">Read to the kids you love, even from far away. It&apos;s free, and you decide who hears you.</p>
        {fromTry && (
          <p className="max-w-2xl rounded-2xl bg-mint/50 p-4" data-testid="try-carry-note">
            Your recording from the Try page comes with you, so you won&apos;t read the story again. Sign in within 24 hours to keep it.
          </p>
        )}
      </header>
      {!accounts && <PreviewNote>Readli Voice accounts are coming soon, so nothing here is saved yet.</PreviewNote>}

      <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
        {accounts ? (
          <section className="flex flex-col gap-5 rounded-[var(--radius-panel)] bg-surface p-6 ring-2 ring-ink/10 sm:p-8" aria-label="Create a free Readli Voice account">
            <h2 className="font-display text-2xl font-semibold">Your free account</h2>
            <p>Sign in with your email or Google. New here? This creates your free Readli Voice account. No card, no subscription.</p>
            <LoginForm next={record} askMarketing signup="Readli Voice" />
          </section>
        ) : (
          <form action={record} className="flex flex-col gap-5 rounded-[var(--radius-panel)] bg-surface p-6 ring-2 ring-ink/10 sm:p-8" aria-label="Create a free Readli Voice account">
            <h2 className="font-display text-2xl font-semibold">Your free account</h2>
            <AccountFields namePlaceholder="Grandma June" />
            <label className="flex items-start gap-3">
              <input type="checkbox" required className="mt-1 size-5 accent-coral-deep" />
              <span>I&apos;ll only record my own voice, and I control who can use it.</span>
            </label>
            <button type="submit" className={`${buttonPrimary} w-full`}>
              Create my free account
            </button>
            <p className="text-sm text-muted">
              Recording together? Grandma and Grandpa each sign up and verify on their own, then join the same free household. Each of
              you controls your own voice.
            </p>
          </form>
        )}

        <div className="flex flex-col gap-6">
          <section aria-labelledby="how" className="flex flex-col gap-3 rounded-[var(--radius-panel)] bg-mint/50 p-6">
            <h2 id="how" className="font-display text-2xl font-semibold">
              How it works
            </h2>
            <ol className="flex flex-col gap-3">
              {(fromTry ? STEPS_FROM_TRY : STEPS).map(([t, d], i) => (
                <li key={t} className="flex gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface font-display font-semibold">{i + 1}</span>
                  <span>
                    <span className="block font-display font-semibold">{t}</span>
                    {d}
                  </span>
                </li>
              ))}
            </ol>
          </section>
          <section aria-labelledby="not" className="rounded-[var(--radius-panel)] bg-surface p-6 ring-2 ring-ink/10">
            <h2 id="not" className="font-display text-xl font-semibold">
              Readli Voice doesn&apos;t include
            </h2>
            <PlanList items={ACCOUNT_TYPES.voice.excludes} cross className="mt-3" />
            <p className="mt-3 text-sm">
              Want stories for your own kids? You can start{" "}
              <Link href={fromTry ? `/signup/family?from=try${p.cleanup === "1" ? "&cleanup=1" : ""}` : "/signup/family"} className="font-semibold underline underline-offset-4">
                Readli Family
              </Link>{" "}
              any time and keep your voice.
            </p>
          </section>
        </div>
      </div>
    </AdultPage>
  );
}
