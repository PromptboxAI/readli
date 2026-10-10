import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/home/SiteHeader";
import { SiteFooter } from "@/components/home/sections";
import { ArticleList, Breadcrumbs, DraftBadge, HelpText, StillNeedHelp, plainAnswer } from "@/components/help/HelpParts";
import { articleHref, getArticle, getCategory, relatedArticles, visibleArticles } from "@/lib/help/search";

// Drafts are left out of the static params, so they 404 on the production site.
export const dynamicParams = false;

export function generateStaticParams() {
  return visibleArticles().map((a) => ({ category: a.category, slug: a.slug }));
}

type Params = Promise<{ category: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { category, slug } = await params;
  const a = getArticle(category, slug);
  if (!a) return {};
  const text = plainAnswer(a);
  return {
    title: `${a.question} | Readli Help Center`,
    description: text.length > 155 ? `${text.slice(0, 152).trimEnd()}…` : text,
    alternates: { canonical: articleHref(a) },
    robots: a.status === "draft" ? { index: false } : undefined,
  };
}

export default async function HelpArticlePage({ params }: { params: Params }) {
  const { category: categorySlug, slug } = await params;
  const article = getArticle(categorySlug, slug);
  const category = getCategory(categorySlug);
  if (!article || !category) notFound();
  const related = relatedArticles(article);

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Help Center", item: "https://readli.ai/help" },
      { "@type": "ListItem", position: 2, name: category.title, item: `https://readli.ai/help/${category.slug}` },
      { "@type": "ListItem", position: 3, name: article.question },
    ],
  };

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-12 sm:px-6">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
        <Breadcrumbs
          items={[
            { href: "/help", label: "Help Center" },
            { href: `/help/${category.slug}`, label: category.title },
            { label: article.question },
          ]}
        />
        <article className="flex flex-col gap-4">
          {article.status === "draft" && (
            <p>
              <DraftBadge />
            </p>
          )}
          <h1 className="font-display text-4xl font-semibold text-plum">{article.question}</h1>
          {article.answer.map((p, i) => (
            <p key={i} className="text-lg leading-relaxed">
              <HelpText text={p} />
            </p>
          ))}
        </article>
        {related.length > 0 && (
          <section aria-labelledby="related-heading" className="flex flex-col gap-4">
            <h2 id="related-heading" className="font-display text-2xl font-semibold">
              Related articles
            </h2>
            <ArticleList articles={related} />
          </section>
        )}
        <StillNeedHelp />
      </main>
      <SiteFooter />
    </>
  );
}
