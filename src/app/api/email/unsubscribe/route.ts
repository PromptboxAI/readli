import { NextResponse } from "next/server";
import { isTopic, updatePreferences, userFromPreferencesToken } from "@/lib/email/preferences";
import { emailSecret } from "@/lib/email/send";
import { accountDb } from "@/lib/family/account-store";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** RFC 8058 one-click unsubscribe from one kind of email, straight from the mail app. */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const secret = emailSecret();
  const db = accountDb();
  if (!secret || !db) return fail(503, "off", "Email settings aren't available right now.");
  const userId = userFromPreferencesToken(secret, url.searchParams.get("t"));
  const topic = url.searchParams.get("topic");
  if (!userId || !isTopic(topic)) return fail(400, "bad_link", "This unsubscribe link doesn't work.");
  await updatePreferences(db, userId, { [topic]: false }, "one_click_unsubscribe");
  return NextResponse.json({ unsubscribed: topic });
}

/** Opening the link in a browser shows the preferences page instead of changing anything. */
export function GET(req: Request) {
  const url = new URL(req.url);
  return NextResponse.redirect(new URL(`/email/preferences?t=${encodeURIComponent(url.searchParams.get("t") ?? "")}`, url.origin));
}
