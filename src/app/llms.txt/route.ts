import { publicPages } from "@/lib/seo/pages";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, absoluteUrl } from "@/lib/seo/site";

export const dynamic = "force-static";

/** llms.txt (llmstxt.org): a plain summary of Readli and its public pages for AI assistants and search tools. */
export function GET() {
  const pages = publicPages();
  const link = (p: { path: string; title: string }) => `- [${p.title}](${absoluteUrl(p.path)})`;
  const books = pages.filter((p) => p.path.startsWith("/books/"));
  const help = pages.filter((p) => p.path.startsWith("/help"));
  const main = pages.filter((p) => !p.path.startsWith("/books/") && !p.path.startsWith("/help") && p.path !== "/");

  const body = [
    `# ${SITE_NAME}`,
    "",
    `> ${SITE_TAGLINE} ${SITE_DESCRIPTION}`,
    "",
    "Readli is a family read-aloud app for children's stories. A parent, grandparent or other family member records about a minute of their natural storytime voice, and Readli uses it to narrate classic, public-domain storybooks. Family voices are private by default: a child hears a storyteller only after both the storyteller and a parent approve. Readli Voice, for recording and sharing your voice, is free. Readli Family is the paid plan for families who prepare stories for their kids.",
    "",
    "## Main pages",
    "",
    ...main.map(link),
    "",
    "## Library",
    "",
    ...books.map(link),
    "",
    "## Help Center",
    "",
    ...help.map(link),
    "",
  ].join("\n");

  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
