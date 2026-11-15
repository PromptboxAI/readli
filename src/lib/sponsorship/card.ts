import { certificatePdf } from "@/lib/pdf/certificate";
import { cardInput, type CardChoices } from "./card-copy";
import type { GiftView } from "./view";

export * from "./card-copy";

/** The card as PDF bytes (server only: the PDF writer uses node:zlib). */
export function giftCardPdf(gift: GiftView, choices: CardChoices, origin: string, now = new Date()): Buffer {
  return certificatePdf(cardInput(gift, choices, origin, now), "Readli gift card");
}
