import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Book-page samples: a short recording of each book's opening ("How it starts"), made with
 * scripts/book-samples.mjs and saved as public/samples/books/<slug>.mp3. A book shows a play button
 * only once its file exists, so samples can be added a few at a time. Server-only (reads the disk at
 * build time).
 */
export const BOOK_SAMPLE_NARRATOR = "Grandpa Kevin";

export function bookSampleSrc(slug: string): string | null {
  const file = join(process.cwd(), "public", "samples", "books", `${slug}.mp3`);
  return existsSync(file) ? `/samples/books/${slug}.mp3` : null;
}
