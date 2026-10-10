import { coverSrc, DEMO_BOOKS } from "@/lib/content/demo-books";
import { READLI_FABLES } from "./fables";

/**
 * The Readli library catalog: every rights-cleared book with its chapters. The six homepage books
 * carry their opening passage until the full library editions land; the fables collection is a
 * longer, chapter-by-chapter book for trying partial preparation.
 */
export interface CatalogBook {
  slug: string;
  title: string;
  author: string;
  firstPublished: number | null;
  coverUrl: string | null;
  /** Card colour when there is no cover yet. */
  tint: string;
  edition: string;
  chapters: { title: string; text: string }[];
}

export const CATALOG: readonly CatalogBook[] = [
  ...DEMO_BOOKS.filter((b) => b.passageText).map(
    (b): CatalogBook => ({
      slug: b.slug,
      title: b.title,
      author: b.author,
      firstPublished: b.firstPublished,
      coverUrl: coverSrc(b),
      tint: "bg-sunshine",
      edition: b.gutenbergId ? `gutenberg-${b.gutenbergId}` : "readli-passage",
      chapters: [{ title: "Opening", text: b.passageText! }],
    }),
  ),
  {
    slug: "aesops-fables-retold",
    title: "Aesop's Fables",
    author: "Retold by Readli",
    firstPublished: null,
    coverUrl: null,
    tint: "bg-mint",
    edition: "readli-retelling-1",
    chapters: READLI_FABLES,
  },
];

export function findCatalogBook(slug: string): CatalogBook | null {
  return CATALOG.find((b) => b.slug === slug) ?? null;
}
