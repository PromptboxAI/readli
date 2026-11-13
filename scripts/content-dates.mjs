// Writes src/lib/seo/content-dates.json: the date each public page's content last changed, from git
// history, so sitemap.xml can give honest <lastmod> values (SEO audit t_sitemap_fresh). Run it after
// changing page content and commit the result:  npm run seo:dates
// Needs full git history (a shallow clone gives every file the same date).
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { GUIDES, guideHref } from "@/lib/guides/guides";
import { HELP_ARTICLES, HELP_CATEGORIES } from "@/lib/help/articles";
import { articleHref } from "@/lib/help/search";
import { bookPath } from "@/lib/library/paths";
import { publicLibrary } from "@/lib/library/public";
import { publicPages } from "@/lib/seo/pages";

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
if (git("rev-parse", "--is-shallow-repository") === "true") {
  console.error("This clone is shallow, so file dates would be wrong. Run: git fetch --unshallow");
  process.exit(1);
}

const latest = (dates) => dates.filter(Boolean).sort().at(-1) ?? null;
const fileDate = (file) => (existsSync(file) ? git("log", "-1", "--format=%cs", "--", file) || null : null);
const filesDate = (files) => latest(files.map(fileDate));

/** The newest commit date among the lines from the first line matching `start` until the next match of `next`. */
function blockDate(file, start, next) {
  const lines = readFileSync(file, "utf8").split("\n");
  const from = lines.findIndex((l) => l.includes(start));
  if (from < 0) return null;
  let to = lines.findIndex((l, i) => i > from && next.test(l));
  if (to < 0) to = lines.length;
  const blame = git("blame", "--line-porcelain", "-L", `${from + 1},${to}`, "--", file);
  const times = [...blame.matchAll(/^committer-time (\d+)$/gm)].map((m) => Number(m[1]));
  return new Date(Math.max(...times) * 1000).toISOString().slice(0, 10);
}

const page = (p) => `src/app${p === "/" ? "" : p}/page.tsx`;
const EXPLAINER = "src/components/marketing/ExplainerPage.tsx";
/** Fixed pages: the page file plus the modules that hold its words. */
const STATIC = {
  "/": [page("/"), "src/components/home/sections.tsx", "src/components/home/FamilyJourney.tsx", "src/components/home/FamilyVoices.tsx"],
  "/try": [page("/try")],
  "/grandparents": [page("/grandparents")],
  "/pricing": [page("/pricing"), "src/lib/content/pricing.ts", "src/lib/content/credits-explained.ts"],
  "/how-it-works": [page("/how-it-works"), EXPLAINER],
  "/family-voices": [page("/family-voices"), EXPLAINER],
  "/readli-kids": [page("/readli-kids"), EXPLAINER],
  "/guides": [page("/guides")],
  "/books": [page("/books")],
  "/parents/safety": [page("/parents/safety")],
  "/help": [page("/help")],
  "/help/recording-tips": [page("/help/recording-tips"), "src/components/teleprompter/RecordingTips.tsx"],
  "/company": [page("/company"), "src/lib/content/company.ts", "src/lib/content/social.ts"],
  "/donations": [page("/donations")],
  "/privacy": [page("/privacy"), "src/lib/content/privacy-policy.ts"],
  "/terms": [page("/terms"), "src/lib/content/terms.ts"],
  "/accessibility": [page("/accessibility"), "src/lib/content/accessibility.ts"],
};

const dates = {};
for (const [path, files] of Object.entries(STATIC)) dates[path] = filesDate(files);
for (const g of GUIDES) dates[guideHref(g)] = g.updated;
for (const b of publicLibrary()) {
  dates[bookPath(b.slug)] = latest([fileDate(`src/lib/library/texts/${b.slug}.json`), blockDate("src/lib/library/catalog.ts", `slug: "${b.slug}"`, /slug: "/)]);
}
for (const a of HELP_ARTICLES) {
  if (a.status !== "published") continue;
  dates[articleHref(a)] = blockDate("src/lib/help/articles.ts", `slug: "${a.slug}"`, /^\s+slug: "/);
}
for (const c of HELP_CATEGORIES) {
  const inside = HELP_ARTICLES.filter((a) => a.category === c.slug && a.status === "published").map((a) => dates[articleHref(a)]);
  if (inside.length) dates[`/help/${c.slug}`] = latest(inside);
}
// Hub pages change when anything they list changes.
dates["/guides"] = latest([dates["/guides"], ...GUIDES.map((g) => g.updated)]);
dates["/books"] = latest([dates["/books"], ...publicLibrary().map((b) => dates[bookPath(b.slug)])]);
dates["/help"] = latest([dates["/help"], ...Object.entries(dates).filter(([p]) => p.startsWith("/help/")).map(([, d]) => d)]);

const out = {};
for (const p of publicPages()) {
  if (!dates[p.path]) throw new Error(`No content date for ${p.path}: add its source files to STATIC in scripts/content-dates.mjs`);
  out[p.path] = dates[p.path];
}
writeFileSync("src/lib/seo/content-dates.json", `${JSON.stringify(out, null, 2)}\n`);
console.log(`Wrote ${Object.keys(out).length} dates to src/lib/seo/content-dates.json`);
