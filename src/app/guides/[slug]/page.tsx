import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import { HelpText } from "@/components/help/HelpParts";
import { SiteHeader } from "@/components/home/SiteHeader";
import { SiteFooter } from "@/components/home/sections";
import { FOUNDERS } from "@/lib/content/company";
import { GUIDES, GUIDE_AUTHOR, getGuide, guideHref } from "@/lib/guides/guides";
import { SITE_URL, absoluteUrl, jsonLd, publicPageMetadata } from "@/lib/seo/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const g = getGuide((await params).slug);
  if (!g) return {};
  const meta = publicPageMetadata({ title: `${g.title} | Readli`, description: g.description, path: guideHref(g), type: "article" });
  return {
    ...meta,
    authors: [{ name: GUIDE_AUTHOR.name, url: absoluteUrl(GUIDE_AUTHOR.url) }],
    openGraph: { ...meta.openGraph, publishedTime: g.published, modifiedTime: g.updated, authors: [GUIDE_AUTHOR.name] } as Metadata["openGraph"],
  };
}

function longDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export default async function GuidePage({ params }: { params: Params }) {
  const guide = getGuide((await params).slug);
  if (!guide) notFound();
  const founder = FOUNDERS.find((f) => f.name === GUIDE_AUTHOR.name);
  const others = GUIDES.filter((g) => g.slug !== guide.slug);
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": absoluteUrl(guideHref(guide)),
        headline: guide.title,
        description: guide.description,
        url: absoluteUrl(guideHref(guide)),
        datePublished: guide.published,
        dateModified: guide.updated,
        inLanguage: "en",
        author: { "@type": "Person", name: GUIDE_AUTHOR.name, jobTitle: GUIDE_AUTHOR.title, url: absoluteUrl(GUIDE_AUTHOR.url) },
        publisher: { "@id": `${SITE_URL}/#organization` },
        mainEntityOfPage: absoluteUrl(guideHref(guide)),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Stories & Guides", item: absoluteUrl("/guides") },
          { "@type": "ListItem", position: 2, name: guide.title },
        ],
      },
    ],
  };
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-12 sm:px-6 sm:py-14">
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(ld)} />
        <Link href="/guides" className="w-fit font-display font-semibold underline-offset-4 hover:underline">
          ← Stories &amp; Guides
        </Link>
        <article className="flex flex-col gap-6">
          <header className="flex flex-col gap-4">
            <h1 className="font-display text-4xl font-semibold leading-[1.08] sm:text-5xl">{guide.title}</h1>
            <div className="flex items-center gap-3" data-testid="guide-byline">
              {founder?.photo && <Image src={founder.photo} alt="" width={48} height={48} className="size-12 rounded-full object-cover" />}
              <p className="text-sm">
                By{" "}
                <Link href={GUIDE_AUTHOR.url} className="font-semibold underline underline-offset-4">
                  {GUIDE_AUTHOR.name}
                </Link>
                , {GUIDE_AUTHOR.title}
                <br />
                <span className="text-muted">
                  {guide.updated === guide.published ? (
                    <>
                      Published <time dateTime={guide.published}>{longDate(guide.published)}</time>
                    </>
                  ) : (
                    <>
                      Updated <time dateTime={guide.updated}>{longDate(guide.updated)}</time>
                    </>
                  )}{" "}
                  · {guide.readMinutes} min read
                </span>
              </p>
            </div>
            <p className="text-lg">{guide.intro}</p>
          </header>
          {guide.sections.map((s) => (
            <section key={s.heading} className="flex flex-col gap-3">
              <h2 className="font-display text-2xl font-semibold">{s.heading}</h2>
              {s.paragraphs.map((p) => (
                <p key={p}>
                  <HelpText text={p} />
                </p>
              ))}
            </section>
          ))}
        </article>

        <div className="flex flex-col gap-3 rounded-[var(--radius-panel)] bg-sunshine/45 p-6 sm:p-8">
          <p className="font-display text-2xl font-semibold">Hear a story in your voice</p>
          <p>Record about a minute and hear a classic story read the way only you can. Free, with no account.</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/try" className={`${buttonPrimary} w-full sm:w-auto`}>
              Try your voice free
            </Link>
            <Link href="/signup/family" className={`${buttonSecondary} w-full sm:w-auto`}>
              Start your family
            </Link>
          </div>
        </div>

        <section aria-labelledby="related-heading" className="flex flex-col gap-3">
          <h2 id="related-heading" className="font-display text-2xl font-semibold">
            Related
          </h2>
          <ul className="flex flex-col gap-1">
            {[...guide.related, ...others.map((g) => ({ href: guideHref(g), label: g.title }))].map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
