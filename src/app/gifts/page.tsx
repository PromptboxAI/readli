import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import { SiteHeader } from "@/components/home/SiteHeader";
import { SiteFooter } from "@/components/home/sections";
import { SamplePlayer } from "@/components/home/SamplePlayer";
import { GiftBoxArt } from "@/components/invites/illustrations";
import { formatPrice as dollars } from "@/lib/family/plan";
import { giftSeason } from "@/lib/gifting/season";
import { jsonLd, publicPageMetadata, webPageNode } from "@/lib/seo/site";
import { sponsorshipContext } from "@/lib/sponsorship/http";
import { SPONSORED } from "@/lib/sponsorship/rules";
import { PAGE_TITLES } from "@/lib/seo/titles";

const TITLE = "Give the gift of your voice at bedtime";
const DESCRIPTION = `Give Readli Family to up to ${SPONSORED.households} families you love, and your grandkids hear classic storybooks read in your own voice. A year is ${dollars(SPONSORED.annualCents)}, paid once.`;

export const metadata: Metadata = publicPageMetadata({ title: PAGE_TITLES.gifts, description: DESCRIPTION, path: "/gifts" });

// Whether gifts are on sale, and the season, are checked per request.
export const dynamic = "force-dynamic";

const ICON = { fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const STEPS: { title: string; body: string; tint: string; icon: ReactNode }[] = [
  {
    title: "Record your voice, free",
    body: "Read a short story aloud for about a minute on your phone or computer. A few moments later you hear a classic book read in your voice.",
    tint: "bg-sunshine",
    icon: (
      <svg viewBox="0 0 24 24" className="size-7" {...ICON}>
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
      </svg>
    ),
  },
  {
    title: "Pick the families and the day",
    body: `Choose up to ${SPONSORED.households} families, add a note, and send it now or on a day you pick, like Christmas morning.`,
    tint: "bg-mint",
    icon: (
      <svg viewBox="0 0 24 24" className="size-7" {...ICON}>
        <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
        <path d="M3.5 10h17M8 3v4M16 3v4" />
      </svg>
    ),
  },
  {
    title: "They open stories in your voice",
    body: "Each family sets up its own home, with no card to enter. Parents choose which children hear you, then bedtime starts.",
    tint: "bg-lavender",
    icon: (
      <svg viewBox="0 0 24 24" className="size-7" {...ICON}>
        <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
      </svg>
    ),
  },
];

const PLANS = [
  { id: "annual", name: "A whole year", price: dollars(SPONSORED.annualCents), note: "Paid once. It never renews on its own.", badge: "Best for the holidays" },
  { id: "monthly", name: "Month to month", price: `${dollars(SPONSORED.monthlyCents)} a month`, note: "You cover it each month until you stop.", badge: null },
];

const EACH_FAMILY_GETS = [
  "Your voice, without using one of their storyteller slots",
  "Room for one more storyteller of their own",
  "Up to 6 child profiles, each with their own bookshelf",
  `A share of ${SPONSORED.monthlyCredits} narration credits a month for new stories (${SPONSORED.startingShare} each to start)`,
  "The whole Readli library of classic stories",
];

const REASONS: { title: string; body: string; tint: string }[] = [
  { title: "Still giving in March", body: "A toy is opened once. Your voice is there every night of the year, one story after another.", tint: "bg-sky/50" },
  { title: "Miles don't matter", body: "Live in another state or time zone? They hear you at their bedtime, whenever that is.", tint: "bg-sunshine/60" },
  { title: "Nothing to wrap or ship", body: "It arrives by email on the day you choose, with your note. No shipping deadlines to beat.", tint: "bg-mint" },
  { title: "Private by design", body: "Your voice is only shared with the families you pick, and parents decide which children hear it.", tint: "bg-lavender/60" },
];

const FAQS: { q: string; a: string }[] = [
  {
    q: "Do the families pay anything?",
    a: "No. Families never enter a card for your gift. When it ends, each family chooses whether to keep going on their own plan.",
  },
  {
    q: "Can it arrive on Christmas morning?",
    a: `Yes. Pick the delivery day when you give it, up to ${SPONSORED.maxDeliveryDays} days ahead, and it arrives at 7 in the morning that day. You can also send it straight away.`,
  },
  {
    q: "Do I have to record my voice to give a gift?",
    a: "No, but it's the best part. Without your voice, each family still gets Readli Family and can invite their own storytellers. You can record yours later and share it then.",
  },
  {
    q: "What can I see after I give it?",
    a: "You can see how many narration credits each family has used, and choose how next month's credits are split between them. You never see which stories they chose, their children or their listening.",
  },
  {
    q: "What if I change my mind?",
    a: "If you cancel before the delivery day, you get a full refund. A whole-year gift never renews on its own, and a monthly gift runs until you stop it.",
  },
  {
    q: "Is it free for me to record and share my voice?",
    a: "Yes. Recording and sharing your voice is always free with Readli Voice, gift or no gift.",
  },
];

/**
 * The public gift page (SleepyTale review, 2026-11): what a Readli gift is, for search and for links
 * from the homepage and pricing. Giving happens on /gift/family, which needs sign-in and stays out of
 * search. While gifts aren't on sale, the page says so and points to recording a voice instead.
 */
export default async function GiftsPage() {
  const selling = Boolean(await sponsorshipContext({ newGifts: true }).catch(() => null));
  const season = giftSeason();
  const primary = selling ? { href: "/gift/family", label: "Give a gift" } : { href: "/try", label: "Record your voice free" };
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      webPageNode({ path: "/gifts", title: PAGE_TITLES.gifts, description: DESCRIPTION }),
      {
        "@type": "FAQPage",
        mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
    ],
  };
  return (
    <>
      <SiteHeader />
      <main className="flex flex-col">
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(ld)} />
        <section aria-labelledby="gifts-heading" className="bg-coral/15 px-4 pt-12 pb-14 sm:px-6 sm:pt-16">
          <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.2fr_1fr]">
            <div className="flex flex-col gap-5 text-center lg:text-left">
              <p className="text-sm font-extrabold tracking-[0.16em] text-coral-deep uppercase" data-testid="gifts-eyebrow">
                {season ? "A Christmas gift for the grandkids" : "Readli gifts"}
              </p>
              <h1 id="gifts-heading" className="font-display text-4xl leading-[1.08] font-semibold sm:text-5xl lg:text-[56px]">
                {TITLE}
              </h1>
              <p className="mx-auto max-w-xl text-xl leading-relaxed text-ink/85 lg:mx-0">
                Record about a minute, then give Readli Family to up to {SPONSORED.households} families you love. Your grandkids hear classic storybooks
                read by you, every night.
              </p>
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
                <Link href={primary.href} className={`${buttonPrimary} w-full sm:w-auto`} data-testid="gifts-cta">
                  {primary.label}
                </Link>
                <Link href="#how" className={`${buttonSecondary} w-full sm:w-auto`}>
                  How a gift works
                </Link>
              </div>
              {selling ? (
                season && (
                  <p className="font-semibold" data-testid="gifts-season">
                    Choose {season.deliverLabel} as the delivery day and it arrives at 7 a.m. with your note.
                  </p>
                )
              ) : (
                <p className="font-semibold" data-testid="gifts-soon">
                  Gifts open soon. Record your voice now, free, so it&apos;s ready the day you give it.
                </p>
              )}
            </div>
            <div className="mx-auto flex w-full max-w-md flex-col items-center gap-5">
              <GiftBoxArt open className="w-40 sm:w-48" />
              <div className="flex w-full flex-col gap-3 rounded-[28px] bg-surface p-4 text-left shadow-[0_24px_50px_-24px_rgba(40,53,72,0.45)] ring-1 ring-ink/5 sm:p-5">
                <p className="text-sm font-extrabold tracking-[0.1em] text-mint-deep uppercase">What they&apos;ll hear</p>
                <p className="text-base leading-snug">Grandpa Kevin recorded one minute. Readli read the rest.</p>
                <SamplePlayer title="The Three Billy Goats Gruff" />
              </div>
            </div>
          </div>
        </section>

        <section id="how" aria-labelledby="how-heading" className="scroll-mt-20 bg-surface px-4 py-12 sm:px-6 lg:py-16">
          <div className="mx-auto flex max-w-6xl flex-col gap-8">
            <h2 id="how-heading" className="text-center font-display text-3xl font-semibold sm:text-4xl">
              How a Readli gift works
            </h2>
            <ol className="mx-auto grid max-w-md gap-6 md:max-w-none md:grid-cols-3 md:gap-10">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flex items-start gap-4 md:flex-col md:items-center md:text-center">
                  <span className={`relative grid size-16 shrink-0 place-items-center rounded-full md:size-20 ${s.tint}`}>
                    {s.icon}
                    <span className="absolute -top-1 -right-1 grid size-8 place-items-center rounded-full bg-ink font-display font-semibold text-white">{i + 1}</span>
                  </span>
                  <div className="flex flex-col gap-1 md:items-center">
                    <h3 className="font-display text-xl font-semibold">{s.title}</h3>
                    <p className="max-w-xs">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section aria-labelledby="plans-heading" className="bg-sunshine/35 px-4 py-12 sm:px-6 lg:py-16" data-testid="gifts-plans">
          <div className="mx-auto flex max-w-5xl flex-col gap-6">
            <div className="flex flex-col gap-2 text-center">
              <h2 id="plans-heading" className="font-display text-3xl font-semibold sm:text-4xl">
                One gift, up to {SPONSORED.households} families
              </h2>
              <p className="text-lg">You pay for one plan. Each family runs its own home, children and approvals.</p>
            </div>
            <ul className="mx-auto grid w-full max-w-3xl gap-5 sm:grid-cols-2">
              {PLANS.map((p) => (
                <li key={p.id} className="relative flex flex-col gap-1 rounded-[var(--radius-panel)] bg-surface p-6 pt-8 text-center shadow-[6px_8px_0_rgba(40,53,72,0.12)]">
                  {p.badge && (
                    <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full border-[3px] border-ink bg-sunshine px-3 py-0.5 font-display text-sm font-semibold whitespace-nowrap">
                      {p.badge}
                    </span>
                  )}
                  <span className="font-display text-xl font-semibold">{p.name}</span>
                  <span className="font-display text-3xl font-semibold">{p.price}</span>
                  <span className="text-sm text-muted">{p.note}</span>
                </li>
              ))}
            </ul>
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 rounded-[var(--radius-panel)] bg-surface p-6 sm:p-8">
              <h3 className="font-display text-2xl font-semibold">Each family gets</h3>
              <ul className="flex flex-col gap-2">
                {EACH_FAMILY_GETS.map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <svg viewBox="0 0 24 24" className="mt-0.5 size-5 shrink-0 text-mint-deep" aria-hidden="true">
                      <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex justify-center">
              <Link href={primary.href} className={`${buttonPrimary} w-full sm:w-auto`}>
                {primary.label}
              </Link>
            </div>
          </div>
        </section>

        <section aria-labelledby="why-heading" className="bg-ivory px-4 py-12 sm:px-6 lg:py-16">
          <div className="mx-auto flex max-w-6xl flex-col gap-6">
            <h2 id="why-heading" className="text-center font-display text-3xl font-semibold sm:text-4xl">
              Why grandparents give Readli
            </h2>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {REASONS.map((r) => (
                <li key={r.title} className={`flex flex-col gap-2 rounded-[var(--radius-panel)] p-6 ${r.tint}`}>
                  <h3 className="font-display text-xl font-semibold">{r.title}</h3>
                  <p>{r.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="faq-heading" className="bg-surface px-4 py-12 sm:px-6 lg:py-16">
          <div className="mx-auto flex max-w-3xl flex-col gap-6">
            <h2 id="faq-heading" className="text-center font-display text-3xl font-semibold sm:text-4xl">
              Questions about gifts
            </h2>
            <div className="flex flex-col gap-3">
              {FAQS.map((f) => (
                <details key={f.q} className="rounded-2xl bg-ivory px-5 py-4 ring-2 ring-ink/10">
                  <summary className="cursor-pointer font-display text-lg font-semibold">{f.q}</summary>
                  <p className="mt-2 text-lg leading-relaxed">{f.a}</p>
                </details>
              ))}
            </div>
            <p className="text-center">
              Already received a gift?{" "}
              <Link href="/gift/open" className="font-semibold underline underline-offset-4">
                Open it here
              </Link>
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
