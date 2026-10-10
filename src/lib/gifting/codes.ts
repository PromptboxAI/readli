/** Gift codes: 12 characters, no look-alikes (0/O, 1/I/L), shown as XXXX-XXXX-XXXX. Stored hashed (see codes.server.ts). */
export const GIFT_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** Accepts what people type: lower case, spaces, missing dashes. */
export function normalizeGiftCode(input: string): string | null {
  const raw = input.toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (raw.length !== 12 || [...raw].some((c) => !GIFT_CODE_ALPHABET.includes(c))) return null;
  return formatGiftCode(raw);
}

export function formatGiftCode(raw: string): string {
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}
