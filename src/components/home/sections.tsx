import Image from "next/image";
import Link from "next/link";
import { DemoBookShelf } from "@/components/books/DemoBookShelf";
import { SocialIcon } from "@/components/brand/SocialIcon";
import { FamilyTree } from "@/components/home/FamilyTree";
import { FamilyOfStorytellers, HearLovedOnes, MakeStorytimeYourOwn } from "@/components/home/StoryIllustrations";
import { ReadiMascot } from "@/components/brand/ReadiMascot";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import { SOCIAL_ACCOUNTS } from "@/lib/content/social";
import { NEW_BOOKS } from "@/lib/library/catalog";

function Cloud({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 120 50" className={className} aria-hidden="true">
      <path d="M20 45 C5 45 5 25 22 26 C22 10 45 6 52 20 C60 6 88 8 86 26 C104 22 112 45 96 45 Z" fill="#FFFEF9" />
    </svg>
  );
}

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-sky/60">
      <Cloud className="animate-drift absolute left-[6%] top-8 w-32 opacity-90" />
      <Cloud className="animate-drift absolute right-[8%] top-3 w-44 opacity-80 [animation-delay:-6s] md:top-24" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-8 px-4 pb-12 pt-28 sm:px-6 md:grid-cols-[1.1fr_1fr] md:py-20">
        {/* Phones: extra top padding keeps the eyebrow clear of the clouds. */}
        <div className="flex flex-col gap-5">
          <p className="font-display text-lg font-semibold text-coral-deep">Every Book. Every Voice.</p>
          <h1 className="font-display text-4xl font-semibold leading-[1.05] sm:text-5xl lg:text-6xl">
            Their favorite stories. Read by their favorite people.
          </h1>
          <p className="max-w-xl text-lg">
            Record a minute of your voice, and hear a classic storybook read the way only you can. Then invite the people
            you love to become part of your family&apos;s storytelling library.
          </p>
          {/* CTA sits above the illustration on mobile so it can't be missed. */}
          <div className="flex flex-wrap gap-3">
            <Link href="/try" className={buttonPrimary}>
              Hear a story in your voice, free
            </Link>
            <Link href="/#stories" className={buttonSecondary}>
              Browse storybooks
            </Link>
          </div>
        </div>
        {/* Phones: the art is 25% smaller (Kevin, 2026-10-11). */}
        <div className="relative mx-auto flex aspect-square w-full max-w-[18rem] items-center justify-center md:max-w-sm" aria-hidden="true">
          <div className="absolute inset-6 rounded-[40%_60%_55%_45%] bg-mint" />
          <div className="absolute bottom-8 left-3 size-16 rounded-3xl bg-sunshine md:bottom-10 md:left-4 md:size-20" />
          <div className="absolute right-5 top-6 size-12 rounded-full bg-lavender md:right-6 md:top-8 md:size-16" />
          <div className="animate-bob relative">
            <ReadiMascot size={280} priority className="h-auto w-[210px] md:w-[280px]" />
          </div>
        </div>
      </div>
      <svg viewBox="0 0 1440 60" className="block w-full text-ivory" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 40 C240 0 480 60 720 30 C960 0 1200 50 1440 20 L1440 60 L0 60 Z" fill="currentColor" />
      </svg>
    </section>
  );
}

const DEMO_STEPS = [
  "Tick two boxes to confirm it's your voice.",
  "Read one short story script as it scrolls, about 1 to 2 minutes.",
  "Pick a classic and hear it in your voice.",
];

export function TryYourVoice() {
  return (
    <section id="try-your-voice" aria-labelledby="try-heading" className="scroll-mt-20 bg-ivory">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 md:gap-10 md:py-16">
        <div className="grid items-center gap-8 rounded-[var(--radius-panel)] bg-surface p-6 sm:p-10 lg:grid-cols-[1fr_1.1fr]">
          <div className="flex flex-col gap-4 text-center lg:text-left">
            {/* Phones and tablets get Kevin's short pitch, centred; desktop keeps the steps beside the studio preview. */}
            <h2 id="try-heading" className="font-display text-3xl font-semibold sm:text-4xl">
              <span className="lg:hidden">Hear your voice tell a story.</span>
              <span className="hidden lg:inline">Try your voice. No signup.</span>
            </h2>
            <p className="text-lg lg:hidden">Read a short passage, then hear your voice bring a story to life.</p>
            <ol className="hidden flex-col gap-3 lg:flex">
              {DEMO_STEPS.map((step, i) => (
                <li key={step} className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-coral font-display font-semibold">
                    {i + 1}
                  </span>
                  <span className="pt-1">{step}</span>
                </li>
              ))}
            </ol>
            <div className="flex flex-col gap-2">
              <Link href="/try" className={`${buttonPrimary} w-full sm:w-auto sm:self-center lg:self-start`}>
                <span className="lg:hidden">Try Your Voice Free</span>
                <span className="hidden lg:inline">Start recording</span>
              </Link>
              <p className="text-sm font-semibold text-muted lg:hidden">No signup required</p>
            </div>
            <p className="hidden text-sm text-muted lg:block">
              Your recording stays private and is deleted within 24 hours unless you choose to save it.
            </p>
          </div>
          <VoiceStudioPreview />
        </div>
        <DemoBookShelf />
      </div>
    </section>
  );
}

/**
 * Picture of the real recording screen on /try (teleprompter, mic level, progress), drawn with the
 * same styles. Desktop only: `hidden` removes it on smaller screens so it takes no space there.
 */
function VoiceStudioPreview() {
  return (
    <div aria-hidden="true" data-testid="voice-studio-preview" className="hidden rounded-[2rem] bg-ivory p-4 lg:block">
      <div className="grid grid-cols-[minmax(0,1fr)_12rem] gap-3">
        <div className="relative h-72 overflow-hidden rounded-3xl bg-surface px-5 py-4 text-lg font-semibold leading-relaxed">
          <p className="text-ink/45">Once upon a time, in a little house at the edge of a sleepy town,</p>
          <p className="my-1">
            <span className="rounded-md bg-sunshine/45 text-ink">there lived a family who loved stories more than anything.</span>
          </p>
          <p className="text-ink/45">Every night, just after the moon peeked over the rooftops, someone would pick up a book...</p>
          <span className="absolute left-0 top-[38%] h-0 w-0 border-y-[10px] border-l-[14px] border-y-transparent border-l-coral-deep" />
          <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-surface" />
        </div>
        <div className="flex flex-col gap-3 rounded-3xl bg-surface p-4">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 font-display font-semibold">
              <span className="size-3 animate-pulse rounded-full bg-coral-deep" />
              Recording
            </span>
            <span className="font-display text-xl tabular-nums">0:48</span>
          </div>
          <div className="flex flex-col gap-1">
            <div className="relative h-3 overflow-hidden rounded-full bg-ivory">
              <div className="h-full w-2/5 rounded-full bg-mint" />
              <div className="absolute inset-y-0 left-1/2 w-0.5 bg-ink/40" />
            </div>
            <div className="flex justify-between text-xs text-muted">
              <span>0:00</span>
              <span>2:00</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-coral-deep" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
            </svg>
            <div className="flex h-4 flex-1 items-end gap-0.5">
              {[40, 70, 55, 90, 65, 80, 45, 60, 30, 20, 15, 10].map((h, i) => (
                <span key={i} className={`flex-1 rounded-sm ${i < 8 ? "bg-mint-deep" : "bg-ink/15"}`} style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>
          <div className="mt-auto grid grid-cols-2 gap-2">
            <span className="flex min-h-10 items-center justify-center rounded-full border-[3px] border-ink font-display font-semibold">Pause</span>
            <span className="flex min-h-10 items-center justify-center rounded-full bg-coral-deep font-display font-semibold text-white shadow-[0_3px_0_#8f2a1e]">
              Finish
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Both colour classes are spelled out so Tailwind generates them: the dot on phones, the card from sm up.
const FAMILY_STEPS = [
  { title: "Create", body: "Start your family circle and add the people you'd love to hear.", dot: "bg-coral/70", card: "sm:bg-coral/70" },
  { title: "Invite", body: "Invite family members and loved ones to join Readli.", dot: "bg-sunshine", card: "sm:bg-sunshine" },
  { title: "Record", body: "Each person records and approves their own voice, choosing who can use it.", dot: "bg-mint", card: "sm:bg-mint" },
  { title: "Listen", body: "Choose a book and storyteller. Switch voices anytime without losing your place.", dot: "bg-sky", card: "sm:bg-sky" },
];

export function HowFamiliesWork() {
  return (
    <section id="how-it-works" aria-labelledby="how-heading" className="scroll-mt-20 bg-lavender/40">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-10 sm:gap-8 sm:px-6 sm:py-14">
        <h2 id="how-heading" className="font-display text-3xl font-semibold sm:text-4xl">
          How Readli Family Works
        </h2>
        {/* Phones: a short numbered list. From sm up: coloured step cards. */}
        <ol className="flex flex-col gap-4 sm:grid sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
          {FAMILY_STEPS.map((step, i) => (
            <li key={step.title} className={`flex items-start gap-3 sm:flex-col sm:gap-2 sm:rounded-[var(--radius-panel)] sm:p-6 ${step.card}`}>
              <span
                className={`flex size-8 shrink-0 items-center justify-center rounded-full font-display font-semibold sm:hidden ${step.dot}`}
                aria-hidden="true"
              >
                {i + 1}
              </span>
              <span className="hidden font-display text-sm font-semibold sm:block">Step {i + 1}</span>
              <div className="flex flex-col sm:gap-2">
                <h3 className="font-display text-lg font-semibold sm:text-2xl">{step.title}</h3>
                <p className="text-sm sm:text-base">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="text-sm">
          Every voice belongs to the person who recorded it. Only they can share it, and they can take it back any time.
        </p>
      </div>
    </section>
  );
}

const WAYS = [
  {
    title: "Hear the people you love",
    body: "From parents and grandparents to aunts, uncles, and family friends. Their voices make every story special.",
    bg: "bg-sunshine",
    Art: HearLovedOnes,
  },
  {
    title: "Bring your family together",
    body: "Invite loved ones to record their voices and create your own family of storytellers. Near or far, everyone's just a story away.",
    bg: "bg-mint",
    Art: FamilyOfStorytellers,
  },
  {
    title: "Make storytime your own",
    body: "Follow along as the words come to life. Switch storytellers anytime without losing your place.",
    bg: "bg-sky",
    Art: MakeStorytimeYourOwn,
  },
];

export function ThreeWaysToListen() {
  return (
    <section aria-labelledby="ways-heading" className="bg-ivory">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-14 sm:px-6">
        <h2 id="ways-heading" className="max-w-3xl font-display text-3xl font-semibold sm:text-4xl">
          Every family has a story. Every voice makes it special.
        </h2>
        <ul className="grid gap-6 md:grid-cols-3">
          {WAYS.map(({ title, body, bg, Art }, i) => (
            <li key={title} className="group flex flex-col gap-3">
              <div
                className={`aspect-[4/3] overflow-hidden rounded-[var(--radius-panel)] transition-transform group-hover:-translate-y-1 motion-reduce:transform-none ${bg} ${["md:-rotate-1", "md:rotate-1", "md:-rotate-1"][i]}`}
              >
                <Art />
              </div>
              <h3 className="mt-2 font-display text-xl font-semibold">{title}</h3>
              <p>{body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Introduces the full public library at /books (Kevin, 2026-10-11). The mint band is an intentional break between sections. */
export function KidsShelf() {
  return (
    <section id="stories" aria-labelledby="shelf-heading" className="scroll-mt-20 bg-mint/40">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-12 sm:px-6 sm:py-14">
        <div className="flex flex-col gap-2 text-center">
          <h2 id="shelf-heading" className="font-display text-3xl font-semibold sm:text-4xl">
            A Whole World of Stories Awaits
          </h2>
          <p className="text-lg">Browse classic storybooks for every age and every bedtime. No account needed to look around.</p>
        </div>
        <div>
          <ul className="flex snap-x gap-4 overflow-x-auto pb-2 sm:justify-center">
            {NEW_BOOKS.map((book) => (
              <li key={book.slug} className="w-28 shrink-0 snap-start sm:w-32">
                <Link href={`/books/${book.slug}`} className="block rounded-xl transition-transform hover:-translate-y-1">
                  <Image
                    src={book.coverUrl}
                    alt={book.title}
                    width={600}
                    height={800}
                    sizes="128px"
                    className="aspect-[3/4] w-full rounded-xl object-cover shadow-[4px_6px_0_rgba(40,53,72,0.18)]"
                  />
                </Link>
              </li>
            ))}
          </ul>
          <div aria-hidden="true" className="-mt-4 h-3.5 rounded-sm bg-wood shadow-[0_6px_0_var(--color-wood-deep)]" />
        </div>
        <Link href="/books" className={`${buttonPrimary} mt-2 w-full self-center sm:w-auto`}>
          Explore the Readli Library
        </Link>
      </div>
    </section>
  );
}

export function FamilyCircles() {
  return (
    <section id="families" aria-labelledby="circles-heading" className="scroll-mt-20 bg-ivory">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-14 sm:px-6">
        <div className="flex max-w-2xl flex-col gap-3">
          <h2 id="circles-heading" className="font-display text-3xl font-semibold sm:text-4xl">
            Your family circle
          </h2>
          <p>
            Bring everyone who reads to your kids into one private circle. Each grown-up records and controls their own
            voice. An invitation never shares anyone&apos;s voice on its own.
          </p>
        </div>
        <FamilyTree />
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="bg-sunshine">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-4 py-14 text-center sm:px-6">
        <ReadiMascot size={120} decorative />
        <h2 className="font-display text-3xl font-semibold sm:text-4xl">Start a family library</h2>
        <Link href="/try" className={buttonPrimary}>
          Hear a story in your voice, free
        </Link>
      </div>
    </section>
  );
}

export function SiteFooter() {
  const links = [
    { href: "/company", label: "Company" },
    { href: "/privacy", label: "Privacy" },
    { href: "/terms", label: "Terms" },
    { href: "/help", label: "Help" },
    { href: "/accessibility", label: "Accessibility" },
    { href: "/parents/safety", label: "Parent Safety" },
  ];
  return (
    <footer className="bg-ivory">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-8 text-sm sm:px-6">
        <ul aria-label="Readli on social media" className="flex w-full max-w-sm justify-between sm:w-fit sm:max-w-none sm:gap-3">
          {SOCIAL_ACCOUNTS.map((a) => (
            <li key={a.platform}>
              <a
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Readli on ${a.name} (opens in a new tab)`}
                className="grid size-9 place-items-center rounded-full text-ink transition-transform sm:size-10 hover:-translate-y-0.5 hover:text-coral-deep"
              >
                <SocialIcon platform={a.platform} className="size-6" />
              </a>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Readli. Every Book. Every Voice.</p>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="underline-offset-4 hover:underline">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
