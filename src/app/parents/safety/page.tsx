import type { Metadata } from "next";
import Link from "next/link";
import { ReadiMascot } from "@/components/brand/ReadiMascot";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import { SiteHeader } from "@/components/home/SiteHeader";
import { SiteFooter } from "@/components/home/sections";

export const metadata: Metadata = {
  title: "Family privacy & safety | Readli",
  description: "How family voices stay private and how parents choose which storytellers each child can hear.",
};

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
    policy: "voice-cloning-and-informed-consent",
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
              Family voices stay private until they&apos;re shared. And you decide which approved storytellers your child
              can listen to.
            </p>
          </div>
        </header>

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
