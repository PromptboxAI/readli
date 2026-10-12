import { NextResponse } from "next/server";
import { jsonBody } from "@/lib/family/http";
import { requestOrigin } from "@/lib/invitations/context";
import { withContributor } from "@/lib/invitations/http";
import { resendInvitation, revokeInvitation } from "@/lib/invitations/server";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** { action: "resend" | "revoke" } on one of the contributor's invitations. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { action } = await jsonBody(req);
  if (action !== "resend" && action !== "revoke") return fail(400, "bad_request", "Choose resend or withdraw.");
  return withContributor(
    async (ctx, user) => {
      if (action === "resend") await resendInvitation(ctx.db, { secret: ctx.secret, origin: await requestOrigin(), mailer: ctx.mailer }, ctx.deps, user, id);
      else await revokeInvitation(ctx.db, user.id, id);
      return NextResponse.json({ ok: true });
    },
    { key: "invite-manage", limit: 20 },
  );
}
