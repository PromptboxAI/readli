/**
 * How two published texts of a book line up, sentence by sentence (Versioned Audiobooks). Safe for
 * the browser: the players use it to keep a listener's place when two narrators read different
 * revisions of the same book.
 */

/**
 * A sentence as a narrator says it. Spacing and the style of quote marks, apostrophes and ellipses
 * aren't spoken, so they never make a sentence count as changed. Words, commas and full stops are
 * (they change the reading's pauses), and so are dashes.
 */
export function spokenForm(sentence: string): string {
  return sentence
    .normalize("NFKC")
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/…/g, "...")
    .replace(/[–—]/g, "—")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Where a listener at sentence `at` of one text should be in another: the same sentence when it is
 * unchanged, otherwise the nearest unchanged sentence before it (so nothing is skipped), otherwise
 * the beginning. Repeated lines match the occurrence nearest the same place.
 */
export function mapPosition(from: readonly string[], to: readonly string[], at: number): number {
  if (from === to) return Math.max(0, Math.min(at, to.length - 1));
  const where = new Map<string, number[]>();
  to.forEach((s, i) => {
    const k = spokenForm(s);
    where.set(k, [...(where.get(k) ?? []), i]);
  });
  for (let i = Math.min(at, from.length - 1); i >= 0; i--) {
    const hits = where.get(spokenForm(from[i]!));
    if (!hits?.length) continue;
    const scale = to.length / Math.max(1, from.length);
    return hits.reduce((best, h) => (Math.abs(h - i * scale) < Math.abs(best - i * scale) ? h : best));
  }
  return 0;
}
