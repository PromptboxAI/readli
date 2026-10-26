import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { AccountFields } from "@/components/accounts/AccountFields";
import { DemoRecordingCard } from "@/components/accounts/DemoRecordingCard";
import { buttonPrimary } from "@/components/brand/buttons";
import { AdultPage, Eyebrow, PreviewNote } from "@/components/invites/AdultPage";
import { signedInVoiceSignup, voiceRecordPath, voiceSignupBack } from "@/lib/accounts/voice-signup";
import { currentAdult } from "@/lib/auth/adult";
import { DEMO_BOOKS } from "@/lib/content/demo-books";
import { familyAccountsEnabled } from "@/lib/family/session";
import { serverConfig } from "@/lib/server/config";
import { currentGuest, guestDemoDeps } from "@/lib/server/guest-demo";
import { accountVoiceDeps } from "@/lib/voice/account-voices";
import { findGuestTake } from "@/lib/voice/guest-handoff";

export const metadata: Metadata = { title: "Save Your Voice | Readli", robots: { index: false } };

const BENEFITS = [
  ["Save your voice", "The story you just read becomes your Readli voice. No need to read it again."],
  ["Invite your family", "Send a link to the families you love. Their kids hear classic stories read by you."],
  ["Stay in control", "Your voice is private until you share it. Parents approve it for each child, and you can stop sharing any time."],
] as const;

const BENEFITS_NO_DEMO = [["Record once", "Read a short story out loud with our teleprompter. It takes about a minute."], ...BENEFITS.slice(1)] as const;

/**
 * Save My Voice Free: the free Readli Voice signup that follows the /try demo. It shows the recording
 * being saved, signs in on this page (Google or the emailed code), then goes on to keep that voice and
 * on to My Voice. Never Stripe, Family signup or a family dashboard. Without accounts, it previews.
 */
export default async function VoiceSignupPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const p = await searchParams;
  // Invitation links always go to the join page, which keeps the invitation through sign-in.
  if (typeof p.invite === "string" && p.invite) redirect(`/voice/join?invite=${encodeURIComponent(p.invite)}`);
  const accounts = familyAccountsEnabled();
  const fromTry = p.from === "try";
  const cleanUp = p.cleanup === "1";
  // The take this browser recorded on /try, kept for 24 hours, so the visitor sees what they're saving.
  const guestDeps = fromTry ? guestDemoDeps() : null;
  const take = guestDeps ? await currentGuest(guestDeps).then((g) => findGuestTake(guestDeps.store, g)).catch(() => null) : null;
  const from = { fromTry, cleanUp, takeKept: Boolean(take) };
  const record = voiceRecordPath(from);
  const user = accounts ? await currentAdult() : null;
  if (user) {
    const deps = accountVoiceDeps(serverConfig());
    const voice = deps ? await deps.store.findVoice(user.id).catch(() => null) : null;
    redirect(signedInVoiceSignup(from, Boolean(voice)));
  }
  const book = typeof p.book === "string" ? (DEMO_BOOKS.find((b) => b.slug === p.book) ?? null) : null;
  const benefits = fromTry && take ? BENEFITS : BENEFITS_NO_DEMO;
  return (
    <AdultPage wide>
      <header className="flex flex-col gap-2">
        <Link href={voiceSignupBack(from)} className="w-fit font-display font-semibold underline-offset-4 hover:underline">
          ← Back
        </Link>
        <Eyebrow>Readli Voice · Free</Eyebrow>
      </header>
      {!accounts && <PreviewNote>Readli Voice accounts are coming soon, so nothing here is saved yet.</PreviewNote>}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr] lg:gap-8">
        {accounts ? (
          <section className="flex flex-col gap-5 rounded-[var(--radius-panel)] bg-surface p-6 ring-2 ring-ink/10 sm:p-8" aria-labelledby="save-h">
            <h1 id="save-h" className="font-display text-3xl font-semibold sm:text-4xl">
              Save your voice for free
            </h1>
            <p className="text-lg">Keep the voice you just recorded and share it with the people you love. No card or subscription required.</p>
            {fromTry && <DemoRecordingCard take={take} book={book} />}
            <LoginForm next={record} askMarketing signup="Readli Voice" />
          </section>
        ) : (
          <form action={record} className="flex flex-col gap-5 rounded-[var(--radius-panel)] bg-surface p-6 ring-2 ring-ink/10 sm:p-8" aria-labelledby="save-h">
            <h1 id="save-h" className="font-display text-3xl font-semibold sm:text-4xl">
              Save your voice for free
            </h1>
            <p className="text-lg">Keep the voice you just recorded and share it with the people you love. No card or subscription required.</p>
            {fromTry && <DemoRecordingCard take={take} book={book} />}
            <AccountFields namePlaceholder="Grandma June" />
            <label className="flex items-start gap-3">
              <input type="checkbox" required className="mt-1 size-5 accent-coral-deep" />
              <span>I&apos;ll only record my own voice, and I control who can use it.</span>
            </label>
            <button type="submit" className={`${buttonPrimary} w-full`}>
              Create my free account
            </button>
          </form>
        )}

        <section aria-labelledby="why" className="flex flex-col gap-4 self-start rounded-[var(--radius-panel)] bg-mint/40 p-6 sm:p-8">
          <h2 id="why" className="font-display text-2xl font-semibold">
            Free for storytellers
          </h2>
          <ul className="flex flex-col gap-4">
            {benefits.map(([t, d]) => (
              <li key={t} className="flex gap-3">
                <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-surface font-bold text-mint-deep">
                  ✓
                </span>
                <span>
                  <span className="block font-display text-lg font-semibold">{t}</span>
                  {d}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </AdultPage>
  );
}
