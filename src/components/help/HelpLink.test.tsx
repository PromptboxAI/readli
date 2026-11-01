import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { HELP_ARTICLES } from "@/lib/help/articles";
import { HelpLink } from "./HelpLink";

afterEach(cleanup);

describe("HelpLink", () => {
  it("links a published article by its question, or by the words given", () => {
    const { container, rerender } = render(<HelpLink slug="record-my-voice" />);
    const a = container.querySelector("a")!;
    expect(a.getAttribute("href")).toBe("/help/voices-and-sharing/record-my-voice");
    expect(a.textContent).toBe("How do I record my voice?");
    rerender(<HelpLink slug="record-my-voice">Recording help</HelpLink>);
    expect(container.querySelector("a")!.textContent).toBe("Recording help");
  });

  it("shows nothing for a draft hidden from this build, or an unknown article", () => {
    const draft = HELP_ARTICLES.find((a) => a.status === "draft")!;
    expect(render(<HelpLink slug={draft.slug} />).container.innerHTML).toBe("");
    expect(render(<HelpLink slug="no-such-article" />).container.innerHTML).toBe("");
  });

  it("only names articles that exist", async () => {
    const { readFileSync, readdirSync, statSync } = await import("fs");
    const { join } = await import("path");
    const slugs = new Set(HELP_ARTICLES.map((a) => a.slug));
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (p.endsWith(".tsx") && !p.endsWith(".test.tsx")) files.push(p);
      }
    };
    walk("src");
    const used = files.flatMap((f) => [...readFileSync(f, "utf8").matchAll(/<HelpLink slug="([^"]+)"/g)].map((m) => m[1]!));
    expect(used.length).toBeGreaterThan(5);
    expect(used.filter((s) => !slugs.has(s))).toEqual([]);
  });
});
