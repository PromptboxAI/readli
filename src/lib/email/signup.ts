import type { SupabaseClient } from "@supabase/supabase-js";
import { accountDb } from "@/lib/family/account-store";
import { updatePreferences } from "./preferences";

/** Which signup a new account came through, from where sign-in was headed. */
export function signupIntent(next: string): "family" | "voice" | "voice_invited" | null {
  if (next.startsWith("/voice/join")) return "voice_invited";
  if (next.startsWith("/voice") || next.startsWith("/signup/voice")) return "voice";
  if (next.startsWith("/family") || next.startsWith("/signup/family")) return "family";
  return null;
}

/**
 * After sign-in: saves the time zone the browser reported (for send hours), the Bedtime Thursdays
 * opt-in if the grown-up ticked it on a signup page, and, for an account made in the last day, which
 * signup it came through, so onboarding email can tell a Family signup from a Readli Voice one.
 */
export async function recordEmailSignup(supabase: SupabaseClient, url: URL, next: string, now = new Date()): Promise<void> {
  const db = accountDb();
  if (!db) return;
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return;
  const marketing = url.searchParams.get("news") === "1";
  const timeZone = url.searchParams.get("tz");
  if (marketing || timeZone) await updatePreferences(db, user.id, { ...(marketing ? { marketing: true } : {}), timeZone }, "signup", now);
  const intent = signupIntent(next);
  const created = user.created_at ? new Date(user.created_at).getTime() : 0;
  if (intent && now.getTime() - created < 86_400_000) {
    const { error } = await db.from("email_signups").upsert({ user_id: user.id, intent, created_at: user.created_at }, { onConflict: "user_id", ignoreDuplicates: true });
    if (error) throw new Error(`save signup: ${error.message}`);
  }
}
