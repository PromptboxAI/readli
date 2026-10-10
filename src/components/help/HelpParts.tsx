import Link from "next/link";
import { Fragment } from "react";
import type { HelpArticle, HelpCategory } from "@/lib/help/articles";
import { SUPPORT_EMAIL } from "@/lib/help/articles";
import { articleHref } from "@/lib/help/search";
import { buttonPrimary } from "@/components/brand/buttons";

const TOKEN = /(\[[^\]]+\]\(\/[^)\s]*\)|[\w.+-]+@[\w-]+\.[\w.]+\w)/;

/** Renders an answer paragraph, turning [text](/path) into site links and email addresses into mail links. */
export function HelpText({ text }: { text: string }) {
  return text.split(TOKEN).map((part, i) => {
    if (i % 2 === 0) return <Fragment key={i}>{part}</Fragment>;
    const link = part.match(/^\[([^\]]+)\]\((\/[^)\s]*)\)$/);
    if (link?.[1] && link[2])
      return (
        <Link key={i} href={link[2]} className="font-semibold text-coral-deep underline underline-offset-4">
          {link[1]}
        </Link>
      );
    return (
      <a key={i} href={`mailto:${part}`} className="font-semibold text-coral-deep underline underline-offset-4">
        {part}
      </a>
    );
  });
}

/** Plain-text answer for search snippets and descriptions. */
export function plainAnswer(a: HelpArticle): string {
  return a.answer.join(" ").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

export function DraftBadge() {
  return (
    <span className="rounded-full bg-sunshine px-2 py-0.5 font-sans text-xs font-bold uppercase tracking-wide text-ink">
      Draft: hidden until launch
    </span>
  );
}

const ICONS: Record<HelpCategory["icon"], React.ReactNode> = {
  home: <path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-4.5v-5.5h-5V21H5a1 1 0 0 1-1-1z" />,
  mic: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" />
    </>
  ),
  book: <path d="M12 6.5C10 5 7 4.5 4 5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.5-6 0-8 1.5zm0 0V19" />,
  card: (
    <>
      <rect x="3" y="8" width="18" height="12" rx="2" />
      <path d="M3 12h18M12 8v12M12 8c-1.5-3-5-3.5-5-1s3.5 1 5 1c1.5 0 5 1.5 5-1s-3.5-2-5 1" />
    </>
  ),
  shield: <path d="M12 3 5 6v5.5c0 4.4 3 8 7 9.5 4-1.5 7-5.1 7-9.5V6zm-3 9 2 2 4-4.5" />,
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4 5.3 5.3" />
    </>
  ),
};

export function CategoryIcon({ icon, tint, size = "h-14 w-14" }: { icon: HelpCategory["icon"]; tint: string; size?: string }) {
  return (
    <span aria-hidden className={`grid ${size} shrink-0 place-items-center rounded-2xl ${tint}`}>
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        {ICONS[icon]}
      </svg>
    </span>
  );
}

export function Breadcrumbs({ items }: { items: { href?: string; label: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm">
      <ol className="flex flex-wrap items-center gap-1.5 text-muted">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden>›</span>}
            {item.href ? (
              <Link href={item.href} className="font-semibold text-ink underline-offset-4 hover:underline">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function ArticleList({ articles, showCategory }: { articles: HelpArticle[]; showCategory?: (a: HelpArticle) => string }) {
  return (
    <ul className="divide-y divide-ink/10 overflow-hidden rounded-3xl border-2 border-ink/10 bg-surface">
      {articles.map((a) => (
        <li key={a.slug}>
          <Link href={articleHref(a)} className="flex min-h-14 items-center justify-between gap-4 px-5 py-4 hover:bg-ivory">
            <span className="flex flex-col gap-1">
              <span className="font-display text-lg font-semibold">{a.question}</span>
              {showCategory && <span className="text-sm text-muted">{showCategory(a)}</span>}
              {a.status === "draft" && (
                <span>
                  <DraftBadge />
                </span>
              )}
            </span>
            <span aria-hidden className="text-2xl text-coral-deep">
              ›
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function StillNeedHelp() {
  return (
    <section aria-labelledby="still-need-help" className="flex flex-col items-center gap-3 rounded-3xl bg-mint/40 px-6 py-10 text-center">
      <h2 id="still-need-help" className="font-display text-3xl font-semibold text-plum">
        Still need a hand?
      </h2>
      <p className="text-lg">Our team is happy to help with your Readli experience.</p>
      <a href={`mailto:${SUPPORT_EMAIL}?subject=Readli%20help`} className={`${buttonPrimary} mt-2`}>
        Contact Support
      </a>
      <p className="text-sm text-muted">
        Email us at <span className="font-semibold text-ink">{SUPPORT_EMAIL}</span>
      </p>
    </section>
  );
}

export function SearchBox({ defaultValue = "" }: { defaultValue?: string }) {
  return (
    <form action="/help" method="get" role="search" className="flex w-full max-w-xl gap-2">
      <label htmlFor="help-search" className="sr-only">
        Search help articles
      </label>
      <input
        id="help-search"
        name="q"
        type="search"
        defaultValue={defaultValue}
        placeholder="Search for help"
        className="min-h-12 min-w-0 flex-1 rounded-full border-2 border-ink/20 bg-surface px-5 text-lg placeholder:text-muted focus:border-ink"
      />
      <button type="submit" className={buttonPrimary}>
        Search
      </button>
    </form>
  );
}
