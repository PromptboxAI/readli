import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/home/SiteHeader";
import { SiteFooter } from "@/components/home/sections";
import { ArticleList, Breadcrumbs, CategoryIcon, SearchBox, StillNeedHelp } from "@/components/help/HelpParts";
import { HELP_CATEGORIES } from "@/lib/help/articles";
import { articlesIn, getCategory } from "@/lib/help/search";
import { publicPageMetadata } from "@/lib/seo/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return HELP_CATEGORIES.map((c) => ({ category: c.slug }));
}

type Params = Promise<{ category: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const c = getCategory((await params).category);
  if (!c) return {};
  return {
    ...publicPageMetadata({
      title: `${c.title} | Readli Help Center`,
      description: `${c.blurb}. Answers from the Readli Help Center.`,
      path: `/help/${c.slug}`,
    }),
    // A category with nothing live in it yet is an empty page, so it stays out of search until it fills.
    robots: articlesIn(c.slug).length === 0 ? { index: false } : undefined,
  };
}

export default async function HelpCategoryPage({ params }: { params: Params }) {
  const category = getCategory((await params).category);
  if (!category) notFound();
  const articles = articlesIn(category.slug);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-12 sm:px-6">
        <Breadcrumbs items={[{ href: "/help", label: "Help Center" }, { label: category.title }]} />
        <header className="flex items-center gap-4">
          <CategoryIcon icon={category.icon} tint={category.tint} size="h-16 w-16" />
          <div className="flex flex-col gap-1">
            <h1 className="font-display text-4xl font-semibold text-plum">{category.title}</h1>
            <p className="text-lg text-muted">{category.blurb}</p>
          </div>
        </header>
        <SearchBox />
        {articles.length > 0 ? (
          <ArticleList articles={articles} />
        ) : (
          <p className="rounded-3xl bg-sunshine/30 p-5 text-lg">
            Answers for this topic are on the way and will appear here when Readli Family launches. In the meantime, see{" "}
            <Link href="/help/getting-started/what-is-readli" className="font-semibold underline underline-offset-4">
              What is Readli?
            </Link>{" "}
            or email us with any question.
          </p>
        )}
        {category.slug === "privacy-and-child-safety" && (
          <p className="text-lg">
            For the full details, read our{" "}
            <Link href="/privacy" className="font-semibold text-coral-deep underline underline-offset-4">
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link href="/parents/safety" className="font-semibold text-coral-deep underline underline-offset-4">
              Family privacy &amp; safety
            </Link>{" "}
            guide.
          </p>
        )}
        <StillNeedHelp />
      </main>
      <SiteFooter />
    </>
  );
}
