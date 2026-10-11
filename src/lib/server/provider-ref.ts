import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Provider voice ids (ElevenLabs) are stored encrypted, as Postgres bytea hex, and only ever
 * decrypted on the server. Guest voices and account voices share this format, so account deletion
 * can find and remove any voice it owns.
 */
export class ProviderRefCipher {
  private readonly key: Buffer;

  constructor(secret: string) {
    this.key = createHash("sha256").update(`readli-provider-ref:${secret}`).digest();
  }

  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    return `\\x${Buffer.concat([iv, cipher.getAuthTag(), body]).toString("hex")}`;
  }

  decrypt(stored: string): string {
    const raw = Buffer.from(stored.replace(/^\\x/, ""), "hex");
    const decipher = createDecipheriv("aes-256-gcm", this.key, raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
  }
}

/** The secret account voices are encrypted with. Guest voices use GUEST_COOKIE_SECRET too. */
export function providerRefCipher(env: NodeJS.ProcessEnv = process.env): ProviderRefCipher | null {
  const secret = env.PROVIDER_REF_SECRET ?? env.GUEST_COOKIE_SECRET ?? (env.VOICE_PROVIDER === "stub" ? "readli-dev-only-secret" : undefined);
  return secret ? new ProviderRefCipher(secret) : null;
}
