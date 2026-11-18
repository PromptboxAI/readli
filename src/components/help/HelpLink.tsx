import Link from "next/link";
import type { ReactNode } from "react";

type HelpLinks = Record<string, { href: string; question: string }>;

let links: HelpLinks | null = null;

/** The help articles this build shows, inlined at build time by next.config.ts (and vitest.config.ts). */
function helpLinks(): HelpLinks {
  links ??= JSON.parse(process.env.NEXT_PUBLIC_HELP_LINKS ?? "{}") as HelpLinks;
  return links;
}

/**
 * A small link from a screen to the help article that answers its most common question. Renders
 * nothing while the article is a draft hidden from this build, so it never leads to a missing page;
 * it appears on its own once the article is published.
 */
export function HelpLink({ slug, children, className = "" }: { slug: string; children?: ReactNode; className?: string }) {
  const article = helpLinks()[slug];
  if (!article) return null;
  return (
    <Link href={article.href} data-testid={`help-link-${slug}`} className={`font-semibold underline underline-offset-4 ${className}`}>
      {children ?? article.question}
    </Link>
  );
}
