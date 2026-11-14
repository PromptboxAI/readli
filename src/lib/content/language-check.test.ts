import { describe, expect, it } from "vitest";
import { CATALOG } from "@/lib/library/catalog";
import { countByTerm, LANGUAGE_TERMS, scanChapters, SPANISH_LANGUAGE_TERMS, termsFor } from "./language-check";
import { LANGUAGE_REVIEW } from "./language-review";

const scan = (text: string) => scanChapters([{ title: "", text }]).map((f) => f.term.id);

describe("outdated-language scanner", () => {
  it("flags words whose meaning has changed", () => {
    expect(scan("O lovely Pussy! O Pussy, my love")).toEqual(["pussy", "pussy"]);
    expect(scan("known as Cinder-slut")).toEqual(["slut"]);
    expect(scan("a bundle of faggots and a colored fellow")).toEqual(["fag", "colored-person"]);
    expect(scan("Tom Tits-mouse and Cock Robin")).toEqual(["tits", "cock"]);
    expect(scan("“Nonsense!” she ejaculated.")).toEqual(["ejaculate"]);
  });

  it("matches whole words only", () => {
    expect(scan("a cockchafer in Japan sat on a hassock by the Cheshire Cat")).toEqual([]);
    expect(scan("they were colored faces in the pool")).toEqual([]);
  });

  it("quotes the sentence each word sits in", () => {
    const [finding] = scanChapters([{ title: "Ch", text: "It was late. Everything is queer to-day! Then she slept." }]);
    expect(finding?.passage).toBe("Everything is queer to-day!");
  });

  it("gives every term a reason and a replacement", () => {
    for (const terms of [LANGUAGE_TERMS, SPANISH_LANGUAGE_TERMS]) {
      for (const t of terms) expect(t.why && t.suggest && t.pattern.flags.includes("g")).toBeTruthy();
      expect(new Set(terms.map((t) => t.id)).size).toBe(terms.length);
    }
  });

  it("scans Spanish books with Spanish terms, whole words only", () => {
    const es = (text: string) => scanChapters([{ title: "", text }], termsFor("es")).map((f) => f.term.id);
    expect(es("La madre cogió un clavel y lo recogió después.")).toEqual(["es-coger"]);
    expect(es("Abrió su negro pico; la negrura de la noche.")).toEqual(["es-negro"]);
    expect(es("Era un idiota, dijo, y el moro se fue.")).toEqual(["es-idiota", "es-moro"]);
    expect(es("La morada del ratón, con su chinchilla.")).toEqual([]);
    expect(termsFor("en")).toBe(LANGUAGE_TERMS);
  });

  // Kevin, 2026-10-22: every book is scanned before it joins the library. A new or edited book with
  // a flagged word fails here until the passages are reviewed (node scripts/language-scan.mjs <book.json>)
  // and recorded in language-review.ts.
  it.each(CATALOG.map((b) => [b.slug, b] as const))("%s matches its language review", (slug, book) => {
    const findings = scanChapters([{ title: book.title, text: "" }, ...book.chapters], termsFor(book.language));
    const reviewed = Object.fromEntries(Object.entries(LANGUAGE_REVIEW[slug] ?? {}).map(([id, r]) => [id, r.count]));
    const unreviewed = findings.filter((f) => !(f.term.id in reviewed)).map((f) => `${f.match}: ${f.passage}`);
    expect(unreviewed, `unreviewed language in ${slug}`).toEqual([]);
    expect(countByTerm(findings)).toEqual(reviewed);
  });

  it("only reviews books in the catalog", () => {
    const slugs = new Set(CATALOG.map((b) => b.slug));
    for (const slug of Object.keys(LANGUAGE_REVIEW)) expect(slugs).toContain(slug);
  });
});
