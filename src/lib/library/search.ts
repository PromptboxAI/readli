/** Case- and accent-insensitive match on title or author. */
export function matchesSearch(book: { title: string; author: string }, query: string): boolean {
  const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const words = fold(query).split(/\s+/).filter(Boolean);
  const hay = fold(`${book.title} ${book.author}`);
  return words.every((w) => hay.includes(w));
}
