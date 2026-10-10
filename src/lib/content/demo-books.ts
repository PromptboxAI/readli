/**
 * The six homepage demo books.
 *
 * Originally locked by PRD F-05 / Design Brief §6 / Amendment 001 F-9. Kevin
 * replaced the selection on 2026-10-10 (see docs/decisions.md); that decision
 * supersedes the earlier lock. Order is deliberate (no two bunnies side by side).
 * Do not change titles or order without a new decision.
 *
 * All six are public-domain classics (Kevin, 2026-10-10). Each passage is the
 * opening of the named public-domain text; check the wording against that
 * source before launch (docs/decisions.md). Covers are original Readli
 * artwork, never scans of historic editions.
 */

export interface DemoBook {
  slug: string;
  title: string;
  author: string;
  firstPublished: number;
  /** Project Gutenberg eBook number for the candidate edition; null until chosen. */
  gutenbergId: number | null;
  /** True once a reviewer has confirmed the edition, not just the title. */
  editionConfirmed: boolean;
  editionNote?: string;
  /** Target length of the sample passage, in seconds (brief: <= 45s). */
  passageTargetSeconds: number;
  /** Public-domain excerpt read aloud in the guest's cloned voice; null hides the preview. */
  passageText: string | null;
}

export const DEMO_BOOKS: readonly DemoBook[] = [
  {
    slug: "the-tale-of-peter-rabbit",
    title: "The Tale of Peter Rabbit",
    author: "Beatrix Potter",
    firstPublished: 1902,
    gutenbergId: 14838,
    editionConfirmed: false,
    passageTargetSeconds: 40,
    passageText:
      "Once upon a time there were four little Rabbits, and their names were Flopsy, Mopsy, Cotton-tail, and Peter. They lived with their Mother in a sand-bank, underneath the root of a very big fir-tree. “Now, my dears,” said old Mrs. Rabbit one morning, “you may go into the fields or down the lane, but don't go into Mr. McGregor's garden: your Father had an accident there; he was put in a pie by Mrs. McGregor. Now run along, and don't get into mischief. I am going out.”",
  },
  {
    slug: "the-lion-and-the-mouse",
    title: "The Lion and the Mouse",
    author: "Aesop",
    firstPublished: 1919,
    gutenbergId: null,
    editionConfirmed: false,
    editionNote: "Fable. Passage from The Aesop for Children (1919).",
    passageTargetSeconds: 30,
    passageText:
      "A Lion lay asleep in the forest, his great head resting on his paws. A timid little Mouse came upon him unexpectedly, and in her fright and haste to get away, ran across the Lion's nose. Roused from his nap, the Lion laid his huge paw angrily on the tiny creature to kill her. “Spare me!” begged the poor Mouse. “Please let me go and some day I will surely repay you.” The Lion was much amused to think that a Mouse could ever help him. But he was generous and finally let the Mouse go.",
  },
  {
    slug: "winnie-the-pooh",
    title: "Winnie-the-Pooh",
    author: "A. A. Milne",
    firstPublished: 1926,
    gutenbergId: 67098,
    editionConfirmed: true,
    editionNote: "Original 1926 text, no Disney artwork or later additions.",
    passageTargetSeconds: 45,
    passageText:
      "Here is Edward Bear, coming downstairs now, bump, bump, bump, on the back of his head, behind Christopher Robin. It is, as far as he knows, the only way of coming downstairs, but sometimes he feels that there really is another way, if only he could stop bumping for a moment and think of it. And then he feels that perhaps there isn't. Anyhow, here he is at the bottom, and ready to be introduced to you. Winnie-the-Pooh.",
  },
  {
    slug: "the-three-little-pigs",
    title: "The Three Little Pigs",
    author: "Traditional, from Joseph Jacobs' English Fairy Tales",
    firstPublished: 1890,
    gutenbergId: null,
    editionConfirmed: false,
    editionNote: "Folk tale. Passage from Joseph Jacobs, English Fairy Tales (1890).",
    passageTargetSeconds: 40,
    passageText:
      "Once upon a time when pigs spoke rhyme, and monkeys chewed tobacco, and hens took snuff to make them tough, and ducks went quack, quack, quack, O! There was an old sow with three little pigs, and as she had not enough to keep them, she sent them out to seek their fortune. The first that went off met a man with a bundle of straw, and said to him, “Please, man, give me that straw to build me a house.” Which the man did, and the little pig built a house with it.",
  },
  {
    slug: "the-princess-and-the-pea",
    title: "The Princess and the Pea",
    author: "Hans Christian Andersen",
    firstPublished: 1835,
    gutenbergId: null,
    editionConfirmed: false,
    editionNote: "Passage from H. P. Paull's 1872 English translation (public domain), not Hersholt (1949).",
    passageTargetSeconds: 40,
    passageText:
      "There was once a Prince who wished to marry a Princess; but then she must be a real Princess. He travelled all over the world in hopes of finding such a lady; but there was always something wrong. Princesses he found in plenty; but whether they were real Princesses it was impossible for him to decide, for now one thing, now another, seemed to him not quite right about the ladies. At last he returned to his palace quite cast down, because he wished so much to have a real Princess for his wife.",
  },
  {
    slug: "alices-adventures-in-wonderland",
    title: "Alice’s Adventures in Wonderland",
    author: "Lewis Carroll",
    firstPublished: 1865,
    gutenbergId: 11,
    editionConfirmed: false,
    passageTargetSeconds: 45,
    passageText:
      "Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it, “and what is the use of a book,” thought Alice, “without pictures or conversations?” So she was considering in her own mind, as well as she could, for the hot day made her feel very sleepy and stupid, whether the pleasure of making a daisy-chain would be worth the trouble of getting up and picking the daisies, when suddenly a White Rabbit with pink eyes ran close by her.",
  },
];

/** Original Readli cover art (600x800 WebP in /public/covers). */
export function coverSrc(book: DemoBook): string {
  return `/covers/${book.slug}.webp`;
}

export function gutenbergUrl(book: DemoBook): string | null {
  return book.gutenbergId === null ? null : `https://www.gutenberg.org/ebooks/${book.gutenbergId}`;
}

/** A book offers a voice preview once it has a passage. */
export function isPassagePlayable(book: DemoBook): boolean {
  return book.passageText !== null;
}

export function findDemoBook(slug: string): DemoBook | undefined {
  return DEMO_BOOKS.find((b) => b.slug === slug);
}
