import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/brand/Wordmark";
import { buttonPrimary } from "@/components/brand/buttons";
import { HeroBedtimeScene } from "@/components/home/HeroBedtimeScene";
import { SamplePlayer } from "@/components/home/SamplePlayer";
import { SiteFooter } from "@/components/home/sections";
import { FOUNDERS } from "@/lib/content/company";
import { publicPageMetadata } from "@/lib/seo/site";

export const metadata: Metadata = publicPageMetadata({
  title: "Read bedtime stories to your grandkids, in your own voice | Readli",
  description:
    "Record about a minute of your voice and Readli reads classic storybooks to your grandchildren in it, wherever they live. Free for grandparents, with no card or subscription.",
  path: "/grandparents",
});

const GRANDPA = "/family-voices/grandpa.webp";
const BIG_CTA = `${buttonPrimary} min-h-16 px-10 text-xl`;

const ICON = { fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const STEPS: { title: string; body: string; tint: string; icon: ReactNode }[] = [
  {
    title: "Record",
    body: "Read a short story aloud for about a minute, on your phone or computer. The words scroll for you.",
    tint: "bg-sunshine",
    icon: (
      <svg viewBox="0 0 24 24" className="size-8" {...ICON}>
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
      </svg>
    ),
  },
  {
    title: "Hear your voice",
    body: "A few moments later, a classic storybook plays, read in your voice. No account needed to try.",
    tint: "bg-mint",
    icon: (
      <svg viewBox="0 0 24 24" className="size-8" {...ICON}>
        <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
        <rect x="3" y="14" width="5" height="7" rx="2" />
        <rect x="16" y="14" width="5" height="7" rx="2" />
      </svg>
    ),
  },
  {
    title: "Share with your family",
    body: "Save your voice free and send your kids a link. They hear you straight away, then choose which grandkids listen.",
    tint: "bg-lavender",
    icon: (
      <svg viewBox="0 0 24 24" className="size-8" {...ICON}>
        <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
      </svg>
    ),
  },
];

const PRINCIPLES: { title: string; body: string; link: { href: string; label: string }; icon: ReactNode }[] = [
  {
    title: "Your voice belongs to you",
    body: "It stays private when you record it. Only you can share it, and only with the families you pick.",
    link: { href: "/help/voices-and-sharing/who-controls-my-voice", label: "Who controls my voice?" },
    icon: (
      <svg viewBox="0 0 24 24" className="size-7" {...ICON}>
        <rect x="5" y="11" width="14" height="10" rx="2.5" />
        <path d="M8 11V7.5a4 4 0 0 1 8 0V11" />
      </svg>
    ),
  },
  {
    title: "Parents decide who listens",
    body: "Your children choose which grandkids can hear you. A newly shared voice starts switched off for every child.",
    link: { href: "/parents/safety", label: "Family privacy & safety" },
    icon: (
      <svg viewBox="0 0 24 24" className="size-7" {...ICON}>
        <circle cx="9" cy="8" r="3.2" />
        <circle cx="17" cy="10" r="2.4" />
        <path d="M3.5 20a5.5 5.5 0 0 1 11 0M14 20a3.5 3.5 0 0 1 7 0" />
      </svg>
    ),
  },
  {
    title: "You stay in control",
    body: "Stop sharing with any family whenever you like, and ask us to delete your voice at any time.",
    link: { href: "/help/privacy-and-child-safety/data-deletion", label: "How deletion works" },
    icon: (
      <svg viewBox="0 0 24 24" className="size-7" {...ICON}>
        <path d="M12 3l7 3v5c0 4.6-3 8.4-7 10-4-1.6-7-5.4-7-10V6z" />
        <path d="M8.8 12.2l2.2 2.2 4.4-4.6" />
      </svg>
    ),
  },
];

const HOUSEHOLDS = [
  { name: "Sara's family", kids: "Maya and Leo", fill: "#ff7967" },
  { name: "Annabel's family", kids: "Ava", fill: "#ffce58" },
  { name: "Ben's family", kids: "Lily", fill: "#7bc7f3" },
];

function Check() {
  return (
    <svg viewBox="0 0 24 24" className="size-6 shrink-0 text-mint-deep" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="currentColor" opacity="0.16" />
      <path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The benefit in one picture: Grandpa's voice travelling across to a child at bedtime. */
function VoiceReachesChild() {
  return (
    <div
      role="img"
      aria-label="Grandpa's voice travelling to a parent and child in bed, listening to a bedtime story."
      className="relative mx-auto w-full max-w-md pt-10 pl-6 lg:max-w-none lg:pt-14 lg:pl-14"
    >
      <div className="overflow-hidden rounded-[28px] shadow-[0_24px_50px_-22px_rgba(40,53,72,0.45)]">
        <HeroBedtimeScene className="block h-[260px] w-full sm:h-[320px] lg:h-[440px]" />
      </div>
      {/* Grandpa, far from the bedroom, with his voice arcing in. */}
      <div className="absolute top-0 left-0 flex flex-col items-center gap-1.5">
        <Image src={GRANDPA} alt="" width={112} height={112} className="size-20 rounded-full border-4 border-surface shadow-lg lg:size-28" />
        <span className="rounded-full bg-surface px-3 py-1 font-display text-sm font-semibold shadow-md lg:text-base">Grandpa</span>
      </div>
      <svg viewBox="0 0 200 120" className="absolute top-8 left-16 w-32 text-sunshine lg:top-12 lg:left-32 lg:w-48" aria-hidden="true">
        <path d="M8 20 C70 0 150 20 188 100" fill="none" stroke="currentColor" strokeWidth="5" strokeDasharray="2 12" strokeLinecap="round" />
        <path d="M176 92 l12 10 l2 -16" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="absolute right-3 bottom-3 flex items-center gap-2 rounded-2xl bg-surface/95 px-3.5 py-2.5 shadow-lg lg:right-5 lg:bottom-5 lg:px-4 lg:py-3">
        <span className="flex items-end gap-0.5" aria-hidden="true">
          {[10, 18, 12, 22, 14].map((h, i) => (
            <span key={i} className="w-1.5 rounded-full bg-coral-deep" style={{ height: h }} />
          ))}
        </span>
        <span className="font-display text-base font-semibold lg:text-lg">Miles away, right at bedtime</span>
      </div>
    </div>
  );
}

/** One voice, many households: Grandpa in the middle, each family's home around him. */
function OneVoiceManyHomes() {
  return (
    <div role="img" aria-label="Grandpa's one voice shared with three separate families." className="relative mx-auto w-full max-w-md">
      <div className="flex flex-col items-center gap-2">
        <Image src={GRANDPA} alt="" width={112} height={112} className="size-24 rounded-full border-4 border-surface shadow-lg" />
        <span className="rounded-full bg-surface px-4 py-1.5 font-display text-lg font-semibold shadow-sm">One free voice</span>
      </div>
      <svg viewBox="0 0 300 60" className="mx-auto h-14 w-full max-w-sm text-ink/25" aria-hidden="true">
        <path d="M150 0 V20 M150 20 C150 40 50 30 50 60 M150 20 V60 M150 20 C150 40 250 30 250 60" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="3 7" strokeLinecap="round" />
      </svg>
      <ul className="grid grid-cols-3 gap-2.5 sm:gap-3">
        {HOUSEHOLDS.map((h) => (
          <li key={h.name} className="flex flex-col items-center gap-1.5 rounded-3xl bg-surface px-1.5 py-3 text-center shadow-sm sm:gap-2 sm:p-4">
            <svg viewBox="0 0 48 44" className="w-12" aria-hidden="true">
              <path d="M4 22 L24 4 L44 22" fill="none" stroke="#283548" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              <rect x="10" y="20" width="28" height="22" rx="3" fill={h.fill} stroke="#283548" strokeWidth="3" />
              <rect x="20" y="28" width="8" height="14" rx="1.5" fill="#283548" />
            </svg>
            <span className="font-display text-lg leading-tight font-semibold">{h.name}</span>
            <span className="text-base leading-snug text-ink/80">{h.kids}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Landing page for grandparents arriving from ads (Kevin, 2026-10-24; redesigned 2026-10-25). It
 * matches the ad and asks for one thing, the free demo. No site navigation, larger type than the rest
 * of the site and big tap targets for older eyes and hands. Retention promises stay out of this page:
 * the Help Center states them, so the page only links there.
 */
export default function GrandparentsPage() {
  const founder = FOUNDERS[0];
  return (
    <>
      <header className="border-b border-ink/10 bg-ivory">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Wordmark />
          <Link href="/try" className="hidden min-h-12 items-center font-display text-lg font-semibold underline underline-offset-4 sm:flex">
            Try your voice free
          </Link>
        </div>
      </header>
      <main className="flex flex-col text-lg">
        <section aria-labelledby="gp-heading" className="relative overflow-hidden bg-ivory">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-[40%] top-[35%] h-[70%] w-[140%] rounded-full bg-[radial-gradient(closest-side,#dcf3e5_0%,#e9f6ec_55%,rgba(255,249,237,0)_100%)] lg:-top-[10%] lg:-right-[12%] lg:h-[120%] lg:w-[62%]"
          />
          <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pt-10 pb-12 sm:px-6 lg:grid-cols-[1fr_1fr] lg:gap-12 lg:pt-16 lg:pb-20">
            <div className="flex flex-col gap-6 text-center lg:text-left">
              <p className="text-sm font-extrabold tracking-[0.16em] text-coral-deep uppercase">For grandparents</p>
              <h1 id="gp-heading" className="font-display text-[40px] leading-[1.08] font-semibold tracking-[-0.01em] sm:text-5xl lg:text-[58px]">
                Read bedtime stories to your grandkids,{" "}
                <span className="relative whitespace-nowrap">
                  in your own voice.
                  <svg viewBox="0 0 300 16" preserveAspectRatio="none" className="absolute -bottom-2.5 left-[-2%] h-4 w-[104%]" aria-hidden="true">
                    <path d="M4 11 C70 3 160 2 296 8" stroke="#9ce2bc" strokeWidth="7" fill="none" strokeLinecap="round" />
                  </svg>
                </span>
              </h1>
              <p className="mx-auto max-w-xl text-xl leading-relaxed text-ink/85 lg:mx-0">
                Record about a minute. Readli reads classic storybooks aloud in your voice, so they hear you at bedtime, wherever they
                live.
              </p>
              <div className="mx-auto flex w-full max-w-md flex-col gap-3 rounded-[28px] bg-surface p-4 text-left shadow-[0_24px_50px_-24px_rgba(40,53,72,0.45)] ring-1 ring-ink/5 sm:p-5 lg:mx-0">
                <div className="flex items-center gap-3">
                  <Image src="/covers/the-three-billy-goats-gruff.webp" alt="" width={60} height={80} className="h-auto w-[60px] rounded-l-[4px] rounded-r-[10px] shadow-[3px_4px_0_rgba(40,53,72,0.16)]" />
                  <div>
                    <p className="text-sm font-extrabold tracking-[0.1em] text-mint-deep uppercase">Hear a real Readli voice</p>
                    <p className="text-base leading-snug">Grandpa Kevin recorded one minute. Readli read the rest.</p>
                  </div>
                </div>
                <SamplePlayer title="The Three Billy Goats Gruff" large />
              </div>
              <div className="flex flex-col items-center gap-4 lg:items-start">
                <Link href="/try" className={`${BIG_CTA} w-full sm:w-auto`} data-testid="grandparents-cta">
                  Try Your Voice Free
                </Link>
                <ul className="flex flex-col gap-2 text-left text-lg font-semibold sm:flex-row sm:flex-wrap sm:gap-x-6">
                  {["Free for storytellers", "No card or subscription", "Nothing to install"].map((t) => (
                    <li key={t} className="flex items-center gap-2">
                      <Check />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <VoiceReachesChild />
          </div>
        </section>

        <section aria-labelledby="steps-heading" className="bg-surface px-4 py-10 sm:px-6 sm:py-14 lg:py-20">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:gap-10">
            <h2 id="steps-heading" className="text-center font-display text-4xl font-semibold sm:text-[44px]">
              Three simple steps
            </h2>
            <ol className="mx-auto grid max-w-md gap-5 md:max-w-none md:grid-cols-3 md:gap-10">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flex items-start gap-5 text-left md:flex-col md:items-center md:gap-4 md:text-center">
                  <span className={`relative grid size-16 shrink-0 place-items-center rounded-full md:size-24 ${s.tint}`}>
                    {s.icon}
                    <span className="absolute -top-1 -right-1 grid size-9 place-items-center rounded-full bg-ink font-display text-lg font-semibold text-white">
                      {i + 1}
                    </span>
                  </span>
                  <div className="flex flex-col gap-1 md:items-center md:gap-3">
                    <h3 className="font-display text-2xl font-semibold">{s.title}</h3>
                    <p className="max-w-xs text-lg leading-relaxed">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="text-center">
              <Link href="/help/getting-started/after-i-try-my-voice" className="font-semibold underline underline-offset-4">
                What your kids see when you share
              </Link>
            </p>
          </div>
        </section>

        <section aria-labelledby="many-heading" className="bg-mint/45 px-4 py-10 sm:px-6 sm:py-14 lg:py-20" data-testid="grandparents-households">
          <div className="mx-auto grid max-w-6xl items-center gap-7 sm:gap-10 lg:grid-cols-2 lg:gap-16">
            <div className="flex flex-col gap-5 text-center lg:text-left">
              <h2 id="many-heading" className="font-display text-4xl font-semibold sm:text-[44px]">
                One voice. Every family you love.
              </h2>
              <p className="text-xl leading-relaxed">
                Record once, and share with each of your children&apos;s households, even if they live in different states. Every
                family keeps its own library and its own choices.
              </p>
              <p className="text-xl leading-relaxed font-semibold">It&apos;s free for you, however many families you share with.</p>
            </div>
            <OneVoiceManyHomes />
          </div>
        </section>

        <section aria-labelledby="trust-heading" className="bg-lavender/35 px-4 py-10 sm:px-6 sm:py-14 lg:py-20" data-testid="grandparents-safety">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:gap-10">
            <h2 id="trust-heading" className="text-center font-display text-4xl font-semibold sm:text-[44px]">
              Your voice, your say
            </h2>
            <ul className="grid gap-4 md:grid-cols-3 md:gap-5">
              {PRINCIPLES.map((p) => (
                <li key={p.title} className="flex flex-col gap-2 rounded-[28px] bg-surface p-5 sm:gap-3 sm:p-7">
                  <div className="flex items-center gap-3 md:flex-col md:items-start">
                    <span className="grid size-12 shrink-0 place-items-center rounded-full bg-lavender/60 text-plum md:size-14">{p.icon}</span>
                    <h3 className="font-display text-2xl font-semibold">{p.title}</h3>
                  </div>
                  <p className="text-lg leading-relaxed">{p.body}</p>
                  <Link href={p.link.href} className="mt-auto inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
                    {p.link.label}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="text-center">
              Read our{" "}
              <Link href="/privacy" className="font-semibold underline underline-offset-4">
                Privacy Policy
              </Link>{" "}
              or visit the{" "}
              <Link href="/help/voices-and-sharing" className="font-semibold underline underline-offset-4">
                Help Center
              </Link>
              .
            </p>
          </div>
        </section>

        {founder && (
          <section aria-labelledby="founder-heading" className="bg-ivory px-4 py-10 sm:px-6 sm:py-14 lg:py-20" data-testid="grandparents-who">
            <div className="mx-auto grid max-w-5xl items-center gap-8 md:grid-cols-[minmax(0,320px)_1fr] md:gap-12">
              {founder.photo && (
                <Image
                  src={founder.photo}
                  alt={founder.photoAlt}
                  width={526}
                  height={525}
                  sizes="(min-width: 768px) 320px, 90vw"
                  className="mx-auto h-auto w-full max-w-[340px] rounded-[28px] border-4 border-surface shadow-[0_24px_50px_-22px_rgba(40,53,72,0.45)]"
                />
              )}
              <div className="flex flex-col gap-4">
                <h2 id="founder-heading" className="font-display text-4xl leading-tight font-semibold sm:text-[44px]">
                  Built for my kids. Made for every family.
                </h2>
                {/* Phones keep the opening line and link to the full story; tablets and desktop show it all. */}
                {founder.story.map((p, i) => (
                  <p key={p} className={`text-xl leading-relaxed ${i > 0 ? "hidden md:block" : ""}`}>
                    {p}
                  </p>
                ))}
                <p className="font-display text-xl font-semibold">
                  {founder.name}, <span className="font-normal text-muted">{founder.title}</span>
                </p>
                <Link href="/company#our-story" className="inline-flex min-h-12 w-fit items-center font-display text-xl font-semibold text-coral-deep underline underline-offset-4 md:hidden">
                  Read our story
                </Link>
              </div>
            </div>
          </section>
        )}

        <section aria-label="Try your voice" className="bg-sunshine/45 px-4 py-12 sm:px-6 lg:py-14">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 text-center">
            <p className="font-display text-4xl font-semibold sm:text-[44px]">Your voice, at their bedtime.</p>
            <Link href="/try" className={`${BIG_CTA} w-full sm:w-auto`} data-testid="grandparents-cta">
              Try Your Voice Free
            </Link>
            <p className="text-lg font-semibold">Takes about two minutes. No card or subscription.</p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
