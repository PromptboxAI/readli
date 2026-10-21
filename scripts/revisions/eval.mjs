// Prints every catalog book's text exactly as the checkout at REVISIONS_ROOT built it: slug,
// edition, revision and the sentences of each chapter. Run by archive.mjs, one commit at a time.
import { existsSync } from "node:fs";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register(pathToFileURL(new URL("./loader.mjs", import.meta.url).pathname).href);
const root = process.env.REVISIONS_ROOT;
const load = (path) => import(pathToFileURL(`${root}/src/${path}`).href);
const { bookText } = await load("lib/narration/text.ts");
const slugs = existsSync(`${root}/src/lib/library/catalog.ts`)
  ? (await load("lib/library/catalog.ts")).CATALOG.map((b) => b.slug)
  : (await load("lib/content/demo-books.ts")).DEMO_BOOKS.map((b) => b.slug);
const out = [];
for (const slug of slugs) {
  const text = bookText(slug);
  if (!text) continue;
  const byId = new Map(text.sentences.map((s) => [s.id, s.text]));
  const chapters = text.chapters.map((c) => ({ title: c.title, sentences: c.sentenceIds.map((id) => byId.get(id)) }));
  // The closing "The End." is outside the revision and added by the app (since #101), so a snapshot keeps only the story.
  const last = chapters.at(-1)?.sentences;
  if (last?.at(-1) === "The End.") last.pop();
  out.push({ slug, title: text.title, edition: text.edition, revision: text.revision, chapters });
}
process.stdout.write(JSON.stringify(out));
