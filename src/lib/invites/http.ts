import { currentAdult } from "@/lib/auth/adult";
import { accountDb } from "@/lib/family/account-store";
import { withFamily } from "@/lib/family/http";
import { guardianHousehold } from "@/lib/family/service";
import { fail } from "@/lib/server/http";
import type { SupabaseClient } from "@supabase/supabase-js";
import { InviteError } from "./server";

function handle(err: unknown): Response {
  if (err instanceof InviteError) return fail(err.status, err.code, err.message);
  throw err;
}

/** Runs an invitation route for a real grown-up who is a guardian of a family. */
export function withInviter(run: (ctx: { db: SupabaseClient; householdId: string; userId: string }) => Promise<Response>): Promise<Response> {
  return withFamily(async ({ store, actor, session }) => {
    const db = accountDb();
    if (!session.account || !db) return fail(404, "accounts_off", "Saved invitations need a signed-in account.");
    const householdId = await guardianHousehold(store, actor);
    if (!householdId) return fail(403, "not_guardian", "Only a parent or guardian can invite family.");
    return run({ db, householdId, userId: session.account.id }).catch(handle);
  });
}

/** Runs a route for any signed-in grown-up (accepting an invitation needs no family of their own). */
export async function withAccount(run: (ctx: { db: SupabaseClient; user: { id: string; name: string } }) => Promise<Response>): Promise<Response> {
  const db = accountDb();
  if (!db) return fail(404, "accounts_off", "Accounts aren't switched on yet.");
  const user = await currentAdult();
  if (!user) return fail(401, "sign_in_required", "Please sign in to continue.");
  return run({ db, user }).catch(handle);
}
