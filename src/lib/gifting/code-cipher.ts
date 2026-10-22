import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Complimentary membership codes are kept encrypted (gifts.code_encrypted) as well as hashed, so an
 * admin can download the same QR code and certificate again without issuing a new code. Only the
 * server holds the key; the database alone can't recover a code. Paid gift codes stay hash-only.
 * Values are Postgres bytea hex: iv (12) | auth tag (16) | ciphertext.
 */
export class GiftCodeCipher {
  private readonly key: Buffer;

  constructor(secret: string) {
    this.key = createHash("sha256").update(`readli-gift-code:${secret}`).digest();
  }

  /** Hex without the \x prefix, as the issue RPC decodes it. */
  encryptHex(code: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const body = Buffer.concat([cipher.update(code, "utf8"), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("hex");
  }

  /** Accepts the \x-prefixed hex Supabase returns for bytea. Null if it was tampered with or the key changed. */
  decrypt(stored: string | null | undefined): string | null {
    if (!stored) return null;
    try {
      const raw = Buffer.from(stored.replace(/^\\x/, ""), "hex");
      const decipher = createDecipheriv("aes-256-gcm", this.key, raw.subarray(0, 12));
      decipher.setAuthTag(raw.subarray(12, 28));
      return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
    } catch {
      return null;
    }
  }
}

/** Same secret source as provider refs: PROVIDER_REF_SECRET, else GUEST_COOKIE_SECRET. */
export function giftCodeCipher(env: NodeJS.ProcessEnv = process.env): GiftCodeCipher | null {
  const secret = env.PROVIDER_REF_SECRET ?? env.GUEST_COOKIE_SECRET ?? (env.VOICE_PROVIDER === "stub" ? "readli-dev-only-secret" : undefined);
  return secret ? new GiftCodeCipher(secret) : null;
}
