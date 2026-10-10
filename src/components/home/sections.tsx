import Image from "next/image";
import Link from "next/link";
import { DemoBookShelf } from "@/components/books/DemoBookShelf";
import { SocialIcon } from "@/components/brand/SocialIcon";
import { FamilyTree } from "@/components/home/FamilyTree";
import { FamilyOfStorytellers, HearLovedOnes, MakeStorytimeYourOwn } from "@/components/home/StoryIllustrations";
import { ReadiMascot } from "@/components/brand/ReadiMascot";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import { coverSrc, DEMO_BOOKS } from "@/lib/content/demo-books";
import { SOCIAL_ACCOUNTS } from "@/lib/content/social";

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
            <Link href="#try-your-voice" className={buttonPrimary}>
              Hear a story in your voice, free
            </Link>
            <Link href="/#stories" className={buttonSecondary}>
              Browse storybooks
            </Link>
          </div>
        </div>
        <div className="relative mx-auto flex aspect-square w-full max-w-sm items-center justify-center" aria-hidden="true">
          <div className="absolute inset-6 rounded-[40%_60%_55%_45%] bg-mint" />
          <div className="absolute bottom-10 left-4 size-20 rounded-3xl bg-sunshine" />
          <div className="absolute right-6 top-8 size-16 rounded-full bg-lavender" />
          <div className="animate-bob relative">
            <ReadiMascot size={280} priority />
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
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-12 sm:px-6 md:py-16">
        <div className="grid items-center gap-8 rounded-[var(--radius-panel)] bg-surface p-6 sm:p-10 lg:grid-cols-[1fr_1fr]">
          <div className="flex flex-col gap-4">
            <h2 id="try-heading" className="font-display text-3xl font-semibold sm:text-4xl">
              Try your voice. No signup.
            </h2>
            <ol className="flex flex-col gap-3">
              {DEMO_STEPS.map((step, i) => (
                <li key={step} className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-coral font-display font-semibold">
                    {i + 1}
                  </span>
                  <span className="pt-1">{step}</span>
                </li>
              ))}
            </ol>
            <div>
              <Link href="/try" className={buttonPrimary}>
                Start recording
              </Link>
            </div>
            <p className="text-sm text-muted">
              Your recording stays private and is deleted within 24 hours unless you choose to save it.
            </p>
          </div>
          <div
            aria-hidden="true"
            className="relative h-64 overflow-hidden rounded-3xl bg-ivory p-6 pr-24 font-semibold text-ink/40 sm:pr-32 sm:text-xl"
          >
            <p>Once upon a time, in a little house at the edge of a sleepy town,</p>
            <p className="my-2 rounded-lg bg-sunshine/50 text-ink">there lived a family who loved stories</p>
            <p>more than anything. Every night, just after the moon peeked over the rooftops...</p>
            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-ivory" />
            <ReadiMascot size={110} decorative className="animate-bob absolute bottom-3 right-4" />
          </div>
        </div>
        <DemoBookShelf />
      </div>
    </section>
  );
}

export function MeetReadi() {
  return (
    <section aria-labelledby="readi-heading" className="bg-ivory">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-14 sm:px-6">
        <div className="flex flex-col gap-2">
          <p className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-coral-deep">Meet Readi</p>
          <h2 id="readi-heading" className="font-display text-3xl font-semibold sm:text-4xl">
            Your book buddy, at rest and listening
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="flex flex-col items-center gap-5 rounded-[2rem] bg-mint/70 p-8 sm:flex-row">
            <ReadiMascot size={180} className="animate-bob shrink-0" />
            <div>
              <h3 className="font-display text-2xl font-semibold">At rest</h3>
              <p className="mt-1">Eyes open, pages together. Readi waits with you whenever nothing is playing.</p>
            </div>
          </div>
          <div className="flex flex-col gap-6 rounded-[2rem] bg-plum p-8 text-white">
            <div className="flex flex-col items-center gap-5 sm:flex-row">
              <ReadiMascot size={200} state="listening" className="shrink-0" />
              <div>
                <h3 className="font-display text-2xl font-semibold">Listening</h3>
                <p className="mt-1 text-white/80">Eyes close and the pages fan out while a story plays.</p>
              </div>
            </div>
            {/* Illustration of the player, not a working control. */}
            <div className="flex items-center gap-4 rounded-2xl bg-white/10 p-4" aria-hidden="true">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-sunshine text-plum">
                <svg viewBox="0 0 24 24" className="size-5" fill="currentColor">
                  <rect x="6" y="5" width="4" height="14" rx="1" />
                  <rect x="14" y="5" width="4" height="14" rx="1" />
                </svg>
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <p className="truncate text-sm font-semibold">The Tale of Peter Rabbit · read by Grandpa</p>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/20">
                  <div className="h-full w-2/5 rounded-full bg-coral" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const FAMILY_STEPS = [
  { title: "Create", body: "Start your family circle and add the people you'd love to hear.", color: "bg-coral/70" },
  { title: "Invite", body: "Invite family members and loved ones to join Readli.", color: "bg-sunshine" },
  { title: "Record", body: "Each person records and approves their own voice, choosing who can use it.", color: "bg-mint" },
  { title: "Listen", body: "Choose a book and storyteller. Switch voices anytime without losing your place.", color: "bg-sky" },
];

export function HowFamiliesWork() {
  return (
    <section id="how-it-works" aria-labelledby="how-heading" className="scroll-mt-20 bg-lavender/40">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-14 sm:px-6">
        <h2 id="how-heading" className="font-display text-3xl font-semibold sm:text-4xl">
          How Readli Family Works
        </h2>
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FAMILY_STEPS.map((step, i) => (
            <li key={step.title} className={`flex flex-col gap-2 rounded-[var(--radius-panel)] p-6 ${step.color}`}>
              <span className="font-display text-sm font-semibold">Step {i + 1}</span>
              <h3 className="font-display text-2xl font-semibold">{step.title}</h3>
              <p>{step.body}</p>
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

export function KidsShelf() {
  return (
    <section id="stories" aria-labelledby="shelf-heading" className="scroll-mt-20 bg-mint/40">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-14 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 id="shelf-heading" className="font-display text-3xl font-semibold sm:text-4xl">
            A shelf of classics
          </h2>
          <Link href="/try" className={buttonSecondary}>
            Hear one in your voice
          </Link>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Browse by">
          {["Ages 3–5", "Ages 6–8", "Under 10 minutes", "Animals", "Adventure", "Bedtime"].map((tag) => (
            <span key={tag} className="rounded-full border-2 border-ink bg-surface px-4 py-2 text-sm font-semibold">
              {tag}
            </span>
          ))}
        </div>
        <ul className="flex snap-x gap-4 overflow-x-auto pb-2">
          {DEMO_BOOKS.map((book) => (
            <li key={book.slug} className="w-40 shrink-0 snap-start">
              <Image
                src={coverSrc(book)}
                alt={book.title}
                width={600}
                height={800}
                sizes="160px"
                className="aspect-[3/4] w-full rounded-xl object-cover shadow-[4px_6px_0_rgba(40,53,72,0.18)]"
              />
            </li>
          ))}
        </ul>
        <div aria-hidden="true" className="-mt-8 h-3.5 rounded-sm bg-wood shadow-[0_6px_0_var(--color-wood-deep)]" />
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

const TRUST = [
  "Voices are recorded with consent and are private by default.",
  "Kids listen inside parent-managed profiles. No child logins.",
  "No targeted ads to children, ever.",
  "Delete a voice or remove someone's access in a couple of taps.",
];

export function TrustAndSafety() {
  return (
    <section aria-labelledby="trust-heading" className="bg-navy text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-14 sm:px-6">
        <h2 id="trust-heading" className="font-display text-3xl font-semibold sm:text-4xl">
          Safe for families by design
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {TRUST.map((item) => (
            <li key={item} className="flex gap-3 rounded-3xl bg-white/10 p-5">
              <span aria-hidden="true" className="mt-1 size-4 shrink-0 rounded-full bg-mint" />
              {item}
            </li>
          ))}
        </ul>
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
        <Link href="#try-your-voice" className={buttonPrimary}>
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
        <ul aria-label="Readli on social media" className="grid w-fit grid-cols-4 gap-2 sm:flex sm:flex-wrap">
          {SOCIAL_ACCOUNTS.map((a) => (
            <li key={a.platform}>
              <a
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Readli on ${a.name} (opens in a new tab)`}
                className="grid size-11 place-items-center rounded-full bg-surface text-ink ring-2 ring-ink/10 transition-transform hover:-translate-y-0.5 hover:bg-ink hover:text-white"
              >
                <SocialIcon platform={a.platform} />
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
