import { NextResponse } from "next/server";
import { jsonBody } from "@/lib/family/http";
import { withAccount } from "@/lib/invites/http";
import { acceptInviteToken } from "@/lib/invites/server";
import { shareKeptVoice } from "@/lib/invites/share-on-keep";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/**
 * { token }. Joins the family as a member and starts no plan. A storyteller who already has a voice
 * shares it with the family now: accepting is their go-ahead. Otherwise it's shared when they keep one.
 */
export async function POST(req: Request) {
  const { token } = await jsonBody(req);
  if (typeof token !== "string" || !token) return fail(400, "bad_token", "That invitation link is incomplete.");
  return withAccount(async ({ db, user }) => {
    const { error } = await db.from("adult_profiles").upsert({ user_id: user.id, display_name: user.name }, { onConflict: "user_id", ignoreDuplicates: true });
    if (error) throw new Error(`save adult profile: ${error.message}`);
    const householdId = await acceptInviteToken(db, token, user.id);
    await shareKeptVoice();
    return NextResponse.json({ householdId });
  });
}
