/**
 * Curated passages a Readli Voice contributor can choose for their invitation preview: 70 to 115 words
 * each, about 30 to 45 seconds read aloud, copied word for word from the library edition (a test checks
 * that). Chosen to be gentle out of context. Add or remove passages here; ids are stored with each preview.
 */
export interface PreviewPassage {
  id: string;
  book: string;
  /** Index into the catalog book's chapters. */
  chapter: number;
  text: string;
}

export const PREVIEW_PASSAGES: readonly PreviewPassage[] = [
  {
    id: "alices-adventures-in-wonderland-1",
    book: "alices-adventures-in-wonderland",
    chapter: 0,
    text: "Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it, “and what is the use of a book,” thought Alice “without pictures or conversations?” So she was considering in her own mind (as well as she could, for the hot day made her feel very sleepy and stupid), whether the pleasure of making a daisy-chain would be worth the trouble of getting up and picking the daisies, when suddenly a White Rabbit with pink eyes ran close by her.",
  },
  {
    id: "alices-adventures-in-wonderland-2",
    book: "alices-adventures-in-wonderland",
    chapter: 0,
    text: "There seemed to be no use in waiting by the little door, so she went back to the table, half hoping she might find another key on it, or at any rate a book of rules for shutting people up like telescopes: this time she found a little bottle on it, (“which certainly was not here before,” said Alice,) and round the neck of the bottle was a paper label, with the words “DRINK ME,” beautifully printed on it in large letters.",
  },
  {
    id: "goldilocks-and-the-three-bears-1",
    book: "goldilocks-and-the-three-bears",
    chapter: 0,
    text: "Once upon a time there were three Bears, who lived together in a house of their own, in a wood. One of them was a Little Wee Bear, and one was a Middle-sized Bear, and the other was a Great Big Bear. They had each a bowl for their porridge; a little bowl for the Little Wee Bear; and a middle-sized bowl for the Middle-sized Bear; and a great bowl for the Great Big Bear.",
  },
  {
    id: "goldilocks-and-the-three-bears-2",
    book: "goldilocks-and-the-three-bears",
    chapter: 0,
    text: "First she tasted the porridge of the Great Big Bear, and that was too hot for her. Next she tasted the porridge of the Middle-sized Bear, but that was too cold for her. And then she went to the porridge of the Little Wee Bear, and tasted it, and that was neither too hot nor too cold, but just right, and she liked it so well that she ate it all up, every bit! Then Goldilocks, who was tired, for she had been catching butterflies instead of running on her errand, sate down in the chair of the Great Big Bear, but that was too hard for her.",
  },
  {
    id: "the-elves-and-the-shoemaker-1",
    book: "the-elves-and-the-shoemaker",
    chapter: 0,
    text: "A shoemaker, by no fault of his own, had become so poor that at last he had nothing left but leather for one pair of shoes. So in the evening, he cut out the shoes which he wished to make the next morning. And as he had a good conscience, he lay down quietly in his bed, commended himself to God, and fell asleep. In the morning, after he had said his prayers, and was just going to sit down to work, lo! both shoes stood all finished on his table.",
  },
  {
    id: "the-elves-and-the-shoemaker-2",
    book: "the-elves-and-the-shoemaker",
    chapter: 0,
    text: "He cut them out at night, and next morning was about to set to work with fresh courage; but he had no need to do so, for, when he got up, they were already made. And buyers also were not wanting, who gave him money enough to buy leather for four pairs of shoes. The following morning, too, he found the four pairs made. And so it went on constantly, what he cut out in the evening was finished by morning, so that he soon had his honest living again, and at last became a wealthy man.",
  },
  {
    id: "the-gingerbread-man-1",
    book: "the-gingerbread-man",
    chapter: 0,
    text: 'One day, the cook went into the kitchen to make some gingerbread. She took some flour and water, and treacle and ginger, and mixed them all well together, and she put in some more water to make it thin, and then some more flour to make it thick, and a little salt and some spice, and then she rolled it out into a beautiful, smooth, dark-yellow dough. Then she took the square tins and cut out some square cakes for the little boys, and with some round tins she cut out some round cakes for the little girls, and then she said, "I\'m going to make a little gingerbread man for little Bobby."',
  },
  {
    id: "the-gingerbread-man-2",
    book: "the-gingerbread-man",
    chapter: 0,
    text: "Meanwhile, the gingerbread man had got to the bottom of the tree, and was saying to himself: \"Now, I know the dog can't climb a tree, and I don't believe the old cook can climb a tree; and as for the monkey I'm not sure, for I've never seen a monkey before, but I am going up.\" So he pulled himself up hand over hand until he had got to the topmost branch. But the monkey had jumped with one spring onto the lowest branch, and in an instant he also was at the top of the tree.",
  },
  {
    id: "the-lion-and-the-mouse-1",
    book: "the-lion-and-the-mouse",
    chapter: 0,
    text: 'Some days later, while stalking his prey in the forest, the Lion was caught in the toils of a hunter\'s net. Unable to free himself, he filled the forest with his angry roaring. The Mouse knew the voice and quickly found the Lion struggling in the net. Running to one of the great ropes that bound him, she gnawed it until it parted, and soon the Lion was free. "You laughed when I said I would repay you," said the Mouse.',
  },
  {
    id: "the-little-red-hen-1",
    book: "the-little-red-hen",
    chapter: 0,
    text: 'A Little Red Hen lived in a barnyard. She spent almost all of her time walking about the barnyard in her picketty-pecketty fashion, scratching everywhere for worms. She dearly loved fat, delicious worms and felt they were absolutely necessary to the health of her children. As often as she found a worm she would call "Chuck-chuck-chuck!" to her chickies. When they were gathered about her, she would distribute choice morsels of her tid-bit. A busy little body was she!',
  },
  {
    id: "the-little-red-hen-2",
    book: "the-little-red-hen",
    chapter: 0,
    text: 'She was not in the habit of making bread, although, of course, anyone can make it if he or she follows the recipe with care, and she knew perfectly well that she could do it if necessary. So after her children were fed and made sweet and fresh for the day, she hunted up the Pig, the Cat and the Rat. Still confident that they would surely help her some day she sang out, "Who will make the bread?"',
  },
  {
    id: "the-princess-and-the-pea-1",
    book: "the-princess-and-the-pea",
    chapter: 0,
    text: "There was once a Prince who wished to marry a Princess; but then she must be a real Princess. He travelled all over the world in hopes of finding such a lady; but there was always something wrong. Princesses he found in plenty; but whether they were real Princesses it was impossible for him to decide, for now one thing, now another, seemed to him not quite right about the ladies. At last he returned to his palace quite cast down, because he wished so much to have a real Princess for his wife.",
  },
  {
    id: "the-princess-and-the-pea-2",
    book: "the-princess-and-the-pea",
    chapter: 0,
    text: "She said she was a real Princess. ‘Ah, we shall soon see that!’ thought the old Queen-mother; however, she said not a word of what she was going to do, but went quietly into the bedroom, took all the bedclothes off the bed, and put three little peas on the bedstead. She then laid twenty mattresses one upon another over the three peas, and put twenty feather-beds over the mattresses. Upon this bed the Princess was to pass the night.",
  },
  {
    id: "the-tale-of-peter-rabbit-1",
    book: "the-tale-of-peter-rabbit",
    chapter: 0,
    text: "Mr. McGregor came up with a sieve, which he intended to pop upon the top of Peter; but Peter wriggled out just in time, leaving his jacket behind him. And rushed into the tool-shed, and jumped into a can. It would have been a beautiful thing to hide in, if it had not had so much water in it. Mr. McGregor was quite sure that Peter was somewhere in the tool-shed, perhaps hidden underneath a flower-pot.",
  },
  {
    id: "the-tale-of-peter-rabbit-2",
    book: "the-tale-of-peter-rabbit",
    chapter: 0,
    text: "Then he tried to find his way straight across the garden, but he became more and more puzzled. Presently, he came to a pond where Mr. McGregor filled his water-cans. A white cat was staring at some gold-fish, she sat very, very still, but now and then the tip of her tail twitched as if it were alive. Peter thought it best to go away without speaking to her; he had heard about cats from his cousin, little Benjamin Bunny.",
  },
  {
    id: "the-three-little-pigs-1",
    book: "the-three-little-pigs",
    chapter: 0,
    text: 'Once upon a time there was an old sow who had three little pigs, and as she had not enough for them to eat, she said they had better go out into the world and seek their fortunes. Now the eldest pig went first, and as he trotted along the road he met a man carrying a bundle of straw. So he said very politely: "If you please, sir, could you give me that straw to build me a house?"',
  },
  {
    id: "the-ugly-duckling-1",
    book: "the-ugly-duckling",
    chapter: 0,
    text: "It was beautiful in the country, it was summer-time; the wheat was yellow, the oats were green, the hay was stacked up in the green meadows, and the stork paraded about on his long red legs, discoursing in Egyptian, which language he had learned from his mother. The fields and meadows were skirted by thick woods, and a deep lake lay in the midst of the woods.—Yes, it was indeed beautiful in the country! The sunshine fell warmly on an old mansion, surrounded by deep canals, and from the walls down to the water’s edge there grew large burdock-leaves, so high that children could stand upright among them without being perceived.",
  },
  {
    id: "the-ugly-duckling-2",
    book: "the-ugly-duckling",
    chapter: 2,
    text: "And the autumn came, the leaves turned yellow and brown, the wind caught them and danced them about, the air was very cold, the clouds were heavy with hail or snow, and the raven sat on the hedge and croaked:—the poor duckling was certainly not very comfortable! One evening, just as the sun was setting with unusual brilliancy, a flock of large beautiful birds rose from out of the brushwood; the duckling had never seen anything so beautiful before; their plumage was of a dazzling white, and they had long, slender necks.",
  },
  {
    id: "the-velveteen-rabbit-1",
    book: "the-velveteen-rabbit",
    chapter: 0,
    text: "There was once a velveteen rabbit, and in the beginning he was really splendid. He was fat and bunchy, as a rabbit should be; his coat was spotted brown and white, he had real thread whiskers, and his ears were lined with pink sateen. On Christmas morning, when he sat wedged in the top of the Boy's stocking, with a sprig of holly between his paws, the effect was charming. There were other things in the stocking, nuts and oranges and a toy engine, and chocolate almonds and a clockwork mouse, but the Rabbit was quite the best of all.",
  },
  {
    id: "the-velveteen-rabbit-2",
    book: "the-velveteen-rabbit",
    chapter: 1,
    text: "Spring came, and they had long days in the garden, for wherever the Boy went the Rabbit went too. He had rides in the wheelbarrow, and picnics on the grass, and lovely fairy huts built for him under the raspberry canes behind the flower border. And once, when the Boy was called away suddenly to go out to tea, the Rabbit was left out on the lawn until long after dusk, and Nana had to come and look for him with the candle because the Boy couldn't go to sleep unless he was there.",
  },
  {
    id: "winnie-the-pooh-1",
    book: "winnie-the-pooh",
    chapter: 0,
    text: "Here is Edward Bear, coming downstairs now, bump, bump, bump, on the back of his head, behind Christopher Robin. It is, as far as he knows, the only way of coming downstairs, but sometimes he feels that there really is another way, if only he could stop bumping for a moment and think of it. And then he feels that perhaps there isn't. Anyhow, here he is at the bottom, and ready to be introduced to you.",
  },
  {
    id: "winnie-the-pooh-2",
    book: "winnie-the-pooh",
    chapter: 0,
    text: '"Christopher Robin!" "Yes?" "Have you an umbrella in your house?" "I think so." "I wish you would bring it out here, and walk up and down with it, and look up at me every now and then, and say \'Tut-tut, it looks like rain.\' I think, if you did that, it would help the deception which we are practising on these bees." Well, you laughed to yourself, "Silly old Bear!" but you didn\'t say it aloud because you were so fond of him, and you went home for your umbrella.',
  },
  {
    id: "aesops-fables-retold-1",
    book: "aesops-fables-retold",
    chapter: 0,
    text: 'Hare was the fastest animal in the meadow, and he never let anyone forget it. One sunny morning he laughed at Tortoise for being so slow. "I will race you," said Tortoise quietly, "to the old oak tree on the hill." All the animals gathered to watch. Hare shot off like an arrow and was soon far ahead. Halfway up the hill he looked back and could not even see Tortoise. "There is plenty of time," he yawned, and he lay down in the soft grass for a nap.',
  },
  {
    id: "aesops-fables-retold-2",
    book: "aesops-fables-retold",
    chapter: 2,
    text: 'All summer long, Grasshopper sang and danced in the warm green fields. Every day he watched Ant march past, carrying grain to her nest. "Why work so hard?" Grasshopper asked. "Come and sing with me!" "I am storing food for the winter," said Ant, "and you should too." Grasshopper only laughed and played another tune. Then the days grew short and cold, and snow covered the fields. Grasshopper could not find a single seed to eat.',
  },
];

export function findPassage(id: string): PreviewPassage | null {
  return PREVIEW_PASSAGES.find((p) => p.id === id) ?? null;
}
