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
 * Kevin, 2026-10-22: every text is scanned for outdated or now-offensive words before it is added
 * (src/lib/content/language-check.ts; run `npm run scan:language -- <book.json>` on a new import).
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
import TheElvesAndTheShoemaker from "./the-elves-and-the-shoemaker.json";
import TheEmperorsNewClothes from "./the-emperors-new-clothes.json";
import TheGingerbreadMan from "./the-gingerbread-man.json";
import TheLionAndTheMouse from "./the-lion-and-the-mouse.json";
import TheLittleRedHen from "./the-little-red-hen.json";
import TheOwlAndThePussyCat from "./the-owl-and-the-pussy-cat.json";
import ThePrincessAndThePea from "./the-princess-and-the-pea.json";
import TheTaleOfMrJeremyFisher from "./the-tale-of-mr-jeremy-fisher.json";
import TheTaleOfMrsTiggyWinkle from "./the-tale-of-mrs-tiggy-winkle.json";
import TheTaleOfPeterRabbit from "./the-tale-of-peter-rabbit.json";
import TheTaleOfTwoBadMice from "./the-tale-of-two-bad-mice.json";
import TheThreeLittlePigs from "./the-three-little-pigs.json";
import TheUglyDuckling from "./the-ugly-duckling.json";
import TheVelveteenRabbit from "./the-velveteen-rabbit.json";
import Thumbelina from "./thumbelina.json";
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
  "the-elves-and-the-shoemaker": TheElvesAndTheShoemaker,
  "the-emperors-new-clothes": TheEmperorsNewClothes,
  "the-gingerbread-man": TheGingerbreadMan,
  "the-lion-and-the-mouse": TheLionAndTheMouse,
  "the-little-red-hen": TheLittleRedHen,
  "the-owl-and-the-pussy-cat": TheOwlAndThePussyCat,
  "the-princess-and-the-pea": ThePrincessAndThePea,
  "the-tale-of-mr-jeremy-fisher": TheTaleOfMrJeremyFisher,
  "the-tale-of-mrs-tiggy-winkle": TheTaleOfMrsTiggyWinkle,
  "the-tale-of-peter-rabbit": TheTaleOfPeterRabbit,
  "the-tale-of-two-bad-mice": TheTaleOfTwoBadMice,
  "the-three-little-pigs": TheThreeLittlePigs,
  "the-ugly-duckling": TheUglyDuckling,
  "the-velveteen-rabbit": TheVelveteenRabbit,
  "thumbelina": Thumbelina,
  "winnie-the-pooh": WinnieThePooh,
};
