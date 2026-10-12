import { NextResponse } from "next/server";
import { jsonBody } from "@/lib/family/http";
import { requestOrigin } from "@/lib/invitations/context";
import { withContributor } from "@/lib/invitations/http";
import { sendInvitations } from "@/lib/invitations/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Sends the contributor's invitations: { recipients: [{ name, relationship, email }], message, adultsConfirmed, shareConsent }. */
export async function POST(req: Request) {
  const body = await jsonBody(req);
  return withContributor(
    async (ctx, user) => {
      const results = await sendInvitations(ctx.db, { secret: ctx.secret, origin: await requestOrigin(), mailer: ctx.mailer }, ctx.deps, user, {
        recipients: body.recipients,
        message: body.message,
        adultsConfirmed: body.adultsConfirmed === true,
        shareConsent: body.shareConsent === true,
      });
      return NextResponse.json({ results });
    },
    { key: "invite-send", limit: 5 },
  );
}
