import type { SupabaseClient } from "@supabase/supabase-js";
import { MemoryMailer, ResendMailer, type Mailer } from "@/lib/invitations/email";
import { invitationSecret } from "@/lib/invitations/server";
import { sendDueEmails, type SendReport } from "./outbox";

const g = globalThis as typeof globalThis & { __readliOutboxMailer?: MemoryMailer };

/** Automated email always comes from "Readli" at EMAIL_FROM (Kevin, 2026-10-24). */
export function readliSender(from: string): string {
  return from.includes("<") ? from : `Readli <${from.trim()}>`;
}

/** The mailer for automated email, or null when email isn't set up here. */
export function readliMailer(env: NodeJS.ProcessEnv = process.env): Mailer | null {
  if (env.RESEND_API_KEY && env.EMAIL_FROM) return new ResendMailer(env.RESEND_API_KEY, readliSender(env.EMAIL_FROM));
  if (env.VOICE_PROVIDER === "stub") return (g.__readliOutboxMailer ??= new MemoryMailer());
  return null;
}

/** Encrypts queued addresses and signs preference links; the same secret as invitations. */
export const emailSecret = (env: NodeJS.ProcessEnv = process.env) => invitationSecret(env);

/** Sends due outbox emails, if email is configured (otherwise they wait in the outbox). */
export async function deliverEmails(db: SupabaseClient, ids?: string[]): Promise<SendReport | null> {
  const mailer = readliMailer();
  const secret = emailSecret();
  if (!mailer || !secret) return null;
  return sendDueEmails({ db, mailer, secret, ids, spacingMs: Number(process.env.EMAIL_SPACING_MS ?? 600) });
}
