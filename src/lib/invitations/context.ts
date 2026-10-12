import { cookies, headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { accountDb } from "@/lib/family/account-store";
import { serverConfig } from "@/lib/server/config";
import { accountVoiceDeps } from "@/lib/voice/account-voices";
import { invitationMailer, type Mailer } from "./email";
import { INVITE_COOKIE, invitationSecret, type PreviewDeps } from "./server";

export interface InvitationContext {
  db: SupabaseClient;
  deps: PreviewDeps;
  secret: string;
  mailer: Mailer | null;
}

/** Everything family invitations need, or null where real accounts and voices aren't set up. */
export function invitationContext(): InvitationContext | null {
  const db = accountDb();
  const voices = accountVoiceDeps(serverConfig());
  const secret = invitationSecret();
  if (!db || !voices || !secret) return null;
  return {
    db,
    secret,
    mailer: invitationMailer(),
    deps: { provider: voices.provider, findVoice: (id) => voices.store.findVoice(id) },
  };
}

export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "readli.ai";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? `${proto}://${host}`;
}

/** The preview token a visitor carried from an invitation into signup, if any. */
export async function carriedInvitationToken(): Promise<string | null> {
  const v = (await cookies()).get(INVITE_COOKIE)?.value ?? "";
  return /^[A-Za-z0-9_-]{20,64}$/.test(v) ? v : null;
}
