// Lets plain Node (22.7+, with --experimental-transform-types) import the app's TypeScript modules from a
// script: "@/x" resolves to src/x.ts, and extensionless relative imports get ".ts" (or "/index.ts").
import { existsSync } from "node:fs";
import { register } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

if (import.meta.url.includes("?hooks")) {
  // Loaded as the hooks module below.
} else {
  register(`${import.meta.url}?hooks`, import.meta.url);
}

const SRC = new URL("../src/", import.meta.url);

function withTs(url) {
  const path = fileURLToPath(url);
  if (/\.([cm]?[jt]sx?|json)$/.test(path) && existsSync(path)) return url;
  for (const candidate of [`${path}.ts`, `${path}.tsx`, `${path}/index.ts`]) {
    if (existsSync(candidate)) return pathToFileURL(candidate).href;
  }
  return url;
}

export async function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) return next(withTs(new URL(specifier.slice(2), SRC).href), context);
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
    return next(withTs(new URL(specifier, context.parentURL).href), context);
  }
  return next(specifier, context);
}

// The app imports JSON without `with { type: "json" }` (the bundler allows it); Node needs it said.
export async function load(url, context, next) {
  if (url.endsWith(".json")) return next(url, { ...context, importAttributes: { ...context.importAttributes, type: "json" } });
  return next(url, context);
}
