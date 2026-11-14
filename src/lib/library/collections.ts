import type { PublicBook } from "./public";

/**
 * Bedtime story collections (SleepyTale review, 2026-11): public hub pages that group the library the
 * way parents search for it, by author, length and kind of story. Every book still lives on its own
 * /books page; a collection only gathers them, with original writing around them so each page is worth
 * reading on its own. Facts about Readli must match the Help Center. Paragraphs use the Help Center's
 * link syntax, [text](/path).
 */
export interface Collection {
  slug: string;
  /** Short name for cards and links, e.g. "Hans Christian Andersen". */
  name: string;
  /** The page heading and search title. */
  title: string;
  /** About 150 characters: the search snippet and the card text on /bedtime-stories. */
  description: string;
  intro: string[];
  /** A book on the shelf whose opening plays at the top of the page. */
  featured: string;
  /** A second heading with a little more to read: why these suit bedtime, or how to read them. */
  more: { heading: string; paragraphs: string[] };
  faqs: { q: string; a: string }[];
  /** Which library books belong. Coming-soon books are included and labelled. */
  includes: (book: PublicBook) => boolean;
  tint: string;
}

const by = (...authors: string[]) => (b: PublicBook) => authors.includes(b.author);
const slugs = (...list: string[]) => (b: PublicBook) => list.includes(b.slug);

export const COLLECTIONS: readonly Collection[] = [
  {
    slug: "short-bedtime-stories",
    name: "Short bedtime stories",
    title: "Short bedtime stories, five minutes or less",
    description: "Classic bedtime stories that take five minutes or less to read aloud, from fables and nursery tales to Beatrix Potter, read in your family's own voices.",
    intro: [
      "Some nights there's time for a chapter. Most nights there's time for one short story before the lights go out. These are the classics in the Readli library that take five minutes or less to read aloud, so bedtime ends on time without anyone missing their story.",
      "You'll find fables with a lesson in the last line, nursery tales with a satisfying repeat, Beatrix Potter's small animals and a few poems. The reading time on each card is how long the story takes when read aloud at a calm bedtime pace.",
    ],
    featured: "the-three-billy-goats-gruff",
    more: {
      heading: "Why short stories work at bedtime",
      paragraphs: [
        "A short story has a clear ending, and that matters at bedtime. Children settle more easily when they know the story will finish, and a story that ends before they fall asleep is one they can ask for again tomorrow.",
        "Short stories are also the cheapest to prepare. Most of these use just a few of your monthly narration credits in one voice, so it's easy to have the same story ready in Mom's voice and Grandpa's. See [how credits work](/pricing#credits).",
      ],
    },
    faqs: [
      { q: "How long is a short bedtime story?", a: "Every story on this page takes five minutes or less to read aloud at a calm bedtime pace. Several take under two minutes." },
      { q: "Can my child hear the same short story in different voices?", a: "Yes. Prepare it once in each storyteller's voice, and your child can switch between approved storytellers without losing their place." },
    ],
    includes: (b) => !b.comingSoon && b.minutes <= 5 && b.language === "en",
    tint: "bg-sunshine/60",
  },
  {
    slug: "fairy-tales",
    name: "Classic fairy tales",
    title: "Classic fairy tales to read aloud",
    description: "Cinderella, Rumpelstiltskin, The Ugly Duckling and more: classic fairy tales from Andersen, the Brothers Grimm and Perrault, read aloud in the voices your kids love.",
    intro: [
      "Fairy tales were told aloud long before anyone wrote them down, which is why they still sound best read by someone you love. This shelf gathers the fairy tales in the Readli library: the Brothers Grimm's German tales, Hans Christian Andersen's Danish ones, Charles Perrault's French classics and the old English and Norwegian tales that children have asked for again and again.",
      "Each one is the real public-domain text, not a summary. Open any book to read how it starts, word for word, and listen to a sample before you choose.",
    ],
    featured: "the-frog-prince",
    more: {
      heading: "Reading fairy tales with young children",
      paragraphs: [
        "Old fairy tales can be surprising. Wolves get eaten, wicked stepmothers get what's coming, and not every ending is tidy. Most children love that, because the story takes their fears seriously and still ends with the brave and kind coming out on top.",
        "If you're not sure a tale suits your child, read its opening on the book page first. A few very old words have changed meaning since these were written, and Readli swaps those for gentle ones before a book joins the library. Everything else stays as the author wrote it.",
      ],
    },
    faqs: [
      { q: "Are these the original fairy tales or retellings?", a: "They're the original public-domain texts, mostly in classic English translations. The only changes are a handful of old words whose meaning has turned hurtful, which Readli replaces with gentle ones." },
      { q: "Which fairy tales are shortest?", a: "Sweet Porridge, The Star Money and The Three Billy Goats Gruff each take under three minutes. Thumbelina and The Ugly Duckling take closer to twenty minutes, in chapters you can spread over a few nights." },
    ],
    includes: (b) =>
      b.slug !== "the-real-mother-goose" &&
      ["Hans Christian Andersen", "The Brothers Grimm", "Charles Perrault", "Andrew Lang", "Asbjørnsen and Moe", "Traditional", "Traditional, from Joseph Jacobs' English Fairy Tales"].includes(b.author),
    tint: "bg-lavender/70",
  },
  {
    slug: "hans-christian-andersen",
    name: "Hans Christian Andersen",
    title: "Hans Christian Andersen stories for bedtime",
    description: "The Princess and the Pea, Thumbelina, The Ugly Duckling and more of Hans Christian Andersen's fairy tales, read aloud in your family's own voices.",
    intro: [
      "Hans Christian Andersen was a Danish writer who published his first fairy tales in 1835 and kept writing them for most of his life. Unlike the Brothers Grimm, who collected stories people already told, Andersen made most of his up, and you can hear it: his tales are full of talking toys, flowers, needles and peas, each with feelings of its own.",
      "This shelf has the Andersen stories in the Readli library, from The Princess and the Pea, short enough for any bedtime, to longer tales like Thumbelina and The Nightingale.",
    ],
    featured: "the-princess-and-the-pea",
    more: {
      heading: "Why Andersen suits bedtime",
      paragraphs: [
        "Andersen wrote for children and the grown-ups reading to them at the same time. A child hears a little duckling who doesn't fit in; the parent hears something about growing up. That makes his stories good ones to share, and good ones to talk about after the light goes out.",
        "Ole-Luk-Oie, the Dream God, is a bedtime story about bedtime itself: a little man who visits children at night with an umbrella of dreams. It's a lovely one to save for a child who doesn't want to go to sleep.",
      ],
    },
    faqs: [
      { q: "What are Hans Christian Andersen's most famous stories?", a: "The Little Mermaid, The Ugly Duckling, The Princess and the Pea, Thumbelina, The Emperor's New Clothes and The Nightingale are among the best known. The last five are in the Readli library." },
      { q: "Are Andersen's stories too sad for young children?", a: "A few are sad, but many are funny or gentle. The Princess and the Pea, The Emperor's New Clothes and The Leaping Match are good first choices for little ones." },
    ],
    includes: by("Hans Christian Andersen"),
    tint: "bg-sky/60",
  },
  {
    slug: "brothers-grimm",
    name: "The Brothers Grimm",
    title: "Brothers Grimm fairy tales for bedtime",
    description: "Rumpelstiltskin, The Frog Prince, The Bremen Town Musicians and more Brothers Grimm fairy tales, read aloud in the voices of the people your kids love.",
    intro: [
      "Jacob and Wilhelm Grimm were two German brothers who collected the stories people told by the fire and published the first volume of them in 1812. Their book gave the world Rumpelstiltskin, The Frog Prince, Sleeping Beauty and hundreds more, and it has been read to children ever since.",
      "This shelf has the Grimm tales in the Readli library. Many take five minutes or less, which makes them some of the easiest classics to fit into a busy bedtime.",
    ],
    featured: "the-bremen-town-musicians",
    more: {
      heading: "Good Grimm tales to start with",
      paragraphs: [
        "For the very young, Sweet Porridge and The Star Money are short and gentle. The Bremen Town Musicians, about four old animals who set off to become musicians, is funny and has plenty of animal noises for a storyteller to enjoy.",
        "Older children love the cleverness in Rumpelstiltskin and The Golden Goose, where the youngest and kindest wins in the end. You can read the opening of any tale on its book page before you choose.",
      ],
    },
    faqs: [
      { q: "Are Brothers Grimm stories scary?", a: "Some are. The brothers collected folk tales, and folk tales have witches and wolves in them. The shorter ones here, like Sweet Porridge, The Star Money and The Elves and the Shoemaker, are gentle choices for younger children." },
      { q: "How long are the Grimm fairy tales?", a: "Most in the Readli library take between one and ten minutes to read aloud. The Fisherman and His Wife is the longest, at about a quarter of an hour." },
    ],
    includes: by("The Brothers Grimm"),
    tint: "bg-mint",
  },
  {
    slug: "beatrix-potter",
    name: "Beatrix Potter",
    title: "Beatrix Potter stories read aloud",
    description: "Peter Rabbit, Benjamin Bunny, Mrs. Tiggy-Winkle and more of Beatrix Potter's little books, read aloud in your family's own voices.",
    intro: [
      "Beatrix Potter wrote The Tale of Peter Rabbit for a little boy who was ill in bed, as a letter. It was published as a small book in 1902, sized for small hands, and more than twenty other little books followed, full of rabbits, mice, hedgehogs and kittens who behave almost, but not quite, like people.",
      "This shelf has the Beatrix Potter books in the Readli library. Most take under ten minutes to read aloud, and The Story of Miss Moppet takes about one.",
    ],
    featured: "the-tale-of-peter-rabbit",
    more: {
      heading: "Reading Beatrix Potter aloud",
      paragraphs: [
        "Potter never wrote down to children. Her sentences are short but her words are rich, like \"soporific\" in The Tale of the Flopsy Bunnies, and children love hearing grand words in a gentle voice. Read slowly and let the pictures in their heads do the work.",
        "The books link together, too. Benjamin Bunny is Peter Rabbit's cousin, and the Flopsy Bunnies are Benjamin's children, so it's fun to read them in order over a week of bedtimes.",
      ],
    },
    faqs: [
      { q: "What order should I read the Beatrix Potter books in?", a: "Start with The Tale of Peter Rabbit, then The Tale of Benjamin Bunny and The Tale of the Flopsy Bunnies, which carry on the same family's story. The rest can be read in any order." },
      { q: "What age are Beatrix Potter stories for?", a: "They're loved from about age two, and older children enjoy the rich words and sly humor. Most take under ten minutes to read aloud." },
    ],
    includes: by("Beatrix Potter"),
    tint: "bg-coral/25",
  },
  {
    slug: "aesops-fables",
    name: "Aesop's fables",
    title: "Aesop's fables for kids, read aloud",
    description: "The Lion and the Mouse, The Tortoise and the Hare and more of Aesop's fables for children: short stories with a lesson, read in your family's own voices.",
    intro: [
      "Aesop is said to have been a storyteller in ancient Greece, more than 2,500 years ago. Whether or not he really lived, the fables told in his name have lasted because they're short, they're about animals, and each one ends with something worth remembering: slow and steady wins the race, and even the smallest friend can help.",
      "The Readli library has Aesop's fables in our own retelling for young children, The Lion and the Mouse on its own, and More Aesop's Fables from a classic 1919 collection for children.",
    ],
    featured: "the-lion-and-the-mouse",
    more: {
      heading: "Fables make good bedtime talks",
      paragraphs: [
        "A fable takes a minute or two to read, and the moral at the end is a natural place to stop and ask your child what they think. Was the hare silly? Would they have helped the lion? It's an easy way to turn story time into talking time.",
        "Because each fable is so short, a collection works well a few at a time. Read two or three, and save the rest for tomorrow.",
      ],
    },
    faqs: [
      { q: "What is a fable?", a: "A fable is a very short story, usually about animals who talk, that ends with a lesson or moral. Aesop's are the most famous." },
      { q: "Are Aesop's fables good for toddlers?", a: "Yes. Most take a minute or two to read aloud, and the animals and clear lessons suit children from about age two." },
    ],
    includes: (b) => b.author === "Aesop" || b.slug === "aesops-fables-retold",
    tint: "bg-sunshine/60",
  },
  {
    slug: "bedtime-poems-and-nursery-rhymes",
    name: "Poems and nursery rhymes",
    title: "Bedtime poems and nursery rhymes",
    description: "Mother Goose, A Child's Garden of Verses, Wynken, Blynken, and Nod and more classic bedtime poems and nursery rhymes, read in the voices your kids love.",
    intro: [
      "Rhymes are often the first stories a child knows by heart. This shelf gathers the poetry in the Readli library: Mother Goose's nursery rhymes, Robert Louis Stevenson's A Child's Garden of Verses, Edward Lear's nonsense songs, A. A. Milne's When We Were Very Young and Eugene Field's lullabies, including Wynken, Blynken, and Nod.",
      "Poems are made to be heard. The rhythm that makes them easy to remember is also what makes them so soothing in a familiar voice at the end of the day.",
    ],
    featured: "wynken-blynken-and-nod",
    more: {
      heading: "Why rhymes help at bedtime",
      paragraphs: [
        "A steady rhythm slows everyone down, the reader included. Children who can't sit still for a long story will often lie quietly through a few short verses, and they soon start filling in the rhyming word themselves.",
        "Stevenson's Bed in Summer, about having to go to bed while it's still light outside, has been read to children who don't want to go to sleep for well over a hundred years. It's in A Child's Garden of Verses.",
      ],
    },
    faqs: [
      { q: "What are good bedtime poems for kids?", a: "Wynken, Blynken, and Nod by Eugene Field, Bed in Summer from A Child's Garden of Verses, and The Owl and the Kitty-Cat by Edward Lear are classic choices, and all three are in the Readli library." },
      { q: "Why is it called The Owl and the Kitty-Cat?", a: "A word in Edward Lear's original title has since changed meaning, so Readli uses kitty-cat instead. Everything else in the poem stays as Lear wrote it." },
    ],
    includes: slugs(
      "the-real-mother-goose",
      "a-childs-garden-of-verses",
      "the-owl-and-the-pussy-cat",
      "the-jumblies",
      "when-we-were-very-young",
      "wynken-blynken-and-nod",
      "johnny-crows-garden",
      "twas-the-night-before-christmas",
    ),
    tint: "bg-lavender/70",
  },
  {
    slug: "christmas-stories",
    name: "Christmas and holiday stories",
    title: "Christmas and holiday stories to read aloud",
    description: "'Twas the Night Before Christmas, The Velveteen Rabbit and Uncle Wiggily's Christmas and Thanksgiving, read aloud in the voices of the people your kids love.",
    intro: [
      "Some stories belong to one night of the year. 'Twas the Night Before Christmas was first printed in 1823, without the author's name, and has been read aloud on Christmas Eve ever since. Hearing it in Grandpa's voice, even when Grandpa is a long way away, is what Readli is for.",
      "This shelf also has Howard R. Garis's Uncle Wiggily, a kind old rabbit gentleman, in a Christmas story and a Thanksgiving story of about ten minutes each, and The Velveteen Rabbit, which begins with a toy rabbit in a Christmas stocking.",
    ],
    featured: "twas-the-night-before-christmas",
    more: {
      heading: "A family tradition, in a family voice",
      paragraphs: [
        "Many families have one person who always reads the Christmas poem. With Readli, that voice can be there on Christmas Eve wherever everyone is, and every year after.",
        "Giving Readli for the holidays? A grandparent can record their voice and give Readli Family to up to two families, delivered on Christmas morning. See [Readli gifts](/gifts).",
      ],
    },
    faqs: [
      { q: "How long does 'Twas the Night Before Christmas take to read aloud?", a: "About three minutes at a calm bedtime pace." },
      { q: "Who wrote 'Twas the Night Before Christmas?", a: "It was first published anonymously in 1823 as A Visit from St. Nicholas, and later claimed by Clement Clarke Moore, whose name it carries today." },
    ],
    includes: slugs("twas-the-night-before-christmas", "uncle-wiggilys-christmas", "uncle-wiggilys-thanksgiving", "the-velveteen-rabbit"),
    tint: "bg-coral/25",
  },
  {
    slug: "chapter-books",
    name: "Chapter books",
    title: "Classic chapter books to read aloud",
    description: "Winnie-the-Pooh, Heidi, The Secret Garden and more classic chapter books, read a chapter a night in the voices of the people your kids love.",
    intro: [
      "A chapter book turns bedtime into something to look forward to: what happens next is waiting tomorrow night. This shelf has the longer classics in the Readli library, from Winnie-the-Pooh and Just So Stories to Heidi and The Secret Garden.",
      "Readli keeps each child's place, chapter by chapter, and you can prepare a long book one chapter at a time, so you only spend narration credits on what you'll read next.",
    ],
    featured: "winnie-the-pooh",
    more: {
      heading: "Reading a chapter a night",
      paragraphs: [
        "Set the sleep timer to End of chapter and the story stops after the chapter's last sentence. Next time, Play picks up at the start of the next one, so nobody has to remember where you were. See [the sleep timer](/help/books-and-listening/sleep-timer-and-speed).",
        "Winnie-the-Pooh and Just So Stories are made of stories that each stand on their own, so they suit younger listeners. Heidi and The Secret Garden are one long story, better for children who can follow a plot over weeks.",
      ],
    },
    faqs: [
      { q: "What are good first chapter books to read aloud?", a: "Winnie-the-Pooh, The House at Pooh Corner and Raggedy Ann Stories are good first chapter books, because each chapter is its own adventure." },
      { q: "Do I have to prepare a whole chapter book at once?", a: "No. You can prepare one chapter at a time, so you only spend narration credits on the chapters you're about to read." },
    ],
    includes: (b) => b.chapters.length >= 5 && b.minutes >= 40 && b.language === "en",
    tint: "bg-mint",
  },
  {
    slug: "cuentos-en-espanol",
    name: "Cuentos en español",
    title: "Bedtime stories in Spanish: cuentos para dormir",
    description: "Ratón Pérez, José Martí's Los zapaticos de rosa and Samaniego's fables: classic Spanish children's stories, read aloud in Spanish in your family's own voices.",
    intro: [
      "These are the stories generations of children in Spain and Latin America grew up with, read in Spanish. Ratón Pérez is the original tale of the little mouse who collects children's teeth, written by Luis Coloma for the boy king Alfonso XIII. Cuentos de La Edad de Oro gathers the gentlest pieces from José Martí's magazine for the children of the Americas, including Los zapaticos de rosa and La muñeca negra. Fábulas de Samaniego has twelve of Félix María Samaniego's verse fables, from La cigarra y la hormiga to La lechera.",
      "Readli reads every word in Spanish, in the voice of the person who recorded it, and each story ends with Fin.",
    ],
    featured: "raton-perez",
    more: {
      heading: "For families who share more than one language",
      paragraphs: [
        "A grandparent far away can read Ratón Pérez to a grandchild the night a tooth falls out, in the language they spoke as a child. A child learning Spanish at school can hear Martí's poems read slowly by someone they love.",
        "Like every book in the library, these are the real public-domain texts. Old spellings are updated, and a few lines are changed for young children, just as they are in our English books.",
      ],
    },
    faqs: [
      { q: "Is the Readli app in Spanish?", a: "Not yet. The app and website are in English, and these stories are read aloud in Spanish." },
      { q: "Who is Ratón Pérez?", a: "Ratón Pérez is the mouse who takes a child's lost tooth from under the pillow and leaves a gift, much like the Tooth Fairy. Luis Coloma wrote his story in 1894." },
      { q: "Are these stories good for children learning Spanish?", a: "Yes. Samaniego's fables are short and rhyme, and Los zapaticos de rosa is one of the best-known children's poems in Spanish. Hearing them in a familiar voice makes them easier to follow." },
    ],
    includes: (b) => b.language === "es",
    tint: "bg-sunshine/45",
  },
];

export function getCollection(slug: string): Collection | undefined {
  return COLLECTIONS.find((c) => c.slug === slug);
}

export function collectionHref(c: Pick<Collection, "slug">): string {
  return `/bedtime-stories/${c.slug}`;
}

/** The books in a collection, ready ones first (shortest first, as the library sorts them), then coming soon. */
export function collectionBooks(c: Collection, library: readonly PublicBook[]): PublicBook[] {
  return library.filter(c.includes);
}

/** The collections a book appears in, for links from its page. */
export function collectionsFor(book: PublicBook): Collection[] {
  return COLLECTIONS.filter((c) => c.includes(book));
}
