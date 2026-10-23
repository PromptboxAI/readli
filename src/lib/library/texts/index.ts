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
 * Kevin, 2026-10-23: the narration model takes "said the billy-goat, with such a small voice" as a direction
 * and reads the line too quietly to hear, so the goats speak "as politely as he could" and "a little more
 * boldly" instead; avoid volume cues like that in narration text.
 * Kevin, 2026-10-23: every book was checked for lines the narration model misreads
 * (src/lib/content/narration-check.ts), and these edits are kept on re-import: shouted capitals are in
 * normal case (Goldilocks' bears, Potter's and Andersen's opening words, Pooh's signs and notices), quiet
 * cues like "in a low voice" and "in his little wee voice" are gone, repeated sounds are one line
 * ("Caw, caw!", "Buzz, buzz, buzzz!", "Ha, ha!"), and Pooh's misspelled notices and "!!!!!!" are written
 * so a narrator can read them.
 */
import type { CatalogBook } from "../catalog";
import AChildsGardenOfVerses from "./a-childs-garden-of-verses.json";
import AlicesAdventuresInWonderland from "./alices-adventures-in-wonderland.json";
import Cinderella from "./cinderella.json";
import FivePeasFromOnePod from "./five-peas-from-one-pod.json";
import GoldilocksAndTheThreeBears from "./goldilocks-and-the-three-bears.json";
import GudbrandOnTheHillSide from "./gudbrand-on-the-hill-side.json";
import Heidi from "./heidi.json";
import JerryMuskratsParty from "./jerry-muskrats-party.json";
import JohnnyChuckFindsTheBestThingInTheWorld from "./johnny-chuck-finds-the-best-thing-in-the-world.json";
import JustSoStories from "./just-so-stories.json";
import LittleTuk from "./little-tuk.json";
import MoreAesopsFables from "./more-aesops-fables.json";
import MotherHolle from "./mother-holle.json";
import MrsRedwingsSpeckledEgg from "./mrs-redwings-speckled-egg.json";
import RaggedyAnnStories from "./raggedy-ann-stories.json";
import SleepingBeauty from "./sleeping-beauty.json";
import TheBremenTownMusicians from "./the-bremen-town-musicians.json";
import TheDarningNeedle from "./the-darning-needle.json";
import TheElvesAndTheShoemaker from "./the-elves-and-the-shoemaker.json";
import TheEmperorsNewClothes from "./the-emperors-new-clothes.json";
import TheGingerbreadMan from "./the-gingerbread-man.json";
import TheGoldenGoose from "./the-golden-goose.json";
import TheHappyFamily from "./the-happy-family.json";
import TheJumblies from "./the-jumblies.json";
import TheLeapingMatch from "./the-leaping-match.json";
import TheLionAndTheMouse from "./the-lion-and-the-mouse.json";
import TheLittleRedHen from "./the-little-red-hen.json";
import TheOwlAndThePussyCat from "./the-owl-and-the-pussy-cat.json";
import ThePrincessAndThePea from "./the-princess-and-the-pea.json";
import TheQueenBee from "./the-queen-bee.json";
import TheTaleOfGingerAndPickles from "./the-tale-of-ginger-and-pickles.json";
import TheTaleOfMrJeremyFisher from "./the-tale-of-mr-jeremy-fisher.json";
import TheTaleOfMrsTiggyWinkle from "./the-tale-of-mrs-tiggy-winkle.json";
import TheTaleOfMrsTittlemouse from "./the-tale-of-mrs-tittlemouse.json";
import TheTaleOfPeterRabbit from "./the-tale-of-peter-rabbit.json";
import TheTaleOfTimmyTiptoes from "./the-tale-of-timmy-tiptoes.json";
import TheTaleOfTomKitten from "./the-tale-of-tom-kitten.json";
import TheTaleOfTwoBadMice from "./the-tale-of-two-bad-mice.json";
import TheThreeBillyGoatsGruff from "./the-three-billy-goats-gruff.json";
import TheThreeLittlePigs from "./the-three-little-pigs.json";
import TheThreeSillies from "./the-three-sillies.json";
import TheUglyDuckling from "./the-ugly-duckling.json";
import TheVelveteenRabbit from "./the-velveteen-rabbit.json";
import TheWhiteHorseGirlAndTheBlueWindBoy from "./the-white-horse-girl-and-the-blue-wind-boy.json";
import TheWilfulLittleBreeze from "./the-wilful-little-breeze.json";
import Thumbelina from "./thumbelina.json";
import TwasTheNightBeforeChristmas from "./twas-the-night-before-christmas.json";
import UncleWiggilysChristmas from "./uncle-wiggilys-christmas.json";
import UncleWiggilysThanksgiving from "./uncle-wiggilys-thanksgiving.json";
import WinnieThePooh from "./winnie-the-pooh.json";
import WynkenBlynkenAndNod from "./wynken-blynken-and-nod.json";

export const LIBRARY_TEXTS: Record<string, Pick<CatalogBook, "edition" | "chapters"> | undefined> = {
  "a-childs-garden-of-verses": AChildsGardenOfVerses,
  "alices-adventures-in-wonderland": AlicesAdventuresInWonderland,
  "cinderella": Cinderella,
  "five-peas-from-one-pod": FivePeasFromOnePod,
  "goldilocks-and-the-three-bears": GoldilocksAndTheThreeBears,
  "gudbrand-on-the-hill-side": GudbrandOnTheHillSide,
  "heidi": Heidi,
  "jerry-muskrats-party": JerryMuskratsParty,
  "johnny-chuck-finds-the-best-thing-in-the-world": JohnnyChuckFindsTheBestThingInTheWorld,
  "just-so-stories": JustSoStories,
  "little-tuk": LittleTuk,
  "more-aesops-fables": MoreAesopsFables,
  "mother-holle": MotherHolle,
  "mrs-redwings-speckled-egg": MrsRedwingsSpeckledEgg,
  "raggedy-ann-stories": RaggedyAnnStories,
  "sleeping-beauty": SleepingBeauty,
  "the-bremen-town-musicians": TheBremenTownMusicians,
  "the-darning-needle": TheDarningNeedle,
  "the-elves-and-the-shoemaker": TheElvesAndTheShoemaker,
  "the-emperors-new-clothes": TheEmperorsNewClothes,
  "the-gingerbread-man": TheGingerbreadMan,
  "the-golden-goose": TheGoldenGoose,
  "the-happy-family": TheHappyFamily,
  "the-jumblies": TheJumblies,
  "the-leaping-match": TheLeapingMatch,
  "the-lion-and-the-mouse": TheLionAndTheMouse,
  "the-little-red-hen": TheLittleRedHen,
  "the-owl-and-the-pussy-cat": TheOwlAndThePussyCat,
  "the-princess-and-the-pea": ThePrincessAndThePea,
  "the-queen-bee": TheQueenBee,
  "the-tale-of-ginger-and-pickles": TheTaleOfGingerAndPickles,
  "the-tale-of-mr-jeremy-fisher": TheTaleOfMrJeremyFisher,
  "the-tale-of-mrs-tiggy-winkle": TheTaleOfMrsTiggyWinkle,
  "the-tale-of-mrs-tittlemouse": TheTaleOfMrsTittlemouse,
  "the-tale-of-peter-rabbit": TheTaleOfPeterRabbit,
  "the-tale-of-timmy-tiptoes": TheTaleOfTimmyTiptoes,
  "the-tale-of-tom-kitten": TheTaleOfTomKitten,
  "the-tale-of-two-bad-mice": TheTaleOfTwoBadMice,
  "the-three-billy-goats-gruff": TheThreeBillyGoatsGruff,
  "the-three-little-pigs": TheThreeLittlePigs,
  "the-three-sillies": TheThreeSillies,
  "the-ugly-duckling": TheUglyDuckling,
  "the-velveteen-rabbit": TheVelveteenRabbit,
  "the-white-horse-girl-and-the-blue-wind-boy": TheWhiteHorseGirlAndTheBlueWindBoy,
  "the-wilful-little-breeze": TheWilfulLittleBreeze,
  "thumbelina": Thumbelina,
  "twas-the-night-before-christmas": TwasTheNightBeforeChristmas,
  "uncle-wiggilys-christmas": UncleWiggilysChristmas,
  "uncle-wiggilys-thanksgiving": UncleWiggilysThanksgiving,
  "winnie-the-pooh": WinnieThePooh,
  "wynken-blynken-and-nod": WynkenBlynkenAndNod,
};
