/** Alt text for a Readli book cover on public pages, so search engines, AI readers and screen readers know what the picture is. */
export function coverAlt(book: { title: string; author?: string | null; language?: string }): string {
  const by = book.author && book.author !== "Traditional" ? ` by ${book.author}` : "";
  return `Illustrated Readli cover of ${book.title}${by}, a classic ${book.language === "es" ? "Spanish " : ""}children's story`;
}
