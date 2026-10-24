/**
 * Public /books URLs that differ from a book's internal slug. The Owl and the Pussy-Cat is titled
 * "The Owl and the Kitty-Cat" after its language review, so its public page matches the title while
 * narrations, progress and revisions keep the original slug (Kevin, 2026-10-24).
 */
const PUBLIC_SLUGS: Readonly<Record<string, string>> = {
  "the-owl-and-the-pussy-cat": "the-owl-and-the-kitty-cat",
};

/** The slug a book's public page lives at. */
export function publicSlug(slug: string): string {
  return PUBLIC_SLUGS[slug] ?? slug;
}

/** The public page for a book: /books/<public slug>. */
export function bookPath(slug: string): string {
  return `/books/${publicSlug(slug)}`;
}

/** The internal slug for a public /books URL slug. */
export function slugFromPublic(slug: string): string {
  return Object.entries(PUBLIC_SLUGS).find(([, pub]) => pub === slug)?.[0] ?? slug;
}
