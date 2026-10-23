// Scans book texts for outdated or now-offensive language and prints each flagged passage.
// Usage: node scripts/language-scan.mjs [book.json ...]   (no arguments: every book in src/lib/library/texts)
// A book file is { chapters: [{ title, text }] }. Exits 1 when any "change" finding is printed.
import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { scanChapters } from "../src/lib/content/language-check.ts";

const dir = "src/lib/library/texts";
const files = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => join(dir, f));

let mustChange = 0;
for (const file of files) {
  const findings = scanChapters(JSON.parse(readFileSync(file, "utf8")).chapters);
  if (!findings.length) continue;
  console.log(`\n## ${basename(file, ".json")} (${findings.length})`);
  for (const f of findings) {
    if (f.term.level === "change") mustChange++;
    console.log(`- [${f.term.level}] "${f.match}" (${f.term.category}), ch. ${f.chapter} ${f.chapterTitle}: ${f.passage}\n    suggest: ${f.term.suggest}`);
  }
}
console.log(`\n${mustChange} finding(s) to change.`);
process.exit(mustChange ? 1 : 0);
