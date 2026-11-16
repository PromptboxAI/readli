import type { Metadata } from "next";
import Link from "next/link";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import { SiteHeader } from "@/components/home/SiteHeader";
import { SiteFooter } from "@/components/home/sections";
import { SamplePlayer } from "@/components/home/SamplePlayer";
import { Testimonials } from "@/components/home/Testimonials";
import { PageLd } from "@/components/seo/PageLd";
import { getGuide, guideHref, type Guide } from "@/lib/guides/guides";
import { PAGE_TITLES } from "@/lib/seo/titles";
import { publicPageMetadata } from "@/lib/seo/site";

const DESCRIPTION =
  "When grandparents, aunts or a parent live far away, Readli lets them read bedtime stories in their own voice. They record for about a minute, and kids hear them every night.";

export const metadata: Metadata = publicPageMetadata({ title: PAGE_TITLES.longDistance, description: DESCRIPTION, path: "/long-distance-families" });

const WHO: { title: string; body: string; tint: string }[] = [
  {
    title: "Grandparents a plane ride away",
    body: "Grandma and Grandpa record once from their own phone or computer, and the grandkids hear them read Peter Rabbit or Winnie-the-Pooh whenever they like.",
    tint: "bg-sunshine/50",
  },
  {
    title: "A parent who travels or serves",
    body: "Work trips, night shifts and deployments still leave bedtime in your voice. Record before you go and your kids can pick a new story every night.",
    tint: "bg-mint/50",
  },
  {
    title: "Aunts, uncles and godparents",
    body: "Anyone your family loves can be a storyteller. You invite them, they record for about a minute, and you choose which children hear them.",
    tint: "bg-sky/40",
  },
];

const STEPS: { title: string; body: string }[] = [
  { title: "Invite them to record", body: "Send a link from Readli Family. They read a short story aloud for about a minute. No app to install and no tech skills needed." },
  { title: "Their voice reads the library", body: "Classic storybooks play in their voice, so the kids hear a familiar reader instead of a stranger." },
  { title: "Bedtime, every night", body: "Your kids pick a story and press play. The distance doesn't change who's reading." },
];

const FAQS: { q: string; a: string }[] = [
  {
    q: "Does the faraway relative have to pay?",
    a: "No. Recording and sharing a voice is always free with Readli Voice. The family whose kids listen uses Readli Family, or a grandparent can give it as a gift.",
  },
  {
    q: "Is it live, like a video call?",
    a: "No, and that's the point. A video call needs everyone free at the same moment, across time zones. Readli is ready whenever bedtime is, and works alongside your calls.",
  },
  {
    q: "Who decides which voices my kids hear?",
    a: "The parents. A newly shared voice starts switched off for every child, and you turn it on for the children you choose.",
  },
  {
    q: "Can we try it before we commit?",
    a: "Yes. Anyone can record for about a minute and hear a story in their voice free, with no account. Readli Family also comes with a 14-day money-back guarantee on your first payment.",
  },
];

/** Long-distance families (Kevin, 2026-11-16): one landing page for families split by distance, linking the guides written for them. */
export default function LongDistanceFamiliesPage() {
  const guides = ["gift-for-long-distance-grandparents", "grandparents-bedtime-stories-from-far-away", "meaningful-christmas-gifts-from-grandparents"]
    .map((slug) => getGuide(slug))
    .filter((g): g is Guide => g !== null);
  const faqLd = {
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
  return (
    <>
      <SiteHeader />
      <main className="flex flex-col">
        <PageLd path="/long-distance-families" title={PAGE_TITLES.longDistance} description={DESCRIPTION} graph={[faqLd]} />
        <section aria-labelledby="ld-heading" className="bg-sky/25 px-4 pt-12 pb-14 sm:px-6 sm:pt-16">
          <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.2fr_1fr]">
            <div className="flex flex-col gap-5 text-center lg:text-left">
              <p className="text-sm font-extrabold tracking-[0.16em] text-coral-deep uppercase">For long-distance families</p>
              <h1 id="ld-heading" className="font-display text-4xl leading-tight font-semibold sm:text-6xl">
                Miles apart, still there at bedtime
              </h1>
              <p className="mx-auto max-w-xl text-xl leading-relaxed lg:mx-0">
                When the people your kids love live far away, Readli lets them read bedtime stories in their own voice. They record for about a minute, and your kids hear them every night.
              </p>
              <div className="flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
                <Link href="/try" className={`${buttonPrimary} w-full sm:w-auto`} data-testid="ld-cta">
                  Hear a story in your voice, free
                </Link>
                <Link href="/gifts" className={`${buttonSecondary} w-full sm:w-auto`}>
                  Give it as a gift
                </Link>
              </div>
            </div>
            <div className="mx-auto w-full max-w-md">
              <SamplePlayer title="The Three Billy Goats Gruff" large />
            </div>
          </div>
        </section>

        <section aria-labelledby="who-heading" className="bg-ivory px-4 py-12 sm:px-6 lg:py-16">
          <div className="mx-auto flex max-w-6xl flex-col gap-6">
            <h2 id="who-heading" className="text-center font-display text-3xl font-semibold sm:text-4xl">
              Who it&apos;s for
            </h2>
            <ul className="grid gap-4 md:grid-cols-3">
              {WHO.map((w) => (
                <li key={w.title} className={`flex flex-col gap-2 rounded-[var(--radius-panel)] p-6 ${w.tint}`}>
                  <h3 className="font-display text-xl font-semibold">{w.title}</h3>
                  <p className="text-lg leading-relaxed">{w.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="ld-how-heading" className="bg-surface px-4 py-12 sm:px-6 lg:py-16">
          <div className="mx-auto flex max-w-4xl flex-col gap-6">
            <h2 id="ld-how-heading" className="text-center font-display text-3xl font-semibold sm:text-4xl">
              How it works
            </h2>
            <ol className="grid gap-4 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flex flex-col gap-2 rounded-2xl bg-ivory p-6 ring-2 ring-ink/10">
                  <span className="flex size-10 items-center justify-center rounded-full bg-coral font-display text-lg font-semibold text-white" aria-hidden="true">
                    {i + 1}
                  </span>
                  <h3 className="font-display text-xl font-semibold">{s.title}</h3>
                  <p className="text-lg leading-relaxed">{s.body}</p>
                </li>
              ))}
            </ol>
            <p className="text-center">
              <Link href="/how-it-works" className="font-semibold underline underline-offset-4">
                See how Readli works in detail
              </Link>
            </p>
          </div>
        </section>

        <Testimonials />

        {guides.length > 0 && (
          <section aria-labelledby="ld-guides-heading" className="bg-sunshine/30 px-4 py-12 sm:px-6 lg:py-16">
            <div className="mx-auto flex max-w-6xl flex-col gap-6">
              <h2 id="ld-guides-heading" className="text-center font-display text-3xl font-semibold sm:text-4xl">
                Guides for families far apart
              </h2>
              <ul className="grid gap-4 md:grid-cols-3">
                {guides.map((g) => (
                  <li key={g.slug}>
                    <Link href={guideHref(g)} className="flex h-full flex-col gap-2 rounded-[var(--radius-panel)] bg-surface p-6 ring-2 ring-ink/10 hover:ring-coral">
                      <h3 className="font-display text-xl font-semibold">{g.title}</h3>
                      <p>{g.description}</p>
                      <span className="mt-auto text-sm text-ink/70">{g.readMinutes} min read</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        <section aria-labelledby="ld-faq-heading" className="bg-surface px-4 py-12 sm:px-6 lg:py-16">
          <div className="mx-auto flex max-w-3xl flex-col gap-6">
            <h2 id="ld-faq-heading" className="text-center font-display text-3xl font-semibold sm:text-4xl">
              Questions from long-distance families
            </h2>
            <div className="flex flex-col gap-3">
              {FAQS.map((f) => (
                <details key={f.q} className="rounded-2xl bg-ivory px-5 py-4 ring-2 ring-ink/10">
                  <summary className="cursor-pointer font-display text-lg font-semibold">{f.q}</summary>
                  <p className="mt-2 text-lg leading-relaxed">{f.a}</p>
                </details>
              ))}
            </div>
            <div className="flex justify-center">
              <Link href="/pricing" className={buttonPrimary}>
                See plans and pricing
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
