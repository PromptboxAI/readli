import { createHash, randomInt } from "node:crypto";
import { formatGiftCode, GIFT_CODE_ALPHABET } from "./codes";

export function generateGiftCode(): string {
  let raw = "";
  for (let i = 0; i < 12; i++) raw += GIFT_CODE_ALPHABET[randomInt(GIFT_CODE_ALPHABET.length)];
  return formatGiftCode(raw);
}

/** Only the hash is stored, like family invitation tokens (PRD F-04). */
export function hashGiftCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}
