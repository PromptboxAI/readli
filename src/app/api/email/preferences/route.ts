import { NextResponse } from "next/server";
import { isTopic, updatePreferences, userFromPreferencesToken, type ConsentSource } from "@/lib/email/preferences";
import { emailSecret } from "@/lib/email/send";
import type { PreferenceTopic } from "@/lib/email/catalog";
import { signedInAccount } from "@/lib/account/server";
import { accountDb } from "@/lib/family/account-store";
import { jsonBody } from "@/lib/family/http";
import { allow } from "@/lib/server/rate-limit";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/**
 * Saves email choices: from the preferences page an email linked to (its token names the grown-up),
 * or from account settings when signed in.
 */
export async function POST(req: Request) {
  const body = await jsonBody(req);
  const secret = emailSecret();
  const db = accountDb();
  if (!secret || !db) return fail(503, "off", "Email settings aren't available right now.");
  let userId: string | null = null;
  let source: ConsentSource = "email_preferences";
  if (body.token !== undefined) {
    userId = userFromPreferencesToken(secret, body.token);
    if (!userId) return fail(400, "bad_link", "This link doesn't work. Open the latest Readli email, or sign in and open Settings.");
  } else {
    const account = await signedInAccount();
    if (!account) return fail(401, "sign_in_required", "Please sign in to change your email settings.");
    userId = account.user.id;
    source = "account_settings";
  }
  if (!allow(`email-preferences:${userId}`, 20, 60_000)) return fail(429, "slow_down", "That's a lot at once. Please wait a minute and try again.");
  const raw = body.preferences && typeof body.preferences === "object" ? (body.preferences as Record<string, unknown>) : {};
  const changes: Partial<Record<PreferenceTopic, boolean>> = {};
  for (const [k, v] of Object.entries(raw)) if (isTopic(k) && typeof v === "boolean") changes[k] = v;
  const saved = await updatePreferences(db, userId, { ...changes, timeZone: body.timeZone }, source);
  return NextResponse.json({ preferences: saved });
}
