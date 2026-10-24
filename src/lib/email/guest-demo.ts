import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { emailHash } from "@/lib/invitations/server";
import { ProviderRefCipher } from "@/lib/server/provider-ref";
import { enabledEmails, queueEmails } from "./outbox";
import { readliEmail } from "./templates";

/**
 * "Email me my demo" (G1, Kevin 2026-10-24 point 7). Optional: the demo works the same without it.
 * The link is a random token (only its hash is stored) that stops working when the guest session
 * expires, and the request row and the queued email are deleted with the session. Delivery consent
 * and marketing consent are separate choices; marketing consent alone keeps the address, in
 * email_marketing_contacts, with a consent record.
 */

type Row = Record<string, unknown>;

export const DEMO_EMAILS_PER_ADDRESS_PER_DAY = 3;

export const hashDemoToken = (token: string) => createHash("sha256").update(`guest-demo:${token}`).digest("hex");
const addressKey = (email: string) => createHash("sha256").update(`guest-demo-address:${email.trim().toLowerCase()}`).digest("hex");

export function looksLikeEmail(value: unknown): value is string {
  return typeof value === "string" && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export type DemoEmailOutcome = "queued" | "already_sent" | "address_limit" | "nothing_heard" | "expired";

export interface DemoGuest {
  id: string;
  expiresAt: string;
  generationsUsed: number;
}

export async function requestDemoEmail(
  db: SupabaseClient,
  secret: string,
  base: string,
  guest: DemoGuest,
  input: { email: string; marketing: boolean },
  now = new Date(),
): Promise<{ outcome: DemoEmailOutcome; outboxId?: string }> {
  if (guest.generationsUsed < 1) return { outcome: "nothing_heard" };
  if (new Date(guest.expiresAt).getTime() <= now.getTime()) return { outcome: "expired" };
  const email = input.email.trim();
  const key = addressKey(email);
  const [mine, sameAddress] = await Promise.all([
    db.from("guest_demo_emails").select("id").eq("guest_session_id", guest.id).limit(1),
    db.from("guest_demo_emails").select("created_at").eq("email_hash", key).gte("created_at", new Date(now.getTime() - 86_400_000).toISOString()),
  ]);
  if (mine.error || sameAddress.error) throw new Error(`read demo emails: ${(mine.error ?? sameAddress.error)!.message}`);
  if ((mine.data ?? []).length) return { outcome: "already_sent" };
  const today = (sameAddress.data ?? []) as Row[];
  if (today.length >= DEMO_EMAILS_PER_ADDRESS_PER_DAY) return { outcome: "address_limit" };

  const token = randomBytes(24).toString("base64url");
  const { error } = await db.from("guest_demo_emails").insert({ guest_session_id: guest.id, token_hash: hashDemoToken(token), email_hash: key, expires_at: guest.expiresAt, created_at: now.toISOString() });
  if (error) {
    if (/duplicate|unique/i.test(error.message)) return { outcome: "already_sent" };
    throw new Error(`save demo email: ${error.message}`);
  }
  if (input.marketing) await saveGuestMarketingConsent(db, secret, email, now);

  const until = new Date(guest.expiresAt).toLocaleString("en-US", { weekday: "long", hour: "numeric", minute: "2-digit", timeZone: "America/New_York", timeZoneName: "short" });
  const [outboxId] = await queueEmails(
    db,
    secret,
    [
      {
        emailId: "G1",
        dedupeKey: `G1:${guest.id}`,
        to: { email },
        guestSessionId: guest.id,
        message: readliEmail({
          subject: "Your Readli demo",
          name: "",
          title: "Hear your story again",
          paragraphs: [
            "Here's the story you heard read in your own voice.",
            input.marketing
              ? `This link works until ${until}. Then your demo is deleted. You asked for Readli news, so we'll keep your address for that.`
              : `This link works until ${until}. Then your demo is deleted, along with this email address.`,
          ],
          cta: { label: "Hear my demo", url: `${base.replace(/\/$/, "")}/try/demo/${token}` },
          reason: "You're getting this because you asked Readli to email your demo. We won't email you again unless you asked for Readli news.",
        }),
      },
    ],
    now,
  );
  return { outcome: "queued", outboxId };
}

async function saveGuestMarketingConsent(db: SupabaseClient, secret: string, email: string, now: Date): Promise<void> {
  const hash = emailHash(secret, email);
  const at = now.toISOString();
  const { error } = await db
    .from("email_marketing_contacts")
    .upsert({ email_hash: hash, email_encrypted: new ProviderRefCipher(secret).encrypt(email), source: "guest_demo", consented_at: at, unsubscribed_at: null }, { onConflict: "email_hash" });
  if (error) throw new Error(`save marketing consent: ${error.message}`);
  const { error: logError } = await db.from("email_consent_events").insert({ email_hash: hash, topic: "marketing", granted: true, source: "guest_demo", created_at: at });
  if (logError) throw new Error(`record marketing consent: ${logError.message}`);
}

/** The guest session a demo link opens, while it still works. */
export async function guestForDemoToken(db: SupabaseClient, token: string, now = new Date()): Promise<string | null> {
  if (!token || token.length > 100) return null;
  const { data, error } = await db.from("guest_demo_emails").select("guest_session_id, expires_at").eq("token_hash", hashDemoToken(token)).limit(1);
  if (error) throw new Error(`read demo link: ${error.message}`);
  const row = ((data ?? []) as Row[])[0];
  if (!row || new Date(row.expires_at as string).getTime() <= now.getTime()) return null;
  return row.guest_session_id as string;
}

/** Whether /try offers "Email me my demo": email is set up here and G1 is switched on in /admin. */
export async function demoEmailOn(db: SupabaseClient | null, configured: boolean): Promise<boolean> {
  if (!db || !configured) return false;
  return (await enabledEmails(db).catch(() => new Set<string>())).has("G1");
}
