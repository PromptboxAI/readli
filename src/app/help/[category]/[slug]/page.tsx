import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/home/SiteHeader";
import { SiteFooter } from "@/components/home/sections";
import { ArticleList, Breadcrumbs, DraftBadge, HelpText, StillNeedHelp, plainAnswer } from "@/components/help/HelpParts";
import { articleHref, getArticle, getCategory, relatedArticles, visibleArticles } from "@/lib/help/search";
import { absoluteUrl, jsonLd, publicPageMetadata } from "@/lib/seo/site";
import { helpArticleTitle } from "@/lib/seo/titles";
import type { HelpArticle } from "@/lib/help/articles";
import { PageLd } from "@/components/seo/PageLd";

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
  return {
    ...publicPageMetadata({
      title: helpArticleTitle(a),
      description: articleDescription(a),
      path: articleHref(a),
      type: "article",
    }),
    robots: a.status === "draft" ? { index: false } : undefined,
  };
}

/** The search snippet: the plain answer, cut to about 155 characters. */
function articleDescription(a: HelpArticle): string {
  const text = plainAnswer(a);
  return text.length > 155 ? `${text.slice(0, 152).trimEnd()}…` : text;
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
      { "@type": "ListItem", position: 1, name: "Help Center", item: absoluteUrl("/help") },
      { "@type": "ListItem", position: 2, name: category.title, item: absoluteUrl(`/help/${category.slug}`) },
      { "@type": "ListItem", position: 3, name: article.question },
    ],
  };

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-12 sm:px-6">
        <PageLd
          path={articleHref(article)}
          title={helpArticleTitle(article)}
          description={articleDescription(article)}
          type="FAQPage"
          extra={{
            mainEntity: [{ "@type": "Question", name: article.question, acceptedAnswer: { "@type": "Answer", text: plainAnswer(article) } }],
          }}
        />
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(breadcrumbLd)} />
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
