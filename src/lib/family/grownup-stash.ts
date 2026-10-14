import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import { sameHash } from "@/lib/server/guest-token";

/**
 * The grown-up's sign-in, set aside while temporary Kids Mode runs on their own browser. It is
 * encrypted with a server key in an httpOnly cookie, so nothing on the page can read or use it, and
 * the browser holds no live grown-up sign-in while a child uses it. Only the server opens it, after
 * the family PIN matches; wrong tries are counted inside it, and deleting it just leaves the browser
 * signed out.
 */
export const GROWNUP_COOKIE = "readli_grownup";
/** Set after a PIN brings a grown-up back; sensitive actions then ask for a full sign-in. */
export const PIN_RESUMED_COOKIE = "readli_pin_resumed";

export const STASH_TRIES = 5;
export const STASH_LOCK_MINUTES = 15;

export interface GrownUpStash {
  /** Who set it aside: the Supabase user id, or the preview adult id. */
  user: string;
  /** Supabase refresh token for an account; the signed preview session for the preview. */
  token: string;
  kind: "account" | "preview";
  failures: number;
  lockedUntil: number | null;
  expiresAt: number;
}

const keyFrom = (secret: string) => createHash("sha256").update(`${secret}:grownup-stash`).digest();

export function sealStash(stash: GrownUpStash, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFrom(secret), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(stash), "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map((b) => b.toString("base64url")).join(".");
}

export function openStash(value: string | undefined, secret: string, now = Date.now()): GrownUpStash | null {
  if (!value) return null;
  const [iv, tag, body] = value.split(".");
  if (!iv || !tag || !body) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", keyFrom(secret), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    const stash = JSON.parse(Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf8")) as GrownUpStash;
    return stash.expiresAt > now ? stash : null;
  } catch {
    return null;
  }
}

/** One wrong PIN: counts it, and locks for a while after too many. */
export function failedTry(stash: GrownUpStash, now = Date.now()): GrownUpStash {
  const failures = stash.failures + 1;
  return failures >= STASH_TRIES
    ? { ...stash, failures: 0, lockedUntil: now + STASH_LOCK_MINUTES * 60_000 }
    : { ...stash, failures, lockedUntil: null };
}

export function lockedNow(stash: GrownUpStash, now = Date.now()): boolean {
  return stash.lockedUntil !== null && stash.lockedUntil > now;
}

export function pinResumedValue(userId: string, secret: string): string {
  return createHmac("sha256", `${secret}:pin-resumed`).update(userId).digest("base64url");
}

export function isPinResumed(value: string | undefined, userId: string, secret: string): boolean {
  return Boolean(value) && sameHash(value!, pinResumedValue(userId, secret));
}
