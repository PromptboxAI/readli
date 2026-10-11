import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Transactional email through Resend (Kevin, 2026-10-11). Off until RESEND_API_KEY and EMAIL_FROM are
 * set; replies go to admin@readli.ai unless EMAIL_REPLY_TO says otherwise. Readli never adds anyone
 * to a Resend audience or marketing list.
 */
export interface EmailConfig {
  apiKey: string | null;
  from: string | null;
  replyTo: string;
  webhookSecret: string | null;
  /** At most this many emails per run, sent this far apart (Resend allows a few requests a second). */
  batchSize: number;
  spacingMs: number;
}

export function emailConfig(env: NodeJS.ProcessEnv = process.env): EmailConfig {
  return {
    apiKey: env.RESEND_API_KEY || null,
    from: env.EMAIL_FROM || null,
    replyTo: env.EMAIL_REPLY_TO || "admin@readli.ai",
    webhookSecret: env.RESEND_WEBHOOK_SECRET || null,
    batchSize: Number(env.EMAIL_BATCH_SIZE ?? 100),
    spacingMs: Number(env.EMAIL_SPACING_MS ?? 600),
  };
}

export const emailEnabled = (c: EmailConfig) => Boolean(c.apiKey && c.from);

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  tags?: Record<string, string>;
}

export type SendResult = { ok: true; id: string } | { ok: false; retry: boolean; error: string };

export interface EmailSender {
  send(email: OutgoingEmail, idempotencyKey: string): Promise<SendResult>;
}

export class ResendSender implements EmailSender {
  constructor(
    private readonly config: EmailConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(email: OutgoingEmail, idempotencyKey: string): Promise<SendResult> {
    if (!emailEnabled(this.config)) return { ok: false, retry: true, error: "email_off" };
    let res: Response;
    try {
      res = await this.fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.config.apiKey}`,
          "content-type": "application/json",
          "idempotency-key": idempotencyKey,
        },
        body: JSON.stringify({
          from: this.config.from,
          to: [email.to],
          reply_to: this.config.replyTo,
          subject: email.subject,
          text: email.text,
          tags: Object.entries(email.tags ?? {}).map(([name, value]) => ({ name, value: value.replace(/[^A-Za-z0-9_-]/g, "_") })),
        }),
      });
    } catch (err) {
      return { ok: false, retry: true, error: err instanceof Error ? err.message : String(err) };
    }
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
    if (res.ok && body.id) return { ok: true, id: body.id };
    // Rate limits and Resend outages are retried; a rejected address or payload is not.
    const retry = res.status === 429 || res.status >= 500;
    return { ok: false, retry, error: `${res.status} ${body.name ?? ""} ${body.message ?? ""}`.trim().slice(0, 300) };
  }
}

/** The key an address is suppressed under: a hash, so the list holds no readable addresses. */
export function suppressionKey(email: string): string {
  return createHash("sha256").update(`suppress:${email.trim().toLowerCase()}`).digest("hex");
}

/**
 * Checks a Resend (Svix) webhook signature: base64 HMAC-SHA256 of "id.timestamp.body" with the
 * whsec_ secret, within five minutes of the timestamp.
 */
export function verifyResendSignature(
  body: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  secret: string,
  nowMs = Date.now(),
): boolean {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowMs / 1000 - ts) > 300) return false;
  const key = Buffer.from(secret.startsWith("whsec_") ? secret.slice(6) : secret, "base64");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest();
  return signature.split(" ").some((part) => {
    const [version, sig] = part.split(",");
    if (version !== "v1" || !sig) return false;
    const given = Buffer.from(sig, "base64");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}
