import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Wordmark } from "@/components/brand/Wordmark";
import { buttonPrimary } from "@/components/brand/buttons";
import { SamplePlayer } from "@/components/home/SamplePlayer";
import { SiteFooter } from "@/components/home/sections";
import { COMPANY, COMPANY_ADDRESS, FOUNDERS } from "@/lib/content/company";
import { publicPageMetadata } from "@/lib/seo/site";

export const metadata: Metadata = publicPageMetadata({
  title: "Read bedtime stories to your grandkids, in your own voice | Readli",
  description:
    "Record about a minute of your voice and Readli reads classic storybooks to your grandchildren in it, wherever they live. Always free for grandparents.",
  path: "/grandparents",
});

const STEPS = [
  { title: "Read a short story aloud", body: "About a minute, on your phone or computer. The words scroll for you, at your pace." },
  { title: "Hear yourself read a classic", body: "A few moments later, a real storybook plays in your voice. No account needed to try." },
  { title: "Share it with your family", body: "Save your voice for free and send your children a link. They choose which grandkids hear you." },
];

const AFTER = [
  { title: "Keep your voice", body: "Make a free Readli Voice account within 24 hours. Your recording comes with you, so you don't read again." },
  { title: "Pick the page they hear first", body: "Choose a short passage from a storybook, listen to it in your voice, and approve it." },
  { title: "Invite your kids by email", body: "Type their email addresses and Readli sends each of them a link from you." },
  { title: "They hear you, no account needed", body: "The link plays your passage straight away on their phone or computer." },
  { title: "They choose which grandkids hear you", body: "Your children add your voice to their Readli Family, or start one free, then pick which children can listen." },
];

const SAFETY = [
  { title: "Your voice is yours", body: "It stays private when you record it. Only you decide which families can use it." },
  { title: "Parents decide too", body: "Even after you share, your children choose which grandkids hear you." },
  { title: "It only reads storybooks", body: "Your voice reads the books in the Readli library and nothing else. Nobody can type in words for it to say." },
  { title: "Stop any time", body: "Stop sharing with a family and your voice is gone from their account straight away." },
  { title: "Deleted on request", body: `Email ${COMPANY.email} and we delete your voice within 48 hours of confirming it's you.` },
  { title: "Just trying it?", body: "Your demo recording is deleted within 24 hours unless you choose to save it." },
];

function Cta({ className = "" }: { className?: string }) {
  return (
    <Link href="/try" className={`${buttonPrimary} min-h-14 px-10 text-xl ${className}`} data-testid="grandparents-cta">
      Try Your Voice Free
    </Link>
  );
}

function Numbered({ items, tint }: { items: { title: string; body: string }[]; tint: string }) {
  return (
    <ol className="flex flex-col gap-4">
      {items.map((s, i) => (
        <li key={s.title} className="flex items-start gap-4 rounded-3xl bg-surface p-5 ring-1 ring-ink/10">
          <span aria-hidden="true" className={`grid size-11 shrink-0 place-items-center rounded-full font-display text-xl font-semibold ${tint}`}>
            {i + 1}
          </span>
          <div>
            <h3 className="font-display text-xl font-semibold">{s.title}</h3>
            <p className="text-lg">{s.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/**
 * Landing page for grandparents arriving from ads (Kevin, 2026-10-24): it matches the ad and asks for
 * one thing. Hear the sample, three steps, "you never pay", what happens after the sample, voice safety
 * in plain words, and who makes Readli. No site navigation, so the only way forward is the demo.
 * Type sizes run a step larger than the rest of the site for older eyes.
 */
export default function GrandparentsPage() {
  const founder = FOUNDERS[0];
  return (
    <>
      <header className="border-b border-ink/10 bg-ivory">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Wordmark />
          <Link href="/try" className="hidden font-display text-lg font-semibold underline underline-offset-4 sm:inline">
            Try your voice free
          </Link>
        </div>
      </header>
      <main className="flex flex-col">
        <section aria-labelledby="gp-heading" className="bg-sunshine/35 px-4 py-10 sm:px-6 sm:py-16">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 text-center">
            <p className="font-display text-lg font-semibold text-coral-deep">For grandparents</p>
            <h1 id="gp-heading" className="font-display text-4xl leading-tight font-semibold sm:text-6xl">
              Read bedtime stories to your grandkids, in your own voice.
            </h1>
            <p className="max-w-2xl text-xl">
              Record about a minute. Readli reads classic storybooks aloud in your voice, so they can hear you at bedtime, even from
              miles away.
            </p>
            <div className="w-full max-w-md text-left">
              <p className="mb-2 text-center font-semibold">Hear Grandpa Kevin, made from one short recording:</p>
              <SamplePlayer title="The Three Billy Goats Gruff" large />
            </div>
            <Cta className="w-full sm:w-auto" />
            <p className="font-semibold text-muted">Free. No card. Nothing to install.</p>
          </div>
        </section>

        <section aria-labelledby="steps-heading" className="px-4 py-12 sm:px-6">
          <div className="mx-auto flex max-w-3xl flex-col gap-6">
            <h2 id="steps-heading" className="text-center font-display text-3xl font-semibold sm:text-4xl">
              Three simple steps
            </h2>
            <Numbered items={STEPS} tint="bg-sunshine" />
          </div>
        </section>

        <section aria-labelledby="free-heading" className="bg-mint/45 px-4 py-12 sm:px-6" data-testid="grandparents-free">
          <div className="mx-auto flex max-w-3xl flex-col gap-4 text-center">
            <h2 id="free-heading" className="font-display text-3xl font-semibold sm:text-4xl">
              You never pay
            </h2>
            <p className="text-xl">
              Recording and sharing your voice is free, always. No card, no trial, no subscription for you. Your children&apos;s family has
              the Readli Family plan, and they can try it free first.
            </p>
            <p className="text-lg">
              Want to treat them?{" "}
              <Link href="/pricing#gift-heading" className="font-semibold underline underline-offset-4">
                You can give Readli Family as a gift
              </Link>
              .
            </p>
          </div>
        </section>

        <section aria-labelledby="after-heading" className="px-4 py-12 sm:px-6" data-testid="grandparents-after">
          <div className="mx-auto flex max-w-3xl flex-col gap-6">
            <div className="flex flex-col gap-2 text-center">
              <h2 id="after-heading" className="font-display text-3xl font-semibold sm:text-4xl">
                What happens after you try
              </h2>
              <p className="text-lg">Here&apos;s exactly what you do, and what your kids see.</p>
            </div>
            <Numbered items={AFTER} tint="bg-sky" />
            <p className="text-center text-lg">You can stop sharing with any family at any time.</p>
          </div>
        </section>

        <section aria-labelledby="safety-heading" className="bg-lavender/40 px-4 py-12 sm:px-6" data-testid="grandparents-safety">
          <div className="mx-auto flex max-w-4xl flex-col gap-6">
            <h2 id="safety-heading" className="text-center font-display text-3xl font-semibold sm:text-4xl">
              Your voice is safe with us
            </h2>
            <ul className="grid gap-4 sm:grid-cols-2">
              {SAFETY.map((s) => (
                <li key={s.title} className="flex flex-col gap-1 rounded-3xl bg-surface p-5">
                  <h3 className="font-display text-xl font-semibold">{s.title}</h3>
                  <p className="text-lg">{s.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="who-heading" className="px-4 py-12 sm:px-6" data-testid="grandparents-who">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 text-center">
            <h2 id="who-heading" className="font-display text-3xl font-semibold sm:text-4xl">
              Who makes Readli
            </h2>
            {founder?.photo && (
              <Image src={founder.photo} alt={founder.photoAlt} width={200} height={200} className="size-44 rounded-3xl border-[3px] border-ink object-cover" />
            )}
            {founder && (
              <p className="text-lg">
                {founder.story[0]} <span className="font-semibold">{founder.name}, {founder.title}</span>
              </p>
            )}
            <p className="text-lg">
              Readli is made by {COMPANY.legalName}, {COMPANY_ADDRESS}. Questions? Email{" "}
              <a href={`mailto:${COMPANY.email}`} className="font-semibold underline underline-offset-4">
                {COMPANY.email}
              </a>{" "}
              and a real person will answer.
            </p>
            <Link href="/company" className="font-semibold underline underline-offset-4">
              More about us
            </Link>
          </div>
        </section>

        <section aria-label="Try your voice" className="bg-sunshine/35 px-4 py-12 text-center sm:px-6">
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-4">
            <p className="font-display text-3xl font-semibold">Hear your voice tell a story.</p>
            <Cta className="w-full sm:w-auto" />
            <p className="font-semibold text-muted">Takes about two minutes. Free.</p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
