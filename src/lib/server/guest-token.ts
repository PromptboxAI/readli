import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** HttpOnly cookie holding the guest's random token. The database only ever sees its HMAC. */
export const GUEST_COOKIE = "readli_guest";
export const GUEST_TTL_MS = 24 * 60 * 60 * 1000;

export function newGuestToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashGuestToken(token: string, secret: string): string {
  return createHmac("sha256", secret).update(token).digest("hex");
}

export function sameHash(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
