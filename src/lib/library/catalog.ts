import { coverSrc, DEMO_BOOKS } from "@/lib/content/demo-books";
import { READLI_FABLES } from "./fables";
import { LIBRARY_TEXTS } from "./texts";

/**
 * The Readli library catalog: every rights-cleared book with its chapters. Books with an imported
 * public-domain edition (./texts) carry their full text in real chapters; the homepage keeps its own
 * short passages in DEMO_BOOKS. The fables collection is Readli's own retelling.
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

/**
 * Books whose covers are in but whose public-domain text hasn't been imported yet. They show in the
 * family library as "coming soon" and join CATALOG (with chapters) once their edition is confirmed.
 */
export interface UpcomingBook {
  slug: string;
  title: string;
  author: string;
  firstPublished: number;
  coverUrl: string;
  /** Rough listening time for the full story. */
  approxMinutes: number;
}

const UPCOMING: readonly UpcomingBook[] = [
  { slug: "the-little-red-hen", title: "The Little Red Hen", author: "Traditional", firstPublished: 1874, approxMinutes: 3 },
  { slug: "the-gingerbread-man", title: "The Gingerbread Man", author: "Traditional", firstPublished: 1875, approxMinutes: 6 },
  { slug: "the-elves-and-the-shoemaker", title: "The Elves and the Shoemaker", author: "The Brothers Grimm", firstPublished: 1812, approxMinutes: 6 },
  { slug: "goldilocks-and-the-three-bears", title: "Goldilocks and the Three Bears", author: "Traditional", firstPublished: 1837, approxMinutes: 7 },
  { slug: "the-velveteen-rabbit", title: "The Velveteen Rabbit", author: "Margery Williams", firstPublished: 1922, approxMinutes: 28 },
  { slug: "the-ugly-duckling", title: "The Ugly Duckling", author: "Hans Christian Andersen", firstPublished: 1843, approxMinutes: 30 },
].map((b) => ({ ...b, coverUrl: `/covers/${b.slug}.webp` }));

export const CATALOG: readonly CatalogBook[] = [
  ...DEMO_BOOKS.filter((b) => LIBRARY_TEXTS[b.slug] || b.passageText).map(
    (b): CatalogBook => ({
      slug: b.slug,
      title: b.title,
      author: b.author,
      firstPublished: b.firstPublished,
      coverUrl: coverSrc(b),
      tint: "bg-sunshine",
      ...(LIBRARY_TEXTS[b.slug] ?? {
        edition: b.gutenbergId ? `gutenberg-${b.gutenbergId}` : "readli-passage",
        chapters: [{ title: "Opening", text: b.passageText! }],
      }),
    }),
  ),
  ...UPCOMING.filter((b) => LIBRARY_TEXTS[b.slug]).map(
    (b): CatalogBook => ({ slug: b.slug, title: b.title, author: b.author, firstPublished: b.firstPublished, coverUrl: b.coverUrl, tint: "bg-sunshine", ...LIBRARY_TEXTS[b.slug]! }),
  ),
  {
    slug: "aesops-fables-retold",
    title: "Aesop's Fables",
    author: "Retold by Readli",
    firstPublished: null,
    coverUrl: "/covers/aesops-fables-retold.webp",
    tint: "bg-mint",
    edition: "readli-retelling-1",
    chapters: READLI_FABLES,
  },
];

export function findCatalogBook(slug: string): CatalogBook | null {
  return CATALOG.find((b) => b.slug === slug) ?? null;
}

/** The six newest books, shown on the homepage shelf whether or not their full text is in yet. */
export const NEW_BOOKS: readonly UpcomingBook[] = UPCOMING;

export const UPCOMING_BOOKS: readonly UpcomingBook[] = UPCOMING.filter((b) => !LIBRARY_TEXTS[b.slug]);
