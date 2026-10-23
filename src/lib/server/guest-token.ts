import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** HttpOnly cookie holding the guest's random token. The database only ever sees its HMAC. */
export const GUEST_COOKIE = "readli_guest";
/**
 * Guest sessions expire 21 hours after they start. Cleanup runs hourly, so with up to three hours
 * of scheduler slack every recording is gone within the 24 hours the site promises.
 */
export const GUEST_TTL_MS = 21 * 60 * 60 * 1000;
export const GUEST_DELETION_PROMISE_MS = 24 * 60 * 60 * 1000;

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
