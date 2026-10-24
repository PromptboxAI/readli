import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PREFERENCE_TOPICS, type PreferenceTopic } from "./catalog";
import { validTimeZone } from "./policy";

/**
 * Each grown-up's optional-email choices (email_preferences), changed from account settings, from the
 * no-login preferences page every email links to, or by one-click unsubscribe. Every change is
 * recorded in email_consent_events with where it came from.
 */

export type Preferences = Record<PreferenceTopic, boolean> & { timeZone: string | null };

export const DEFAULT_PREFERENCES: Preferences = {
  setup_reminders: true,
  invitation_reminders: true,
  feedback_requests: true,
  marketing: false,
  timeZone: null,
};

export type ConsentSource = "signup" | "account_settings" | "email_preferences" | "one_click_unsubscribe";

const TOPICS = PREFERENCE_TOPICS.map((t) => t.topic);

export const isTopic = (v: unknown): v is PreferenceTopic => typeof v === "string" && (TOPICS as string[]).includes(v);

export async function preferencesFor(db: SupabaseClient, userId: string): Promise<Preferences> {
  const { data, error } = await db.from("email_preferences").select("*").eq("user_id", userId).limit(1);
  if (error) throw new Error(`read email preferences: ${error.message}`);
  const row = (data ?? [])[0] as Record<string, unknown> | undefined;
  if (!row) return { ...DEFAULT_PREFERENCES };
  return {
    setup_reminders: row.setup_reminders !== false,
    invitation_reminders: row.invitation_reminders !== false,
    feedback_requests: row.feedback_requests !== false,
    marketing: row.marketing === true,
    timeZone: typeof row.time_zone === "string" ? row.time_zone : null,
  };
}

/** Saves the topics given (others unchanged) and records each one that changed. */
export async function updatePreferences(
  db: SupabaseClient,
  userId: string,
  changes: Partial<Record<PreferenceTopic, boolean>> & { timeZone?: unknown },
  source: ConsentSource,
  now = new Date(),
): Promise<Preferences> {
  const current = await preferencesFor(db, userId);
  const next: Preferences = { ...current };
  const changed: PreferenceTopic[] = [];
  for (const topic of TOPICS) {
    const value = changes[topic];
    if (typeof value === "boolean" && value !== current[topic]) {
      next[topic] = value;
      changed.push(topic);
    }
  }
  if (validTimeZone(changes.timeZone)) next.timeZone = changes.timeZone;
  if (!changed.length && next.timeZone === current.timeZone) return current;
  const at = now.toISOString();
  const { error } = await db.from("email_preferences").upsert(
    {
      user_id: userId,
      setup_reminders: next.setup_reminders,
      invitation_reminders: next.invitation_reminders,
      feedback_requests: next.feedback_requests,
      marketing: next.marketing,
      time_zone: next.timeZone,
      updated_at: at,
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(`save email preferences: ${error.message}`);
  if (changed.length) {
    const { error: logError } = await db
      .from("email_consent_events")
      .insert(changed.map((topic) => ({ user_id: userId, topic, granted: next[topic], source, created_at: at })));
    if (logError) throw new Error(`record email consent: ${logError.message}`);
  }
  if (changed.includes("marketing")) {
    // Kept in step for the data export; email_preferences is what sending checks.
    await db.from("adult_profiles").update({ marketing_opt_in: next.marketing, updated_at: at }).eq("user_id", userId);
  }
  return next;
}

const mac = (secret: string, userId: string) => createHmac("sha256", `readli-email-preferences:${secret}`).update(userId).digest("base64url").slice(0, 32);

/** A link token naming one grown-up, so the preferences page works without signing in. */
export const preferencesToken = (secret: string, userId: string) => `${userId}.${mac(secret, userId)}`;

export function userFromPreferencesToken(secret: string, token: unknown): string | null {
  if (typeof token !== "string") return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const userId = token.slice(0, dot);
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return null;
  const given = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(mac(secret, userId));
  return given.length === expected.length && timingSafeEqual(given, expected) ? userId : null;
}

export function preferencesUrl(base: string, secret: string, userId: string): string {
  return `${base.replace(/\/$/, "")}/email/preferences?t=${encodeURIComponent(preferencesToken(secret, userId))}`;
}

/** RFC 8058 one-click unsubscribe from one topic, for the List-Unsubscribe header. */
export function oneClickUnsubscribeUrl(base: string, secret: string, userId: string, topic: PreferenceTopic): string {
  return `${base.replace(/\/$/, "")}/api/email/unsubscribe?t=${encodeURIComponent(preferencesToken(secret, userId))}&topic=${topic}`;
}

export function unsubscribeHeaders(base: string, secret: string, userId: string, topic: PreferenceTopic): Record<string, string> {
  return { "List-Unsubscribe": `<${oneClickUnsubscribeUrl(base, secret, userId, topic)}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" };
}

const contactMac = (secret: string, hash: string) => createHmac("sha256", `readli-email-contact:${secret}`).update(hash).digest("base64url").slice(0, 32);

/** A link token for someone without an account who asked for Readli news (email_marketing_contacts). */
export const contactToken = (secret: string, emailHash: string) => `${emailHash}.${contactMac(secret, emailHash)}`;

export function contactFromToken(secret: string, token: unknown): string | null {
  if (typeof token !== "string") return null;
  const [hash, given] = token.split(".");
  if (!hash || !given || !/^[0-9a-f]{64}$/.test(hash)) return null;
  const a = Buffer.from(given);
  const b = Buffer.from(contactMac(secret, hash));
  return a.length === b.length && timingSafeEqual(a, b) ? hash : null;
}

export const contactUnsubscribeUrl = (base: string, secret: string, emailHash: string) =>
  `${base.replace(/\/$/, "")}/api/email/unsubscribe?c=${encodeURIComponent(contactToken(secret, emailHash))}`;

/** Stops Bedtime Thursdays and news for someone without an account, and records it. */
export async function unsubscribeContact(db: SupabaseClient, emailHash: string, source: ConsentSource, now = new Date()): Promise<void> {
  const at = now.toISOString();
  const { data, error } = await db.from("email_marketing_contacts").update({ unsubscribed_at: at }).eq("email_hash", emailHash).is("unsubscribed_at", null).select("email_hash");
  if (error) throw new Error(`unsubscribe contact: ${error.message}`);
  if (!(data ?? []).length) return;
  const { error: logError } = await db.from("email_consent_events").insert({ email_hash: emailHash, topic: "marketing", granted: false, source, created_at: at });
  if (logError) throw new Error(`record email consent: ${logError.message}`);
}
