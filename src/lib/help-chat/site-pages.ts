import { publicPages, type PublicPage } from "@/lib/seo/pages";

/**
 * The help chatbot reads the site's public pages as visitors see them (Kevin, 2026-11-15: it didn't
 * know about /donations). The list comes from the sitemap's publicPages(), so a page added there is
 * in the bot's knowledge on the next deploy without touching this file. Pages whose content the bot
 * already gets from source (Help Center, guides, the library, legal pages) are skipped.
 */

const FROM_SOURCE = [/^\/help(\/(?!recording-tips$).*)?$/, /^\/guides(\/.*)?$/, /^\/books(\/.*)?$/, /^\/(privacy|terms|accessibility)$/];

export function pagesToRead(pages: PublicPage[] = publicPages()): PublicPage[] {
  return pages.filter((p) => !FROM_SOURCE.some((re) => re.test(p.path)));
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", mdash: "—", ndash: "–", hellip: "…", middot: "·", copy: "©" };

function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1]?.toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

const stripTags = (s: string) => s.replace(/<[^>]+>/g, " ");
const MAX_PAGE_CHARS = 12_000;

/** The readable text of a page's <main>, with Readli links kept as [text](/path) and headings and lists marked. */
export function htmlToText(html: string): string {
  const main = html.match(/<main\b[^>]*>([\s\S]*)<\/main>/i)?.[1] ?? "";
  let s = main
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|svg|noscript|template|iframe|video|audio)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<a\b[^>]*\bhref="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href: string, inner: string) => {
      const text = decode(stripTags(inner)).replace(/\s+/g, " ").trim();
      if (!text) return " ";
      return href.startsWith("/") && !href.startsWith("//") ? ` [${text}](${decode(href)}) ` : ` ${text} `;
    })
    .replace(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi, (_, inner: string) => `\n### ${stripTags(inner)}\n`)
    .replace(/<li\b[^>]*>/gi, "\n- ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|article|header|footer|ul|ol|li|tr|dt|dd|summary|details|figure|figcaption|blockquote|table)>/gi, "\n");
  s = decode(stripTags(s));
  const lines = s
    .split("\n")
    .map((l) => l.replace(/[ \t ]+/g, " ").trim())
    .filter((l) => l && l !== "-" && l !== "###");
  const out: string[] = [];
  for (const l of lines) if (out.at(-1) !== l) out.push(l);
  return out.join("\n").slice(0, MAX_PAGE_CHARS);
}

/** Fetches and converts each page. Pages that fail or time out are left out; the rest still count. */
export async function readSitePages(
  origin: string,
  pages: PublicPage[] = pagesToRead(),
  opts: { headers?: Record<string, string>; timeoutMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<{ text: string; read: number; total: number }> {
  const doFetch = opts.fetchImpl ?? fetch;
  const results: (string | null)[] = new Array(pages.length).fill(null);
  let next = 0;
  async function worker() {
    while (next < pages.length) {
      const i = next++;
      const page = pages[i]!;
      try {
        const res = await doFetch(new URL(page.path, origin), {
          headers: { "user-agent": "ReadliHelpChat/1.0", ...opts.headers },
          signal: AbortSignal.timeout(opts.timeoutMs ?? 8_000),
          cache: "no-store",
        });
        if (!res.ok || !res.headers.get("content-type")?.includes("text/html")) continue;
        const text = htmlToText(await res.text());
        if (text.length > 40) results[i] = `## ${page.title} (${page.path})\n${text}`;
      } catch {}
    }
  }
  await Promise.all(Array.from({ length: Math.min(6, pages.length) }, worker));
  const found = results.filter((r): r is string => r !== null);
  return {
    text: found.length ? ["# Readli website pages, as visitors see them", ...found].join("\n\n") : "",
    read: found.length,
    total: pages.length,
  };
}
