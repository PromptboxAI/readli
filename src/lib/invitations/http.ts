import { currentUser, type SignedInUser } from "@/lib/auth/supabase";
import { fail } from "@/lib/server/http";
import { allow, clientAddress } from "@/lib/server/rate-limit";
import { invitationContext, type InvitationContext } from "./context";
import { InvitationError } from "./server";

/** Runs an invitation route for the signed-in contributor. */
export async function withContributor(run: (ctx: InvitationContext, user: SignedInUser) => Promise<Response>, burst?: { key: string; limit: number }): Promise<Response> {
  const ctx = invitationContext();
  if (!ctx) return fail(404, "invitations_off", "Family invitations aren't switched on here yet.");
  const user = await currentUser();
  if (!user) return fail(401, "sign_in_required", "Please sign in to continue.");
  if (burst && !allow(`${burst.key}:${user.id}`, burst.limit, 60_000)) return fail(429, "slow_down", "That's a lot at once. Please wait a minute and try again.");
  return guard(() => run(ctx, user));
}

/** Runs a public invitation route (the recipient has no account), limited per address. */
export async function withRecipient(req: Request, run: (ctx: InvitationContext) => Promise<Response>): Promise<Response> {
  const ctx = invitationContext();
  if (!ctx) return fail(404, "not_found", "This invitation isn't available.");
  if (!allow(`invite-public:${clientAddress(req)}`, 60, 60_000)) return fail(429, "slow_down", "Please wait a minute and try again.");
  return guard(() => run(ctx));
}

async function guard(run: () => Promise<Response>): Promise<Response> {
  try {
    return await run();
  } catch (err) {
    if (err instanceof InvitationError) return fail(err.status, err.code, err.userMessage);
    throw err;
  }
}
