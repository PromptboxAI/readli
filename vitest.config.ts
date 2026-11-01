import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";
import { helpLinkMap } from "./src/lib/help/search";

export default defineConfig({
  oxc: { jsx: { runtime: "automatic" } },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { environment: "jsdom", include: ["src/**/*.test.{ts,tsx}"], env: { NEXT_PUBLIC_HELP_LINKS: JSON.stringify(helpLinkMap(false)) } },
});
