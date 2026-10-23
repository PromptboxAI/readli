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

/** Books added to the library after launch (Kevin, 2026-10-12). The first six join the homepage shelf on phones only (Kevin, 2026-10-13). */
const ADDED: readonly UpcomingBook[] = [
  { slug: "cinderella", title: "Cinderella", author: "Charles Perrault", firstPublished: 1697, approxMinutes: 16 },
  { slug: "thumbelina", title: "Thumbelina", author: "Hans Christian Andersen", firstPublished: 1835, approxMinutes: 29 },
  { slug: "the-emperors-new-clothes", title: "The Emperor's New Clothes", author: "Hans Christian Andersen", firstPublished: 1837, approxMinutes: 11 },
  { slug: "the-tale-of-mrs-tiggy-winkle", title: "The Tale of Mrs. Tiggy-Winkle", author: "Beatrix Potter", firstPublished: 1905, approxMinutes: 9 },
  { slug: "the-owl-and-the-pussy-cat", title: "The Owl and the Kitty-Cat", author: "Edward Lear", firstPublished: 1871, approxMinutes: 2 },
  { slug: "sleeping-beauty", title: "Sleeping Beauty", author: "The Brothers Grimm", firstPublished: 1812, approxMinutes: 9 },
  { slug: "the-tale-of-two-bad-mice", title: "The Tale of Two Bad Mice", author: "Beatrix Potter", firstPublished: 1904, approxMinutes: 6 },
  { slug: "the-tale-of-mr-jeremy-fisher", title: "The Tale of Mr. Jeremy Fisher", author: "Beatrix Potter", firstPublished: 1906, approxMinutes: 5 },
  { slug: "raggedy-ann-stories", title: "Raggedy Ann Stories", author: "Johnny Gruelle", firstPublished: 1918, approxMinutes: 84 },
  { slug: "a-childs-garden-of-verses", title: "A Child's Garden of Verses", author: "Robert Louis Stevenson", firstPublished: 1885, approxMinutes: 17 },
  { slug: "just-so-stories", title: "Just So Stories", author: "Rudyard Kipling", firstPublished: 1902, approxMinutes: 109 },
  { slug: "heidi", title: "Heidi", author: "Johanna Spyri", firstPublished: 1881, approxMinutes: 333 },
  { slug: "twas-the-night-before-christmas", title: "'Twas the Night Before Christmas", author: "Clement Clarke Moore", firstPublished: 1823, approxMinutes: 3 },
  { slug: "the-tale-of-tom-kitten", title: "The Tale of Tom Kitten", author: "Beatrix Potter", firstPublished: 1907, approxMinutes: 4 },
  { slug: "the-bremen-town-musicians", title: "The Bremen Town Musicians", author: "The Brothers Grimm", firstPublished: 1819, approxMinutes: 6 },
  { slug: "the-golden-goose", title: "The Golden Goose", author: "The Brothers Grimm", firstPublished: 1812, approxMinutes: 6 },
  { slug: "the-jumblies", title: "The Jumblies and Other Nonsense Songs", author: "Edward Lear", firstPublished: 1871, approxMinutes: 9 },
  { slug: "uncle-wiggilys-thanksgiving", title: "Uncle Wiggily's Thanksgiving", author: "Howard R. Garis", firstPublished: 1921, approxMinutes: 8 },
  { slug: "the-three-billy-goats-gruff", title: "The Three Billy Goats Gruff", author: "Asbjørnsen and Moe", firstPublished: 1843, approxMinutes: 2 },
  { slug: "uncle-wiggilys-christmas", title: "Uncle Wiggily's Christmas", author: "Howard R. Garis", firstPublished: 1921, approxMinutes: 10 },
  { slug: "the-tale-of-mrs-tittlemouse", title: "The Tale of Mrs. Tittlemouse", author: "Beatrix Potter", firstPublished: 1910, approxMinutes: 6 },
  { slug: "mother-holle", title: "Mother Holle", author: "The Brothers Grimm", firstPublished: 1812, approxMinutes: 6 },
  { slug: "the-tale-of-timmy-tiptoes", title: "The Tale of Timmy Tiptoes", author: "Beatrix Potter", firstPublished: 1911, approxMinutes: 7 },
  { slug: "the-tale-of-ginger-and-pickles", title: "The Tale of Ginger and Pickles", author: "Beatrix Potter", firstPublished: 1909, approxMinutes: 6 },
  { slug: "the-queen-bee", title: "The Queen Bee", author: "The Brothers Grimm", firstPublished: 1812, approxMinutes: 4 },
  { slug: "five-peas-from-one-pod", title: "Five Peas from One Pod", author: "Hans Christian Andersen", firstPublished: 1852, approxMinutes: 7 },
  { slug: "the-three-sillies", title: "The Three Sillies", author: "Traditional", firstPublished: 1890, approxMinutes: 9 },
  { slug: "the-leaping-match", title: "The Leaping Match", author: "Hans Christian Andersen", firstPublished: 1845, approxMinutes: 4 },
  { slug: "the-happy-family", title: "The Happy Family", author: "Hans Christian Andersen", firstPublished: 1847, approxMinutes: 7 },
  { slug: "the-darning-needle", title: "The Darning-Needle", author: "Hans Christian Andersen", firstPublished: 1845, approxMinutes: 7 },
  { slug: "little-tuk", title: "Little Tuk", author: "Hans Christian Andersen", firstPublished: 1847, approxMinutes: 9 },
  { slug: "gudbrand-on-the-hill-side", title: "Gudbrand on the Hill-side", author: "Asbjørnsen and Moe", firstPublished: 1843, approxMinutes: 8 },
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
  ...[...UPCOMING, ...ADDED].filter((b) => LIBRARY_TEXTS[b.slug]).map(
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

/** Six more books the homepage shelf shows after NEW_BOOKS on phones only (Kevin, 2026-10-13). */
export const MORE_BOOKS_ON_PHONES: readonly UpcomingBook[] = ADDED.slice(0, 6);

export const UPCOMING_BOOKS: readonly UpcomingBook[] = [...UPCOMING, ...ADDED].filter((b) => !LIBRARY_TEXTS[b.slug]);
