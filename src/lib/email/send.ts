import type { SupabaseClient } from "@supabase/supabase-js";
import { sendDueEmails, type SendReport } from "./outbox";
import { emailConfig, emailEnabled, ResendSender } from "./resend";

/** Sends due outbox emails with Resend, if email is configured (otherwise they wait in the outbox). */
export async function deliverEmails(db: SupabaseClient, ids?: string[]): Promise<SendReport | null> {
  const config = emailConfig();
  if (!emailEnabled(config)) return null;
  return sendDueEmails({ db, sender: new ResendSender(config), config, ids });
}

export function looksLikeEmail(value: unknown): value is string {
  return typeof value === "string" && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
