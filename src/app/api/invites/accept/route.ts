import { NextResponse } from "next/server";
import { deliverEmails, emailSecret } from "@/lib/email/send";
import { jsonBody } from "@/lib/family/http";
import { requestOrigin } from "@/lib/invitations/context";
import { withAccount } from "@/lib/invites/http";
import { queueInviterJoinedEmail } from "@/lib/invites/joined-email";
import { acceptInviteToken } from "@/lib/invites/server";
import { shareKeptVoice } from "@/lib/invites/share-on-keep";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/**
 * { token }. Joins the family as a member and starts no plan. A storyteller who already has a voice
 * shares it with the family now: accepting is their go-ahead. Otherwise it's shared when they keep one.
 * Someone joining as a parent sets off an email to whoever invited them (I4).
 */
export async function POST(req: Request) {
  const { token } = await jsonBody(req);
  if (typeof token !== "string" || !token) return fail(400, "bad_token", "That invitation link is incomplete.");
  return withAccount(async ({ db, user }) => {
    const { error } = await db.from("adult_profiles").upsert({ user_id: user.id, display_name: user.name }, { onConflict: "user_id", ignoreDuplicates: true });
    if (error) throw new Error(`save adult profile: ${error.message}`);
    const householdId = await acceptInviteToken(db, token, user.id);
    await shareKeptVoice();
    const secret = emailSecret();
    if (secret) {
      // Letting the inviter know is a nice-to-have: they've already joined, so a failure here is only logged.
      try {
        const ids = await queueInviterJoinedEmail({ db, secret, base: await requestOrigin() }, token, user.id);
        if (ids.length) await deliverEmails(db, ids);
      } catch (err) {
        console.error("joined email failed", err instanceof Error ? err.message : err);
      }
    }
    return NextResponse.json({ householdId });
  });
}
