import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** HttpOnly cookie holding the guest's random token. The database only ever sees its HMAC. */
export const GUEST_COOKIE = "readli_guest";
export const GUEST_TTL_MS = 24 * 60 * 60 * 1000;
/**
 * The public promise: demo audio and voices are normally deleted within 48 hours of the demo starting.
 * Clean-up runs three times a day (vercel.json), so an expired demo normally waits at most about 9 hours.
 */
export const DEMO_DELETION_PROMISE_MS = 48 * 60 * 60 * 1000;

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
