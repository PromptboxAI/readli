import Link from "next/link";
import type { ReactNode } from "react";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import { SiteHeader } from "@/components/home/SiteHeader";
import { SiteFooter } from "@/components/home/sections";
import { SITE_URL, absoluteUrl, jsonLd } from "@/lib/seo/site";

export interface ExplainerSection {
  heading: string;
  body: ReactNode;
  tint: string;
}

export interface ExplainerLink {
  href: string;
  label: string;
}

/**
 * The shared layout for public explainer pages (How it works, Family Voices, Readli Kids): a heading,
 * a few short sections, what's live today against what's coming, related help and one call to action.
 * Phones stack everything in one column; tablets and up put the sections in two.
 */
export function ExplainerPage({
  path,
  eyebrow,
  title,
  intro,
  steps,
  sections,
  liveToday,
  comingSoon,
  related,
  cta,
}: {
  path: string;
  eyebrow: string;
  title: string;
  intro: string;
  steps?: { title: string; body: string }[];
  sections: ExplainerSection[];
  liveToday: string[];
  comingSoon: string[];
  related: ExplainerLink[];
  cta: { primary: ExplainerLink; secondary: ExplainerLink };
}) {
  const pageLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": absoluteUrl(path),
        url: absoluteUrl(path),
        name: title,
        description: intro,
        isPartOf: { "@id": `${SITE_URL}/#website` },
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Readli", item: absoluteUrl("/") },
          { "@type": "ListItem", position: 2, name: title },
        ],
      },
    ],
  };
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex max-w-4xl flex-col gap-10 px-4 py-12 sm:px-6 sm:py-14">
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(pageLd)} />
        <header className="flex flex-col gap-3">
          <p className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-coral-deep">{eyebrow}</p>
          <h1 className="font-display text-4xl font-semibold leading-[1.05] sm:text-5xl">{title}</h1>
          <p className="max-w-2xl text-lg">{intro}</p>
        </header>

        {steps && (
          <ol className="flex flex-col gap-4" data-testid="explainer-steps">
            {steps.map((s, i) => (
              <li key={s.title} className="flex items-start gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ink font-display text-lg font-semibold text-white" aria-hidden="true">
                  {i + 1}
                </span>
                <div className="flex flex-col gap-1">
                  <h2 className="font-display text-xl font-semibold">{s.title}</h2>
                  <p>{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {sections.map((s) => (
            <section key={s.heading} className={`flex flex-col gap-2 rounded-[var(--radius-panel)] p-6 ${s.tint}`}>
              <h2 className="font-display text-xl font-semibold">{s.heading}</h2>
              <div className="flex flex-col gap-2">{s.body}</div>
            </section>
          ))}
        </div>

        <section aria-labelledby="availability-heading" className="flex flex-col gap-4 rounded-[var(--radius-panel)] bg-surface p-6 ring-2 ring-ink/10 sm:p-8" data-testid="availability">
          <h2 id="availability-heading" className="font-display text-2xl font-semibold">
            What&apos;s available
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <h3 className="font-display text-lg font-semibold">Live today</h3>
              <ul className="flex list-disc flex-col gap-1.5 pl-5" data-testid="live-today">
                {liveToday.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="font-display text-lg font-semibold">Coming soon</h3>
              <ul className="flex list-disc flex-col gap-1.5 pl-5" data-testid="coming-soon">
                {comingSoon.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section aria-labelledby="related-heading" className="flex flex-col gap-3">
          <h2 id="related-heading" className="font-display text-2xl font-semibold">
            Learn more
          </h2>
          <ul className="flex flex-col gap-1">
            {related.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href={cta.primary.href} className={`${buttonPrimary} w-full sm:w-auto`}>
            {cta.primary.label}
          </Link>
          <Link href={cta.secondary.href} className={`${buttonSecondary} w-full sm:w-auto`}>
            {cta.secondary.label}
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
