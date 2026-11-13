import { jsonLd, webPageNode } from "@/lib/seo/site";

/** One JSON-LD block for a public page: its WebPage node plus any other nodes the page describes. */
export function PageLd({ graph = [], ...page }: Parameters<typeof webPageNode>[0] & { graph?: Record<string, unknown>[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd({ "@context": "https://schema.org", "@graph": [webPageNode(page), ...graph] })} />;
}
