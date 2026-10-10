import type { Metadata } from "next";
import Link from "next/link";
import { AccountFields } from "@/components/accounts/AccountFields";
import { PlanList } from "@/components/accounts/PlanList";
import { buttonPrimary } from "@/components/brand/buttons";
import { AdultPage, Eyebrow, PreviewNote } from "@/components/invites/AdultPage";
import { EnvelopeArt } from "@/components/invites/illustrations";
import { ACCOUNT_TYPES } from "@/lib/accounts/accounts";

export const metadata: Metadata = { title: "Share Your Voice | Readli", robots: { index: false } };

const STEPS = [
  ["Create your free account", "Just you. Your voice belongs to you."],
  ["Verify it's you", "A quick identity check, so only you can make your voice."],
  ["Record with the teleprompter", "Read a short story out loud. We'll guide you."],
  ["Choose who can use it", "Approve each family that asks. Change your mind any time."],
] as const;

/** Readli Voice: free contributor signup. Invitation links land here directly. */
export default async function VoiceSignupPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const p = await searchParams;
  const invited = typeof p.invite === "string" && p.invite.length > 0;
  return (
    <AdultPage wide>
      <header className="flex flex-col gap-2">
        <Link href="/signup" className="w-fit font-display font-semibold underline-offset-4 hover:underline">
          ← Back
        </Link>
        <Eyebrow>Readli Voice · Free</Eyebrow>
        <h1 className="font-display text-4xl font-semibold sm:text-5xl">Share your voice</h1>
        <p className="max-w-2xl text-lg">Read to the kids you love, even from far away. It&apos;s free, and you decide who hears you.</p>
      </header>
      {invited && (
        <section data-testid="invited-banner" className="flex items-center gap-4 rounded-[var(--radius-panel)] bg-sky/50 p-5">
          <EnvelopeArt className="w-20 shrink-0" />
          <p>
            <span className="block font-display text-xl font-semibold">A family invited you to be a storyteller</span>
            Sign up free to accept. Accepting doesn&apos;t share your voice: you&apos;ll choose that after you record. Already have Readli?{" "}
            <Link href={`/login?next=${encodeURIComponent(`/voice?invite=${String(p.invite)}`)}`} className="font-semibold underline underline-offset-4">
              Log in to accept
            </Link>
            .
          </p>
        </section>
      )}
      <PreviewNote>Readli Voice accounts are coming soon, so nothing here is saved yet.</PreviewNote>

      <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
        <form action="/voice" className="flex flex-col gap-5 rounded-[var(--radius-panel)] bg-surface p-6 ring-2 ring-ink/10 sm:p-8" aria-label="Create a free Readli Voice account">
          <h2 className="font-display text-2xl font-semibold">Your free account</h2>
          <AccountFields namePlaceholder="Grandma June" />
          <label className="flex items-start gap-3">
            <input type="checkbox" name="own_voice" required className="mt-1 size-5 accent-coral-deep" />
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

        <div className="flex flex-col gap-6">
          <section aria-labelledby="how" className="flex flex-col gap-3 rounded-[var(--radius-panel)] bg-mint/50 p-6">
            <h2 id="how" className="font-display text-2xl font-semibold">
              How it works
            </h2>
            <ol className="flex flex-col gap-3">
              {STEPS.map(([t, d], i) => (
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
              <Link href="/signup/family" className="font-semibold underline underline-offset-4">
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
