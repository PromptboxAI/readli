import type { Metadata } from "next";
import Link from "next/link";
import { ReadiMascot } from "@/components/brand/ReadiMascot";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import { SiteHeader } from "@/components/home/SiteHeader";
import { SiteFooter } from "@/components/home/sections";
import { publicPageMetadata } from "@/lib/seo/site";

export const metadata: Metadata = publicPageMetadata({
  title: "Family privacy & safety | Readli",
  description: "Who makes a family voice, how it is stored, how it is deleted, and how parents choose which storytellers each child can hear.",
  path: "/parents/safety",
});

/**
 * "Your voice, your control" (Kevin, 2026-11-13). Each line is something the code does today:
 * ElevenLabs is the only voice provider (lib/voice/elevenlabs.ts), no Readli code trains on voices
 * (and Kevin confirmed on 2026-11-13 that ElevenLabs' data-for-training setting is off for Readli),
 * storage buckets are private (supabase/migrations/20261010000100_storage.sql), provider voice ids
 * are AES-256-GCM encrypted (lib/server/provider-ref.ts), account deletion removes the ElevenLabs
 * voice, recordings and narration (lib/account/privacy.ts), and demos are deleted within 24 hours
 * by the hourly guest-cleanup job. Change a line here only together with the behaviour behind it.
 */
const VOICE_PROMISES = [
  {
    title: "Made by ElevenLabs, for your family only",
    body: "When you record, Readli sends the recording to ElevenLabs, the voice company that turns it into a private digital voice. It reads stories only for families you choose to share it with, and only for children their parents approve. It is never made public.",
    policy: "voice-recording-and-consent",
  },
  {
    title: "Never used to train AI",
    body: "Readli never uses your recordings or your voice to train AI, and we've switched off the ElevenLabs setting that would let it use our customers' audio to improve its own models. We never sell or license your voice to anyone.",
    policy: "how-we-use-information",
  },
  {
    title: "Kept private",
    body: "Your recordings and the stories read in your voice are kept in private storage with no public web links, and travel over encrypted connections. Readli also encrypts the reference to your voice at ElevenLabs, so it is never stored in plain text.",
    policy: "security-and-international-processing",
  },
  {
    title: "Deleted when you say so",
    body: "Delete your account in Account settings and Readli deletes, straight away, your voice at ElevenLabs, every recording you made, and every story read in your voice in every family. To delete just your voice and keep your account, email admin@readli.ai and we'll do it within 48 hours of confirming it's you.",
    policy: "retention-and-deletion",
  },
  {
    title: "Trying it leaves nothing behind",
    body: "A recording made on the Try page, and the voice made from it, are deleted within 24 hours unless you make an account and choose to keep it.",
    policy: "voice-demo",
  },
];

/** Plain-language summary of the Privacy Policy's family and child sections (§3, §5, §6). The policy is the source of truth. */
const TOPICS = [
  {
    title: "Voices are private by default",
    body: "Joining a family circle or recording a voice does not let anyone else use it. Private family voices are never made public or offered for discovery.",
    tint: "bg-coral/30",
    policy: "family-visibility-invitations-and-sharing",
  },
  {
    title: "Two approvals before a child hears a voice",
    body: "The voice owner chooses who may use their voice, and then a parent or guardian approves that voice for each child. Every newly shared voice starts switched off for every child.",
    tint: "bg-mint",
    policy: "family-visibility-invitations-and-sharing",
  },
  {
    title: "Parents stay in charge",
    body: "Kids listen inside a profile a parent or guardian manages. A child can't change which storytellers are approved.",
    tint: "bg-sky/70",
    policy: "childrens-privacy-and-parental-control",
  },
  {
    title: "Change your mind any time",
    body: "The voice owner and the parent can each withdraw their approval. Removing either one takes the voice off the child's list of storytellers.",
    tint: "bg-sunshine",
    policy: "family-visibility-invitations-and-sharing",
  },
  {
    title: "Only your own voice",
    body: "Voice cloning is optional, and people can only record their own voice. An invitation never lets anyone upload or clone someone else's.",
    tint: "bg-lavender/70",
    policy: "voice-recording-and-consent",
  },
];

export default function ParentsSafetyPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex max-w-4xl flex-col gap-10 px-4 py-14 sm:px-6">
        <header className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-8">
          <ReadiMascot size={120} decorative className="shrink-0" />
          <div className="flex flex-col gap-3">
            <p className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-coral-deep">For parents</p>
            <h1 className="font-display text-4xl font-semibold leading-[1.05] sm:text-5xl">Family privacy &amp; safety</h1>
            <p className="max-w-2xl text-lg">
              Your voice stays yours: who makes it, where it&apos;s kept and how to delete it. And you decide which approved
              storytellers your child can listen to.
            </p>
          </div>
        </header>

        <section aria-labelledby="your-voice-heading" className="flex flex-col gap-4 rounded-[var(--radius-panel)] bg-surface p-6 ring-2 ring-ink/10 sm:p-8">
          <div className="flex flex-col gap-2">
            <h2 id="your-voice-heading" className="font-display text-3xl font-semibold">
              Your voice, your control
            </h2>
            <p className="text-lg">A voice is personal. Here is exactly what happens to yours.</p>
          </div>
          <ul className="flex flex-col gap-4">
            {VOICE_PROMISES.map((p) => (
              <li key={p.title} className="flex flex-col gap-1">
                <h3 className="font-display text-xl font-semibold">{p.title}</h3>
                <p>
                  {p.body}{" "}
                  <Link href={`/privacy#${p.policy}`} className="text-sm font-semibold underline underline-offset-4">
                    Read the policy
                  </Link>
                </p>
              </li>
            ))}
          </ul>
        </section>

        <ul className="grid gap-4 sm:grid-cols-2">
          {TOPICS.map((t) => (
            <li key={t.title} className={`flex flex-col gap-2 rounded-[var(--radius-panel)] p-6 ${t.tint}`}>
              <h2 className="font-display text-xl font-semibold">{t.title}</h2>
              <p>{t.body}</p>
              <Link href={`/privacy#${t.policy}`} className="mt-auto pt-1 text-sm font-semibold underline underline-offset-4">
                Read the policy
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap gap-3">
          <Link href="/privacy" className={buttonPrimary}>
            Read the full Privacy Policy
          </Link>
          <Link href="/#family-privacy" className={buttonSecondary}>
            Back to the homepage
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
