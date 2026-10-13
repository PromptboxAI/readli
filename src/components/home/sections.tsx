import Image from "next/image";
import Link from "next/link";
import { DemoBookShelf } from "@/components/books/DemoBookShelf";
import { SocialIcon } from "@/components/brand/SocialIcon";
import { FamilyTree } from "@/components/home/FamilyTree";
import { HeroBedtimeScene } from "@/components/home/HeroBedtimeScene";
import { FamilyOfStorytellers, HearLovedOnes, MakeStorytimeYourOwn } from "@/components/home/StoryIllustrations";
import { ReadiMascot } from "@/components/brand/ReadiMascot";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import { SOCIAL_ACCOUNTS } from "@/lib/content/social";
import { rewardsConfig } from "@/lib/rewards/rewards";
import { NEW_BOOKS } from "@/lib/library/catalog";

const GRANDPA = "/family-voices/grandpa.webp";

/**
 * Homepage hero, direction B (Kevin, 2026-10-12): adult-facing copy beside a bedtime family scene
 * and a preview of the real Kids Mode player (plum storyteller bar, highlighted sentence, Back/Next).
 * Readi stays a small accent here; he keeps his starring role in Kids Mode.
 */
export function Hero() {
  return (
    <section className="relative overflow-hidden bg-ivory">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-[40%] top-[30%] h-[80%] w-[140%] rounded-full bg-[radial-gradient(closest-side,#dcf3e5_0%,#e9f6ec_55%,rgba(255,249,237,0)_100%)] lg:-right-[14%] lg:-top-[6%] lg:h-[112%] lg:w-[64%]"
      />
      <div className="relative mx-auto grid max-w-6xl items-center gap-7 px-4 pb-7 pt-9 text-center sm:px-6 lg:grid-cols-[1fr_1.05fr] lg:gap-10 lg:pb-9 lg:pt-16 lg:text-left">
        <div className="flex flex-col items-center gap-[18px] lg:items-start lg:gap-[22px]">
          <p className="text-[13px] font-extrabold uppercase tracking-[0.16em] text-coral-deep">Every Book. Every Voice.</p>
          <h1 className="font-display text-4xl font-semibold leading-[1.08] tracking-[-0.012em] sm:text-5xl lg:text-[56px] lg:leading-[1.06]">
            Their favorite stories. Read by their{" "}
            <span className="relative whitespace-nowrap">
              favorite people.
              <svg viewBox="0 0 300 16" preserveAspectRatio="none" className="absolute -bottom-2.5 left-[-2%] h-4 w-[104%]" aria-hidden="true">
                <path d="M4 11 C70 3 160 2 296 8" stroke="#9ce2bc" strokeWidth="7" fill="none" strokeLinecap="round" />
              </svg>
            </span>
          </h1>
          <p className="max-w-[33rem] text-[17px] leading-relaxed text-ink/85 sm:text-[19px]">
            Record your voice and bring classic stories to life. Share your voice with the people you love, so family storytime feels
            close, even when you&apos;re miles apart.
          </p>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap">
            <Link href="/try" className={buttonPrimary}>
              Try Your Voice Free
            </Link>
            <Link href="/#how-it-works" className={buttonSecondary}>
              Explore Readli Family
            </Link>
          </div>
          <p className="flex items-center gap-2 text-sm font-bold text-muted">
            <svg viewBox="0 0 24 24" className="size-[18px] shrink-0 text-mint-deep" aria-hidden="true">
              <circle cx="12" cy="12" r="11" fill="currentColor" opacity="0.16" />
              <path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Free to try. No signup needed.
          </p>
        </div>
        <HeroPlayerScene />
      </div>
    </section>
  );
}

/** Marketing picture only: the bedtime scene plus a drawing of the Kids Mode player. Not interactive. */
function HeroPlayerScene() {
  return (
    <div
      role="img"
      aria-label="A parent and child in bed listening to The Velveteen Rabbit, read by Grandpa in the Readli player, with the current sentence highlighted."
      className="relative mx-auto w-full max-w-lg lg:h-[580px] lg:max-w-none"
    >
      <div className="relative overflow-hidden rounded-3xl shadow-[0_24px_50px_-22px_rgba(40,53,72,0.45)] lg:absolute lg:left-0 lg:top-6 lg:w-[72%] lg:rounded-[28px]">
        <HeroBedtimeScene className="block h-[250px] w-full lg:h-auto" />
      </div>
      <div className="absolute right-[18px] top-0 hidden items-center gap-2.5 rounded-[18px] bg-surface py-2.5 pl-2.5 pr-3.5 text-left shadow-[0_14px_30px_-12px_rgba(40,53,72,0.35)] ring-1 ring-ink/5 lg:flex">
        <Image src={GRANDPA} alt="" width={36} height={36} className="rounded-full" />
        <span>
          <span className="block text-xs font-bold text-muted">Grandpa added a new story</span>
          <span className="block font-display text-[15px] font-semibold">Ready for tonight</span>
        </span>
        <svg viewBox="0 0 16 16" className="size-[18px] text-coral" aria-hidden="true">
          <path d="M0 4 C0 -2 8 -3 8 3 C8 -3 16 -2 16 4 C16 10 8 14 8 16 C8 14 0 10 0 4Z" fill="currentColor" />
        </svg>
      </div>
      <div className="relative mx-3 -mt-14 rounded-[28px] bg-surface p-4 text-left shadow-[0_30px_60px_-20px_rgba(40,53,72,0.4)] ring-1 ring-ink/5 lg:absolute lg:-right-2 lg:bottom-0 lg:mx-0 lg:mt-0 lg:w-[330px] lg:p-5">
        <div className="flex gap-3.5">
          <Image
            src="/covers/the-velveteen-rabbit.webp"
            alt=""
            width={78}
            height={104}
            className="h-auto w-16 rounded-l-[4px] rounded-r-[10px] shadow-[3px_4px_0_rgba(40,53,72,0.16)] lg:w-[78px]"
          />
          <div>
            <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-muted">
              <span className="size-2 rounded-full bg-coral-deep" />
              Now reading
            </p>
            <p className="mt-1 font-display text-[19px] font-semibold leading-tight lg:text-[21px]">The Velveteen Rabbit</p>
            <p className="mt-0.5 text-[13px] text-muted">Margery Williams, 1922</p>
          </div>
        </div>
        <div className="mt-3.5 flex items-center gap-2.5 rounded-[22px] bg-plum py-2 pl-2 pr-2.5 text-white">
          <span className="flex items-center gap-2.5 rounded-full bg-white/10 py-1 pl-1 pr-4">
            <Image src={GRANDPA} alt="" width={44} height={44} className="rounded-full" />
            <span>
              <span className="block text-[11px] text-white/80">Read by</span>
              <span className="block font-display text-lg font-semibold leading-tight">Grandpa</span>
              <span className="block text-[11px] font-bold text-sunshine">Change storyteller</span>
            </span>
          </span>
          <span className="ml-auto flex min-h-11 items-center rounded-full bg-sunshine px-[18px] font-display text-[17px] font-semibold text-ink">Pause</span>
        </div>
        <p className="mt-3 rounded-[18px] bg-surface px-4 py-3.5 text-[15px] leading-relaxed ring-2 ring-inset ring-ink/10 lg:text-base">
          There was once a velveteen rabbit, and in the beginning he was really splendid.{" "}
          <span className="rounded bg-sunshine/70">He was fat and bunchy, as a rabbit should be;</span> his coat was spotted brown and white.
        </p>
        <div className="mt-3 hidden items-center justify-between lg:flex">
          <span className="flex min-h-[38px] items-center rounded-full border-[3px] border-ink px-4 font-display text-[15px] font-semibold">Back</span>
          <span className="text-[13px] text-muted">Sentence 2 of 214</span>
          <span className="flex min-h-[38px] items-center rounded-full border-[3px] border-ink px-4 font-display text-[15px] font-semibold">Next</span>
        </div>
      </div>
    </div>
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
        {/* No studio picture on desktop: the hero above already shows a highlighted story (Kevin, 2026-10-12). */}
        <div className="rounded-[var(--radius-panel)] bg-surface p-6 sm:p-10">
          <div className="flex flex-col gap-4 text-center lg:gap-6 lg:text-left">
            {/* Phones and tablets get Kevin's short pitch, centred; desktop lays the three steps out in a row. */}
            <h2 id="try-heading" className="font-display text-3xl font-semibold sm:text-4xl">
              <span className="lg:hidden">Hear your voice tell a story.</span>
              <span className="hidden lg:inline">Try your voice. No signup.</span>
            </h2>
            <p className="text-lg lg:hidden">Read a short passage, then hear your voice bring a story to life.</p>
            <ol className="hidden gap-6 lg:grid lg:grid-cols-3">
              {DEMO_STEPS.map((step, i) => (
                <li key={step} className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-coral font-display font-semibold">
                    {i + 1}
                  </span>
                  <span className="pt-1">{step}</span>
                </li>
              ))}
            </ol>
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-5">
              <Link href="/try" className={`${buttonPrimary} w-full sm:w-auto sm:self-center lg:self-start`}>
                <span className="lg:hidden">Try Your Voice Free</span>
                <span className="hidden lg:inline">Start recording</span>
              </Link>
              <p className="text-sm font-semibold text-muted lg:hidden">No signup required</p>
              <p className="hidden text-sm text-muted lg:block">
                Your recording stays private and is deleted within 24 hours unless you choose to save it.
              </p>
            </div>
          </div>
        </div>
        <DemoBookShelf />
      </div>
    </section>
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
  const { trialDays } = rewardsConfig();
  return (
    <section className="bg-sunshine">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-4 py-14 text-center sm:px-6">
        <ReadiMascot size={120} decorative />
        <h2 className="font-display text-3xl font-semibold sm:text-4xl">Start a family library</h2>
        <div className="flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
          <Link href="/try" className={`${buttonPrimary} w-full sm:w-auto`}>
            Hear a story in your voice, free
          </Link>
          <Link href="/signup/family" className={`${buttonSecondary} w-full sm:w-auto`}>
            Start your free trial
          </Link>
        </div>
        <p data-testid="family-trial-line">
          Try Readli Family free for {trialDays} days. Card required, cancel any time.{" "}
          <Link href="/pricing" className="font-semibold underline underline-offset-4">
            See pricing
          </Link>
        </p>
      </div>
    </section>
  );
}

export function SiteFooter() {
  const links = [
    { href: "/company", label: "Company" },
    { href: "/pricing", label: "Pricing" },
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
