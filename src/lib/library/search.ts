/** Case- and accent-insensitive match on title or author; Spanish books also match "Spanish" and "español". */
export function matchesSearch(book: { title: string; author: string; language?: string }, query: string): boolean {
  const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const words = fold(query).split(/\s+/).filter(Boolean);
  const hay = fold(`${book.title} ${book.author}${book.language === "es" ? " spanish espanol" : ""}`);
  return words.every((w) => hay.includes(w));
}
