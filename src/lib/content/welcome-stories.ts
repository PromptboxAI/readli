import { DEMO_BOOKS, findDemoBook } from "@/lib/content/demo-books";
import { bookText } from "@/lib/narration/text";

/** A demo book this short is read whole in the welcome's Listen step, not just its opening. */
const WHOLE_STORY_MAX_CHARACTERS = 1_500;

/**
 * What the signup welcome (and storyteller setup) reads in a grown-up's own voice for one demo book: the
 * whole book when it's as short as The Lion and the Mouse, so they hear the ending too, otherwise the
 * same opening passage /try reads. Null for a book that has no passage yet.
 */
export function welcomeStoryText(slug: string): string | null {
  const demo = findDemoBook(slug);
  if (!demo?.passageText) return null;
  const book = bookText(slug);
  const whole = book ? book.sentences.map((s) => s.text).join(" ") : "";
  return whole && whole.length <= WHOLE_STORY_MAX_CHARACTERS ? whole : demo.passageText;
}

/** Every demo book's welcome text, for the read-along under the player. */
export function welcomeStoryTexts(): Record<string, string> {
  return Object.fromEntries(DEMO_BOOKS.flatMap((b) => {
    const text = welcomeStoryText(b.slug);
    return text ? [[b.slug, text]] : [];
  }));
}
