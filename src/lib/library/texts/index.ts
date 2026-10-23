/**
 * Full public-domain library editions, imported from Project Gutenberg plain text with the Gutenberg
 * header, licence and transcriber notes removed. Edition ids are internal provenance, never shown.
 * Kevin, 2026-10-11: default to the newest public-domain edition of each book.
 * Kevin, 2026-10-11: no book may end in violence. Goldilocks and The Three Little Pigs have gentler,
 * hand-edited endings (and the first two pigs run away rather than being eaten); keep them if a text
 * is ever re-imported. Sleeping Beauty's cook scolds the scullery boy rather than pulling his hair
 * or boxing his ear. Just So Stories keeps only its seven gentlest tales.
 * Kevin, 2026-10-12: Raggedy Ann Stories has light edits to dated passages (Dinah's description, and the
 * "Indian doll" is a scout doll). A Child's Garden of Verses leaves out six poems with dated lines.
 * Kevin, 2026-10-22: stories of 10 minutes or more that have no chapters of their own are split into
 * parts at natural breaks, so a family can try one part before spending credits on the whole story.
 * Split only between paragraphs where a sentence ends, so the revision and every sentence id stay the same.
 * Kevin, 2026-10-22: every text is scanned for outdated or now-offensive words before it is added
 * (src/lib/content/language-check.ts; run `npm run scan:language -- <book.json>` on a new import).
 * The first scan's words were all replaced by hand (Cinder-girl, Robin Redbreast, Tom Tiptoe-mouse,
 * Cheshire Kitty, Heidi's "Land of Knots", queer to strange or odd, and so on); keep them on re-import.
 * Kevin, 2026-10-23: 27 more short books (3 to 12 minutes) bring the library to 52. Their edits, kept on
 * re-import: Cock is Rooster (Mother Holle's crow is "Doodle-doodle-doo!") and Bobby Coon is Bobby Raccoon;
 * Bremen's robber is scared off by noise, not bitten, kicked or clawed; Santa has no pipe; Farmer Brown has
 * no gun; Ginger and Pickles sells peppermints, not snuff; Lear's tobacco-pipe mast is a wooden spoon and the
 * Duck's cigar a joke; "stupid" is dull, dreary or foolish; Aesop's milkmaid is courted; Uncle Wiggily's
 * closing teasers and Thanksgiving's dated "Indians" exchange are gone; Field's garden is "dear", not "queer";
 * and the Troll swims away from the Billy Goats Gruff.
 */
import type { CatalogBook } from "../catalog";
import AChildsGardenOfVerses from "./a-childs-garden-of-verses.json";
import AlicesAdventuresInWonderland from "./alices-adventures-in-wonderland.json";
import Cinderella from "./cinderella.json";
import GoldilocksAndTheThreeBears from "./goldilocks-and-the-three-bears.json";
import Heidi from "./heidi.json";
import JustSoStories from "./just-so-stories.json";
import RaggedyAnnStories from "./raggedy-ann-stories.json";
import SleepingBeauty from "./sleeping-beauty.json";
import TheBremenTownMusicians from "./the-bremen-town-musicians.json";
import TheElvesAndTheShoemaker from "./the-elves-and-the-shoemaker.json";
import TheEmperorsNewClothes from "./the-emperors-new-clothes.json";
import TheGingerbreadMan from "./the-gingerbread-man.json";
import TheGoldenGoose from "./the-golden-goose.json";
import TheJumblies from "./the-jumblies.json";
import TheLionAndTheMouse from "./the-lion-and-the-mouse.json";
import TheLittleRedHen from "./the-little-red-hen.json";
import TheOwlAndThePussyCat from "./the-owl-and-the-pussy-cat.json";
import ThePrincessAndThePea from "./the-princess-and-the-pea.json";
import TheTaleOfMrJeremyFisher from "./the-tale-of-mr-jeremy-fisher.json";
import TheTaleOfMrsTiggyWinkle from "./the-tale-of-mrs-tiggy-winkle.json";
import TheTaleOfPeterRabbit from "./the-tale-of-peter-rabbit.json";
import TheTaleOfTomKitten from "./the-tale-of-tom-kitten.json";
import TheTaleOfTwoBadMice from "./the-tale-of-two-bad-mice.json";
import TheThreeLittlePigs from "./the-three-little-pigs.json";
import TheUglyDuckling from "./the-ugly-duckling.json";
import TheVelveteenRabbit from "./the-velveteen-rabbit.json";
import Thumbelina from "./thumbelina.json";
import TwasTheNightBeforeChristmas from "./twas-the-night-before-christmas.json";
import WinnieThePooh from "./winnie-the-pooh.json";

export const LIBRARY_TEXTS: Record<string, Pick<CatalogBook, "edition" | "chapters"> | undefined> = {
  "a-childs-garden-of-verses": AChildsGardenOfVerses,
  "alices-adventures-in-wonderland": AlicesAdventuresInWonderland,
  "cinderella": Cinderella,
  "goldilocks-and-the-three-bears": GoldilocksAndTheThreeBears,
  "heidi": Heidi,
  "just-so-stories": JustSoStories,
  "raggedy-ann-stories": RaggedyAnnStories,
  "sleeping-beauty": SleepingBeauty,
  "the-bremen-town-musicians": TheBremenTownMusicians,
  "the-elves-and-the-shoemaker": TheElvesAndTheShoemaker,
  "the-emperors-new-clothes": TheEmperorsNewClothes,
  "the-gingerbread-man": TheGingerbreadMan,
  "the-golden-goose": TheGoldenGoose,
  "the-jumblies": TheJumblies,
  "the-lion-and-the-mouse": TheLionAndTheMouse,
  "the-little-red-hen": TheLittleRedHen,
  "the-owl-and-the-pussy-cat": TheOwlAndThePussyCat,
  "the-princess-and-the-pea": ThePrincessAndThePea,
  "the-tale-of-mr-jeremy-fisher": TheTaleOfMrJeremyFisher,
  "the-tale-of-mrs-tiggy-winkle": TheTaleOfMrsTiggyWinkle,
  "the-tale-of-peter-rabbit": TheTaleOfPeterRabbit,
  "the-tale-of-tom-kitten": TheTaleOfTomKitten,
  "the-tale-of-two-bad-mice": TheTaleOfTwoBadMice,
  "the-three-little-pigs": TheThreeLittlePigs,
  "the-ugly-duckling": TheUglyDuckling,
  "the-velveteen-rabbit": TheVelveteenRabbit,
  "thumbelina": Thumbelina,
  "twas-the-night-before-christmas": TwasTheNightBeforeChristmas,
  "winnie-the-pooh": WinnieThePooh,
};
