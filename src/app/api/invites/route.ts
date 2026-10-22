import { NextResponse } from "next/server";
import { jsonBody } from "@/lib/family/http";
import { withInviter } from "@/lib/invites/http";
import { queueEmails } from "@/lib/email/outbox";
import { deliverEmails, looksLikeEmail } from "@/lib/email/send";
import { familyInviteEmail } from "@/lib/email/templates";
import { INVITE_TTL_DAYS } from "@/lib/invites/family-invites";
import { createInvite, inviteLink, listInvites } from "@/lib/invites/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return withInviter(async ({ db, householdId }) => NextResponse.json({ invites: await listInvites(db, householdId) }));
}

/**
 * { name, relationship, email? }. Returns the link once; only its hash is kept. With an email, Readli
 * also sends the invitation (a transactional email; the address isn't added to any mailing list).
 */
export async function POST(req: Request) {
  const { name, relationship, email } = await jsonBody(req);
  return withInviter(async ({ db, householdId, userId }) => {
    const { invite, token } = await createInvite(db, {
      householdId,
      inviterId: userId,
      name: typeof name === "string" ? name : "",
      relationship: typeof relationship === "string" ? relationship : "",
    });
    const link = inviteLink(new URL(req.url).origin, token);
    let emailed = false;
    if (looksLikeEmail(email)) {
      const [home, me] = await Promise.all([
        db.from("households").select("name").eq("id", householdId).maybeSingle(),
        db.from("adult_profiles").select("display_name").eq("user_id", userId).maybeSingle(),
      ]);
      const message = familyInviteEmail({
        inviterName: (me.data?.display_name as string | undefined) || "A family member",
        familyName: (home.data?.name as string | undefined) || "their family",
        inviteeName: invite.name,
        link,
        expiresAt: new Date(invite.createdAt.getTime() + INVITE_TTL_DAYS * 86_400_000).toISOString(),
      });
      const ids = await queueEmails(db, [{ dedupeKey: `invite:${invite.id}`, template: "family_invite", ...message, to: { email: email.trim() }, householdId }]);
      emailed = Boolean((await deliverEmails(db, ids).catch(() => null))?.sent);
    }
    return NextResponse.json({ invite, link, emailed }, { status: 201 });
  });
}
