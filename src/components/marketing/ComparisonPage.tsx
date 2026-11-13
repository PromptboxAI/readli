import Link from "next/link";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import { SiteHeader } from "@/components/home/SiteHeader";
import { SiteFooter } from "@/components/home/sections";
import { COMPANY } from "@/lib/content/company";
import { COMPARISONS_CHECKED, comparisonHref, readliStrengths, type Comparison, type ReadliFacts } from "@/lib/content/comparisons";
import { SITE_URL, absoluteUrl, jsonLd } from "@/lib/seo/site";

const TINTS = ["bg-sunshine/60", "bg-mint", "bg-sky/60", "bg-lavender/70"];

/**
 * One "Readli or X" page: what sets Readli apart first, then a side-by-side table, who the other
 * product suits, an FAQ (with FAQPage data), sources and a dated note that details can change.
 * Phones get one stacked card per row instead of the table.
 */
export function ComparisonPage({ c, facts, others }: { c: Comparison; facts: ReadliFacts; others: Comparison[] }) {
  const path = comparisonHref(c.slug);
  const title = `Readli or ${c.name}?`;
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": absoluteUrl(path),
        url: absoluteUrl(path),
        name: title,
        description: c.metaDescription,
        isPartOf: { "@id": `${SITE_URL}/#website` },
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Readli", item: absoluteUrl("/") },
          { "@type": "ListItem", position: 2, name: "Compare", item: absoluteUrl("/vs") },
          { "@type": "ListItem", position: 3, name: title },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: c.faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
    ],
  };
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex max-w-4xl flex-col gap-12 px-4 py-12 sm:px-6 sm:py-14">
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(ld)} />
        <header className="flex flex-col gap-3">
          <p className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-coral-deep">
            <Link href="/vs" className="underline-offset-4 hover:underline">
              Compare
            </Link>
          </p>
          <h1 className="font-display text-4xl font-semibold leading-[1.05] sm:text-5xl">{title}</h1>
          <p className="max-w-2xl text-lg">{c.intro}</p>
          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <Link href="/try" className={`${buttonPrimary} w-full sm:w-auto`}>
              Hear a story in your voice, free
            </Link>
            <Link href="/pricing" className={`${buttonSecondary} w-full sm:w-auto`}>
              See pricing
            </Link>
          </div>
        </header>

        <section aria-labelledby="strengths-heading" className="flex flex-col gap-4">
          <h2 id="strengths-heading" className="font-display text-3xl font-semibold">
            What makes Readli different
          </h2>
          <div className="grid gap-4 sm:grid-cols-2" data-testid="readli-strengths">
            {readliStrengths(facts).map((s, i) => (
              <div key={s.title} className={`flex flex-col gap-2 rounded-[var(--radius-panel)] p-6 ${TINTS[i % TINTS.length]}`}>
                <h3 className="font-display text-xl font-semibold">{s.title}</h3>
                <p>{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="table-heading" className="flex flex-col gap-4">
          <h2 id="table-heading" className="font-display text-3xl font-semibold">
            Readli and {c.name}, side by side
          </h2>
          <p>{c.whatTheyAre}</p>
          <table className="hidden w-full border-separate border-spacing-0 overflow-hidden rounded-[var(--radius-panel)] ring-2 ring-ink/10 sm:table" data-testid="comparison-table">
            <thead>
              <tr className="bg-ink text-left text-white">
                <th scope="col" className="w-1/5 p-4 font-display font-semibold">
                  <span className="sr-only">Topic</span>
                </th>
                <th scope="col" className="w-2/5 p-4 font-display text-lg font-semibold">
                  Readli
                </th>
                <th scope="col" className="w-2/5 p-4 font-display text-lg font-semibold">
                  {c.name}
                </th>
              </tr>
            </thead>
            <tbody>
              {c.rows.map((r, i) => (
                <tr key={r.topic} className={i % 2 ? "bg-surface" : "bg-sunshine/15"}>
                  <th scope="row" className="p-4 text-left align-top font-display font-semibold">
                    {r.topic}
                  </th>
                  <td className="p-4 align-top">{r.readli}</td>
                  <td className="p-4 align-top">{r.them}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="flex flex-col gap-3 sm:hidden" aria-label={`Readli and ${c.name} compared`}>
            {c.rows.map((r) => (
              <li key={r.topic} className="flex flex-col gap-2 rounded-[var(--radius-panel)] bg-surface p-5 ring-2 ring-ink/10">
                <h3 className="font-display text-lg font-semibold">{r.topic}</h3>
                <p>
                  <span className="font-semibold">Readli: </span>
                  {r.readli}
                </p>
                <p>
                  <span className="font-semibold">{c.name}: </span>
                  {r.them}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="fit-heading" className="flex flex-col gap-3 rounded-[var(--radius-panel)] bg-surface p-6 ring-2 ring-ink/10 sm:p-8">
          <h2 id="fit-heading" className="font-display text-2xl font-semibold">
            {c.name} may suit you better if
          </h2>
          <ul className="flex list-disc flex-col gap-1.5 pl-5" data-testid="they-fit">
            {c.theyFit.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <p>
            Readli is for families who want a loved one&apos;s voice reading real classic books, shared safely across homes.
          </p>
        </section>

        <section aria-labelledby="faq-heading" className="flex flex-col gap-4">
          <h2 id="faq-heading" className="font-display text-3xl font-semibold">
            Questions families ask
          </h2>
          <div className="flex flex-col gap-3" data-testid="comparison-faq">
            {c.faqs.map((f) => (
              <details key={f.q} className="group rounded-[var(--radius-panel)] bg-surface p-5 ring-2 ring-ink/10">
                <summary className="flex min-h-11 cursor-pointer items-center font-display text-lg font-semibold">{f.q}</summary>
                <p className="pt-2">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/try" className={`${buttonPrimary} w-full sm:w-auto`}>
            Hear a story in your voice, free
          </Link>
          <Link href="/signup/family" className={`${buttonSecondary} w-full sm:w-auto`}>
            Start your family
          </Link>
        </div>

        <section aria-labelledby="more-heading" className="flex flex-col gap-2">
          <h2 id="more-heading" className="font-display text-xl font-semibold">
            More comparisons
          </h2>
          <ul className="flex flex-col gap-1">
            {others.map((o) => (
              <li key={o.slug}>
                <Link href={comparisonHref(o.slug)} className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
                  Readli or {o.name}?
                </Link>
              </li>
            ))}
            <li>
              <Link href="/parents/safety" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
                Family privacy &amp; safety
              </Link>
            </li>
          </ul>
        </section>

        <footer className="flex flex-col gap-2 border-t-2 border-ink/10 pt-6 text-sm text-muted" data-testid="comparison-sources">
          <p>
            We put this comparison together from {c.name}&apos;s public website and app store listings in {COMPARISONS_CHECKED}. Products change, so
            check {c.site} for the latest. Spotted something out of date?{" "}
            <a href={`mailto:${COMPANY.email}`} className="underline underline-offset-4">
              Let us know
            </a>{" "}
            and we&apos;ll fix it.
          </p>
          <p>
            Sources:{" "}
            {c.sources.map((s, i) => (
              <span key={s.href}>
                {i > 0 && ", "}
                <a href={s.href} rel="nofollow noopener" target="_blank" className="underline underline-offset-4">
                  {s.label}
                </a>
              </span>
            ))}
            .
          </p>
          <p>
            {c.name} is a trademark of its owner. Readli isn&apos;t affiliated with or endorsed by {c.name}.
          </p>
        </footer>
      </main>
      <SiteFooter />
    </>
  );
}
