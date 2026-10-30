import { NextResponse } from "next/server";
import { contactFromToken, isTopic, unsubscribeContact, updatePreferences, userFromPreferencesToken } from "@/lib/email/preferences";
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
  if (url.searchParams.has("c")) {
    // Someone without an account: from the mail app, or the button on /email/unsubscribe.
    const hash = contactFromToken(secret, url.searchParams.get("c"));
    if (!hash) return fail(400, "bad_link", "This unsubscribe link doesn't work.");
    await unsubscribeContact(db, hash, "one_click_unsubscribe");
    if (url.searchParams.get("from") === "page") return NextResponse.redirect(new URL("/email/unsubscribe?done=1", url.origin), 303);
    return NextResponse.json({ unsubscribed: "marketing" });
  }
  const userId = userFromPreferencesToken(secret, url.searchParams.get("t"));
  const topic = url.searchParams.get("topic");
  if (!userId || !isTopic(topic)) return fail(400, "bad_link", "This unsubscribe link doesn't work.");
  await updatePreferences(db, userId, { [topic]: false }, "one_click_unsubscribe");
  return NextResponse.json({ unsubscribed: topic });
}

/** Opening the link in a browser shows the preferences page (or, without an account, a confirm button) instead of changing anything. */
export function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.has("c")) return NextResponse.redirect(new URL(`/email/unsubscribe?c=${encodeURIComponent(url.searchParams.get("c") ?? "")}`, url.origin));
  return NextResponse.redirect(new URL(`/email/preferences?t=${encodeURIComponent(url.searchParams.get("t") ?? "")}`, url.origin));
}
