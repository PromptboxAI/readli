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
 * Kevin, 2026-11-04: 12 more short books (1 to 9 minutes). Their edits, kept on re-import: Old Mr. Bunny has a
 * walking-stick, not a pipe or switch, scares the cat off the basket by stamping rather than kicking it, and
 * scolds Benjamin rather than whipping him; Mrs. Rabbit's rabbit-tobacco is lavender; Mr. McGregor wants a new
 * hat, not baccy, nobody talks of skinning the Flopsy Bunnies, and the marrow misses the youngest; the Town-Mouse
 * cook calls for a broom, not a poker, and the canary flies away rather than being killed; Miss Moppet is a Kitty;
 * the king doesn't threaten the miller's daughter's life, and the queen's comical names no longer mock bodies
 * (Snickersnee, Roly-Poly, Spindleshanks); the Three Feathers' peasant women tumble down in a heap rather than
 * breaking their arms and legs; Lazy Jack's girl "could neither hear nor speak", and his mother lives with them
 * "all her days". Rumpelstiltskin and The Frog Prince are Edgar Taylor's gentler translations, where the little
 * man stamps off and the frog sleeps on the princess's pillow.
 * Kevin, 2026-11-05: 13 more books, from picture-book tales to The Secret Garden. Their edits, kept on re-import:
 * the Fisherman's flounder asks to be let go rather than killed, and the sea turns dark without blood; Ida's
 * flowers are faded and tucked into a box, not dead and buried; Ole-Luk-Oie keeps six nights, leaving out Sunday
 * and his brother Death, and his Chinese and "heathen" lines; the Nightingale's court goes without supper rather
 * than being flogged, and Death sits at the Emperor's bed only briefly; the Tailor's mice say Kitty and roosters;
 * Beauty's father faces punishment, not death; the Reluctant Dragon starts at "Long ago", without the frame story,
 * and St. George "never really liked hurting anybody"; Peter Cottontail's Unc' Billy Possum and Ol' Mistah Buzzard
 * speak standard English (Uncle Billy Possum, Old Mr. Buzzard); Raggedy Andy's Dickie is Baby Tommy and the
 * midgets are penny dolls; When We Were Very Young leaves out Nursery Chairs, Bad Sir Brian Botany and
 * Disobedience; The Real Mother Goose keeps 66 gentle rhymes; and The Secret Garden's India passages no longer
 * use "native", "blacks" or "heathen", Mary stamps and shouts rather than hitting, the cholera is told gently,
 * wench is lass, Colin "can't walk" rather than being called a cripple, and Jem Fettleworth is lazy, not violent.
 */
import type { CatalogBook } from "../catalog";
import AChildsGardenOfVerses from "./a-childs-garden-of-verses.json";
import AlicesAdventuresInWonderland from "./alices-adventures-in-wonderland.json";
import BeautyAndTheBeast from "./beauty-and-the-beast.json";
import Cinderella from "./cinderella.json";
import FivePeasFromOnePod from "./five-peas-from-one-pod.json";
import GoldilocksAndTheThreeBears from "./goldilocks-and-the-three-bears.json";
import GudbrandOnTheHillSide from "./gudbrand-on-the-hill-side.json";
import Heidi from "./heidi.json";
import JerryMuskratsParty from "./jerry-muskrats-party.json";
import JohnnyChuckFindsTheBestThingInTheWorld from "./johnny-chuck-finds-the-best-thing-in-the-world.json";
import JohnnyCrowsGarden from "./johnny-crows-garden.json";
import JustSoStories from "./just-so-stories.json";
import LazyJack from "./lazy-jack.json";
import LittleIdasFlowers from "./little-idas-flowers.json";
import LittleTuk from "./little-tuk.json";
import MoreAesopsFables from "./more-aesops-fables.json";
import MotherHolle from "./mother-holle.json";
import MrsRedwingsSpeckledEgg from "./mrs-redwings-speckled-egg.json";
import OleLukOie from "./ole-luk-oie.json";
import RaggedyAndyStories from "./raggedy-andy-stories.json";
import RaggedyAnnStories from "./raggedy-ann-stories.json";
import Rumpelstiltskin from "./rumpelstiltskin.json";
import SleepingBeauty from "./sleeping-beauty.json";
import SweetPorridge from "./sweet-porridge.json";
import TeenyTiny from "./teeny-tiny.json";
import TheAdventuresOfPeterCottontail from "./the-adventures-of-peter-cottontail.json";
import TheBremenTownMusicians from "./the-bremen-town-musicians.json";
import TheDarningNeedle from "./the-darning-needle.json";
import TheElvesAndTheShoemaker from "./the-elves-and-the-shoemaker.json";
import TheEmperorsNewClothes from "./the-emperors-new-clothes.json";
import TheFishermanAndHisWife from "./the-fisherman-and-his-wife.json";
import TheFrogPrince from "./the-frog-prince.json";
import TheGingerbreadMan from "./the-gingerbread-man.json";
import TheGoldenGoose from "./the-golden-goose.json";
import TheHappyFamily from "./the-happy-family.json";
import TheHouseAtPoohCorner from "./the-house-at-pooh-corner.json";
import TheJumblies from "./the-jumblies.json";
import TheLeapingMatch from "./the-leaping-match.json";
import TheLionAndTheMouse from "./the-lion-and-the-mouse.json";
import TheLittleRedHen from "./the-little-red-hen.json";
import TheNightingale from "./the-nightingale.json";
import TheOwlAndThePussyCat from "./the-owl-and-the-pussy-cat.json";
import ThePrincessAndThePea from "./the-princess-and-the-pea.json";
import TheQueenBee from "./the-queen-bee.json";
import TheRealMotherGoose from "./the-real-mother-goose.json";
import TheReluctantDragon from "./the-reluctant-dragon.json";
import TheSecretGarden from "./the-secret-garden.json";
import TheStarMoney from "./the-star-money.json";
import TheStoryOfMissMoppet from "./the-story-of-miss-moppet.json";
import TheTailorOfGloucester from "./the-tailor-of-gloucester.json";
import TheTaleOfBenjaminBunny from "./the-tale-of-benjamin-bunny.json";
import TheTaleOfGingerAndPickles from "./the-tale-of-ginger-and-pickles.json";
import TheTaleOfJohnnyTownMouse from "./the-tale-of-johnny-town-mouse.json";
import TheTaleOfMrJeremyFisher from "./the-tale-of-mr-jeremy-fisher.json";
import TheTaleOfMrsTiggyWinkle from "./the-tale-of-mrs-tiggy-winkle.json";
import TheTaleOfMrsTittlemouse from "./the-tale-of-mrs-tittlemouse.json";
import TheTaleOfPeterRabbit from "./the-tale-of-peter-rabbit.json";
import TheTaleOfTheFlopsyBunnies from "./the-tale-of-the-flopsy-bunnies.json";
import TheTaleOfTimmyTiptoes from "./the-tale-of-timmy-tiptoes.json";
import TheTaleOfTomKitten from "./the-tale-of-tom-kitten.json";
import TheTaleOfTwoBadMice from "./the-tale-of-two-bad-mice.json";
import TheThreeBillyGoatsGruff from "./the-three-billy-goats-gruff.json";
import TheThreeFeathers from "./the-three-feathers.json";
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
import WhenWeWereVeryYoung from "./when-we-were-very-young.json";
import WinnieThePooh from "./winnie-the-pooh.json";
import WynkenBlynkenAndNod from "./wynken-blynken-and-nod.json";

export const LIBRARY_TEXTS: Record<string, Pick<CatalogBook, "edition" | "chapters"> | undefined> = {
  "a-childs-garden-of-verses": AChildsGardenOfVerses,
  "alices-adventures-in-wonderland": AlicesAdventuresInWonderland,
  "beauty-and-the-beast": BeautyAndTheBeast,
  "cinderella": Cinderella,
  "five-peas-from-one-pod": FivePeasFromOnePod,
  "goldilocks-and-the-three-bears": GoldilocksAndTheThreeBears,
  "gudbrand-on-the-hill-side": GudbrandOnTheHillSide,
  "heidi": Heidi,
  "jerry-muskrats-party": JerryMuskratsParty,
  "johnny-chuck-finds-the-best-thing-in-the-world": JohnnyChuckFindsTheBestThingInTheWorld,
  "johnny-crows-garden": JohnnyCrowsGarden,
  "just-so-stories": JustSoStories,
  "lazy-jack": LazyJack,
  "little-idas-flowers": LittleIdasFlowers,
  "little-tuk": LittleTuk,
  "more-aesops-fables": MoreAesopsFables,
  "mother-holle": MotherHolle,
  "mrs-redwings-speckled-egg": MrsRedwingsSpeckledEgg,
  "ole-luk-oie": OleLukOie,
  "raggedy-andy-stories": RaggedyAndyStories,
  "raggedy-ann-stories": RaggedyAnnStories,
  "rumpelstiltskin": Rumpelstiltskin,
  "sleeping-beauty": SleepingBeauty,
  "sweet-porridge": SweetPorridge,
  "teeny-tiny": TeenyTiny,
  "the-adventures-of-peter-cottontail": TheAdventuresOfPeterCottontail,
  "the-bremen-town-musicians": TheBremenTownMusicians,
  "the-darning-needle": TheDarningNeedle,
  "the-elves-and-the-shoemaker": TheElvesAndTheShoemaker,
  "the-emperors-new-clothes": TheEmperorsNewClothes,
  "the-fisherman-and-his-wife": TheFishermanAndHisWife,
  "the-frog-prince": TheFrogPrince,
  "the-gingerbread-man": TheGingerbreadMan,
  "the-golden-goose": TheGoldenGoose,
  "the-happy-family": TheHappyFamily,
  "the-house-at-pooh-corner": TheHouseAtPoohCorner,
  "the-jumblies": TheJumblies,
  "the-leaping-match": TheLeapingMatch,
  "the-lion-and-the-mouse": TheLionAndTheMouse,
  "the-little-red-hen": TheLittleRedHen,
  "the-nightingale": TheNightingale,
  "the-owl-and-the-pussy-cat": TheOwlAndThePussyCat,
  "the-princess-and-the-pea": ThePrincessAndThePea,
  "the-queen-bee": TheQueenBee,
  "the-real-mother-goose": TheRealMotherGoose,
  "the-reluctant-dragon": TheReluctantDragon,
  "the-secret-garden": TheSecretGarden,
  "the-star-money": TheStarMoney,
  "the-story-of-miss-moppet": TheStoryOfMissMoppet,
  "the-tailor-of-gloucester": TheTailorOfGloucester,
  "the-tale-of-benjamin-bunny": TheTaleOfBenjaminBunny,
  "the-tale-of-ginger-and-pickles": TheTaleOfGingerAndPickles,
  "the-tale-of-johnny-town-mouse": TheTaleOfJohnnyTownMouse,
  "the-tale-of-mr-jeremy-fisher": TheTaleOfMrJeremyFisher,
  "the-tale-of-mrs-tiggy-winkle": TheTaleOfMrsTiggyWinkle,
  "the-tale-of-mrs-tittlemouse": TheTaleOfMrsTittlemouse,
  "the-tale-of-peter-rabbit": TheTaleOfPeterRabbit,
  "the-tale-of-the-flopsy-bunnies": TheTaleOfTheFlopsyBunnies,
  "the-tale-of-timmy-tiptoes": TheTaleOfTimmyTiptoes,
  "the-tale-of-tom-kitten": TheTaleOfTomKitten,
  "the-tale-of-two-bad-mice": TheTaleOfTwoBadMice,
  "the-three-billy-goats-gruff": TheThreeBillyGoatsGruff,
  "the-three-feathers": TheThreeFeathers,
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
  "when-we-were-very-young": WhenWeWereVeryYoung,
  "winnie-the-pooh": WinnieThePooh,
  "wynken-blynken-and-nod": WynkenBlynkenAndNod,
};
