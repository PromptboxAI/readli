import Image from "next/image";
import Link from "next/link";
import { DemoBookShelf } from "@/components/books/DemoBookShelf";
import { SocialIcon } from "@/components/brand/SocialIcon";
import { FamilyTree } from "@/components/home/FamilyTree";
import { HeroBedtimeScene } from "@/components/home/HeroBedtimeScene";
import { ReadiMascot } from "@/components/brand/ReadiMascot";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import { SOCIAL_ACCOUNTS } from "@/lib/content/social";
import { MORE_BOOKS_ON_PHONES, NEW_BOOKS } from "@/lib/library/catalog";
import { bookPath } from "@/lib/library/paths";

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

const ICON = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

// Desktop demo steps (Kevin's reference, 2026-10-13). Colour classes are spelled out so Tailwind generates them.
const DEMO_STEPS = [
  {
    title: "Confirm it's your voice",
    body: "Tick two quick boxes to confirm the voice you record is yours.",
    card: "bg-coral/10",
    badge: "bg-coral/25 text-coral-deep",
    icon: "bg-coral/20 text-coral-deep",
    svg: (
      <svg viewBox="0 0 24 24" className="size-6" {...ICON}>
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
      </svg>
    ),
  },
  {
    title: "Read a short story",
    body: "Read a fun 1 to 2 minute script as it scrolls on screen.",
    card: "bg-mint/25",
    badge: "bg-mint text-mint-deep",
    icon: "bg-mint/50 text-mint-deep",
    svg: (
      <svg viewBox="0 0 24 24" className="size-6" {...ICON}>
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
        <path d="M14 3v5h5M9 13h6M9 17h4" />
      </svg>
    ),
  },
  {
    title: "Hear it in a story",
    body: (
      <>
        Pick a classic children&apos;s book and listen to it in <strong className="font-bold text-ink">your voice</strong>.
      </>
    ),
    card: "bg-lavender/25",
    badge: "bg-lavender/70 text-plum",
    icon: "bg-lavender/50 text-plum",
    svg: (
      <svg viewBox="0 0 24 24" className="size-6" {...ICON}>
        <path d="M2 5h6a4 4 0 0 1 4 4v11a3 3 0 0 0-3-3H2zM22 5h-6a4 4 0 0 0-4 4v11a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
  },
];

export function TryYourVoice() {
  return (
    <section id="try-your-voice" aria-labelledby="try-heading" className="scroll-mt-20 bg-ivory">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 md:gap-10 md:py-16">
        {/* No studio picture: the hero above already shows a highlighted story (Kevin, 2026-10-12).
            Phones and tablets keep the simple card; desktop follows Kevin's step-card reference (2026-10-13). */}
        <div className="flex flex-col items-center rounded-[var(--radius-panel)] bg-surface p-6 text-center sm:p-10">
          <p className="font-display text-sm font-semibold tracking-[0.12em] text-mint-deep uppercase">Try your voice</p>
          <h2 id="try-heading" className="mt-1 font-display text-3xl font-semibold sm:text-4xl lg:text-5xl">
            Hear your voice tell a story.
          </h2>
          <p className="mt-3 max-w-xl text-lg text-muted">
            <span className="lg:hidden">Read a short passage, then hear your voice bring a story to life.</span>
            <span className="hidden lg:inline">See how Readli brings stories to life with your voice in just a few minutes.</span>
          </p>
          <ol data-testid="demo-steps" className="mt-8 hidden w-full grid-cols-3 gap-10 lg:grid">
            {DEMO_STEPS.map((step, i) => (
              <li key={step.title} className={`relative flex flex-col items-center gap-3 rounded-3xl px-6 pt-5 pb-7 ${step.card}`}>
                <span className={`flex size-8 items-center justify-center self-start rounded-full font-display font-semibold ${step.badge}`}>
                  {i + 1}
                </span>
                <span className={`-mt-4 flex size-12 items-center justify-center rounded-full ${step.icon}`}>{step.svg}</span>
                <h3 className="font-display text-lg font-semibold">{step.title}</h3>
                <p className="text-muted">{step.body}</p>
                {i < DEMO_STEPS.length - 1 && (
                  <span aria-hidden="true" className="absolute top-1/2 -right-9 w-8 border-t-2 border-dashed border-ink/25" />
                )}
              </li>
            ))}
          </ol>
          <Link href="/try" className={`${buttonPrimary} mt-6 w-full sm:w-auto lg:mt-8 lg:min-h-14 lg:px-10 lg:text-xl`}>
            <span className="lg:hidden">Try Your Voice Free</span>
            <span className="hidden lg:inline">Start recording &rarr;</span>
          </Link>
          <p className="mt-3 text-sm font-semibold text-muted lg:hidden">No signup required</p>
          <p className="mt-4 hidden items-center gap-1.5 text-sm text-muted lg:flex">
            <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true" {...ICON}>
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
            Your recording stays private and is deleted within 24 hours unless you choose to save it.
          </p>
        </div>
        <DemoBookShelf />
      </div>
    </section>
  );
}

// Kevin's reference (2026-10-13): numbered circles joined by a line, each step in a soft tinted box,
// and a lock note at the bottom. Phones stack the steps; desktop lays them out in a row.
const FAMILY_STEPS = [
  { title: "Create", body: "Start your family circle.", dot: "bg-[#ff9a8c]" },
  { title: "Invite", body: "Invite the people you'd love to hear.", dot: "bg-sunshine" },
  { title: "Record", body: "Each person records and approves their own voice.", dot: "bg-mint" },
  { title: "Listen", body: "Choose a book and storyteller. Switch voices without losing your place.", dot: "bg-sky" },
];

export function HowFamiliesWork() {
  return (
    <section id="how-it-works" aria-labelledby="how-heading" className="scroll-mt-20 bg-lavender/40">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-10 sm:gap-6 sm:px-6 sm:py-12">
        <h2 id="how-heading" className="font-display text-3xl font-semibold sm:text-4xl">
          How Readli Family Works
        </h2>
        <div className="relative">
          {/* Desktop: one line across the numbers, from the first circle to the last. */}
          <span
            aria-hidden="true"
            className="absolute top-[22px] left-[22px] hidden border-t-2 border-plum/20 lg:block"
            style={{ right: "calc((100% - 60px) / 4 - 22px)" }}
          />
          <ol className="flex flex-col gap-3.5 lg:grid lg:grid-cols-4 lg:gap-5">
            {FAMILY_STEPS.map((step, i) => (
              <li key={step.title} className="relative flex items-start gap-3 lg:flex-col lg:gap-3.5">
                {/* Phones: a line from each circle down to the next. */}
                {i < FAMILY_STEPS.length - 1 && (
                  <span aria-hidden="true" className="absolute top-11 -bottom-4 left-5 border-l-2 border-plum/20 lg:hidden" />
                )}
                <span
                  aria-hidden="true"
                  className={`relative mt-0.5 flex size-[42px] shrink-0 items-center justify-center rounded-full font-display text-lg font-semibold lg:mt-0 lg:size-11 ${step.dot}`}
                >
                  {i + 1}
                </span>
                <div className="flex-1 self-stretch rounded-[18px] bg-surface/55 px-4 py-3 lg:rounded-[20px] lg:px-5 lg:py-4">
                  <h3 className="font-display text-lg font-semibold lg:text-xl">{step.title}</h3>
                  <p className="mt-0.5 text-[15px] text-ink/85 lg:text-base">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <p className="text-[15px] font-semibold text-ink/85 sm:text-base">
          Grandparents and loved ones can start for free, too. Record your voice, invite your family, and let them listen when they&apos;re ready.
        </p>
        <div className="flex max-w-3xl items-center gap-3.5 rounded-[20px] bg-lavender/45 px-4 py-3 sm:px-5">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface/80" aria-hidden="true">
            <svg viewBox="0 0 24 24" className="size-[22px]">
              <rect x="5" y="11" width="14" height="10" rx="2.5" fill="#9b7fe0" />
              <path d="M8 11V7.5a4 4 0 0 1 8 0V11" fill="none" stroke="#9b7fe0" strokeWidth="2.2" />
              <circle cx="12" cy="16" r="1.4" fill="#fffef9" />
            </svg>
          </span>
          <p className="text-sm text-ink/85 sm:text-[15px]">
            Each voice belongs to the person who recorded it. Only they can share it, and they can turn sharing off anytime.
          </p>
        </div>
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
            {/* Phones scroll through six more books; desktop keeps the six (Kevin, 2026-10-13). */}
            {[...NEW_BOOKS, ...MORE_BOOKS_ON_PHONES].map((book, i) => (
              <li key={book.slug} className={`w-28 shrink-0 snap-start sm:w-32 ${i >= NEW_BOOKS.length ? "sm:hidden" : ""}`}>
                <Link href={bookPath(book.slug)} className="block rounded-xl transition-transform hover:-translate-y-1">
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
        <div className="flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
          <Link href="/try" className={`${buttonPrimary} w-full sm:w-auto`}>
            Hear a story in your voice, free
          </Link>
          <Link href="/signup/family" className={`${buttonSecondary} w-full sm:w-auto`}>
            Start your family
          </Link>
        </div>
        <p data-testid="family-plan-line">
          Readli Family is a monthly or yearly plan you can cancel any time.{" "}
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
    { href: "/books", label: "Library" },
    { href: "/company", label: "Company" },
    { href: "/pricing", label: "Pricing" },
    { href: "/privacy", label: "Privacy" },
    { href: "/terms", label: "Terms" },
    { href: "/help", label: "Help" },
    { href: "/accessibility", label: "Accessibility" },
    { href: "/parents/safety", label: "Parent Safety" },
    { href: "/privacy/choices", label: "Do Not Sell or Share My Personal Information" },
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
