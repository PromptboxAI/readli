// Tells IndexNow search engines (Bing, Yandex and others; not Google) which pages changed in a production
// deploy (SEO audit t_sitemap_fresh). Run by .github/workflows/indexnow.yml after Vercel reports a
// successful production deployment. It submits the pages whose date in src/lib/seo/content-dates.json is
// new or different from the previous commit. With --all it submits every public page.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const HOST = "readli.ai";
const KEY_FILE = "public/indexnow-key.txt";
const DATES = "src/lib/seo/content-dates.json";

const key = readFileSync(KEY_FILE, "utf8").trim();
const now = JSON.parse(readFileSync(DATES, "utf8"));
let before = {};
if (!process.argv.includes("--all")) {
  try {
    before = JSON.parse(execFileSync("git", ["show", `HEAD^:${DATES}`], { encoding: "utf8" }));
  } catch {
    before = {};
  }
}
const changed = Object.keys(now).filter((p) => before[p] !== now[p]);
if (changed.length === 0) {
  console.log("No page content changed in this deploy, so nothing to submit.");
  process.exit(0);
}

const urlList = changed.map((p) => `https://${HOST}${p}`);
const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: HOST, key, keyLocation: `https://${HOST}/indexnow-key.txt`, urlList }),
});
console.log(`IndexNow answered ${res.status} for ${urlList.length} URL(s):\n${urlList.join("\n")}`);
// 200 and 202 mean accepted. Anything else is reported but does not fail the deploy.
if (res.status !== 200 && res.status !== 202) console.log(await res.text());
