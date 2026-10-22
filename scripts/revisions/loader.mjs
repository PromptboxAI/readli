// Lets plain Node import the app's TypeScript at any commit: "@/..." paths, extensionless
// relative imports, and JSON imports without attributes. Used only by archive.mjs.
import { existsSync, readFileSync, statSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = process.env.REVISIONS_ROOT;
const candidates = (base) => [base, `${base}.ts`, `${base}.tsx`, `${base}.json`, `${base}/index.ts`];

export async function resolve(specifier, context, next) {
  let base = null;
  if (specifier.startsWith("@/")) base = resolvePath(root, "src", specifier.slice(2));
  else if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
    base = resolvePath(dirname(fileURLToPath(context.parentURL)), specifier);
  }
  if (base) {
    const hit = candidates(base).find((p) => existsSync(p) && statSync(p).isFile());
    if (hit) return { url: pathToFileURL(hit).href, shortCircuit: true };
  }
  return next(specifier, context);
}

export async function load(url, context, next) {
  if (url.endsWith(".json")) return { format: "json", source: readFileSync(fileURLToPath(url), "utf8"), shortCircuit: true, importAttributes: { type: "json" } };
  if (url.endsWith(".ts") || url.endsWith(".tsx")) {
    return { format: "module", source: stripTypeScriptTypes(readFileSync(fileURLToPath(url), "utf8")), shortCircuit: true };
  }
  return next(url, context);
}
