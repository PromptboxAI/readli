/**
 * Full public-domain library editions, imported from Project Gutenberg plain text with the Gutenberg
 * header, licence and transcriber notes removed. Edition ids are internal provenance, never shown.
 * Kevin, 2026-10-11: default to the newest public-domain edition of each book.
 * Kevin, 2026-10-11: no book may end in violence. Goldilocks and The Three Little Pigs have gentler,
 * hand-edited endings (and the first two pigs run away rather than being eaten); keep them if a text
 * is ever re-imported.
 */
import type { CatalogBook } from "../catalog";
import AlicesAdventuresInWonderland from "./alices-adventures-in-wonderland.json";
import GoldilocksAndTheThreeBears from "./goldilocks-and-the-three-bears.json";
import TheElvesAndTheShoemaker from "./the-elves-and-the-shoemaker.json";
import TheGingerbreadMan from "./the-gingerbread-man.json";
import TheLionAndTheMouse from "./the-lion-and-the-mouse.json";
import TheLittleRedHen from "./the-little-red-hen.json";
import ThePrincessAndThePea from "./the-princess-and-the-pea.json";
import TheTaleOfPeterRabbit from "./the-tale-of-peter-rabbit.json";
import TheThreeLittlePigs from "./the-three-little-pigs.json";
import TheUglyDuckling from "./the-ugly-duckling.json";
import TheVelveteenRabbit from "./the-velveteen-rabbit.json";
import WinnieThePooh from "./winnie-the-pooh.json";

export const LIBRARY_TEXTS: Record<string, Pick<CatalogBook, "edition" | "chapters"> | undefined> = {
  "alices-adventures-in-wonderland": AlicesAdventuresInWonderland,
  "goldilocks-and-the-three-bears": GoldilocksAndTheThreeBears,
  "the-elves-and-the-shoemaker": TheElvesAndTheShoemaker,
  "the-gingerbread-man": TheGingerbreadMan,
  "the-lion-and-the-mouse": TheLionAndTheMouse,
  "the-little-red-hen": TheLittleRedHen,
  "the-princess-and-the-pea": ThePrincessAndThePea,
  "the-tale-of-peter-rabbit": TheTaleOfPeterRabbit,
  "the-three-little-pigs": TheThreeLittlePigs,
  "the-ugly-duckling": TheUglyDuckling,
  "the-velveteen-rabbit": TheVelveteenRabbit,
  "winnie-the-pooh": WinnieThePooh,
};
