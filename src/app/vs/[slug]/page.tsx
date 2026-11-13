import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ComparisonPage } from "@/components/marketing/ComparisonPage";
import { readliFacts } from "@/lib/content/comparison-facts";
import { comparisonHref, comparisons } from "@/lib/content/comparisons";
import { publicPageMetadata } from "@/lib/seo/site";

// Quotes the prices an admin saved, so it renders per request.
export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const slug = (await params).slug;
  const c = comparisons(await readliFacts()).find((x) => x.slug === slug);
  if (!c) return {};
  return publicPageMetadata({ title: `Readli or ${c.name}? How they compare | Readli`, description: c.metaDescription, path: comparisonHref(c.slug) });
}

export default async function ComparisonRoute({ params }: { params: Params }) {
  const slug = (await params).slug;
  const facts = await readliFacts();
  const all = comparisons(facts);
  const c = all.find((x) => x.slug === slug);
  if (!c) notFound();
  return <ComparisonPage c={c} facts={facts} others={all.filter((x) => x.slug !== c.slug)} />;
}
