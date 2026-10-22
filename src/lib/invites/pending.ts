import { cookies } from "next/headers";
import { accountDb } from "@/lib/family/account-store";
import { JOIN_COOKIE, readJoinToken } from "./join-cookie";
import { inviteForToken } from "./server";

/**
 * The storyteller invitation this browser opened before signing in, if it can still be accepted.
 * Some sign-in emails lose the link they were sent from, so the invitation is never lost with it.
 */
export async function pendingJoinPath(userId: string): Promise<string | null> {
  const token = readJoinToken((await cookies()).get(JOIN_COOKIE)?.value);
  const db = token ? accountDb() : null;
  if (!token || !db) return null;
  const invite = await inviteForToken(db, token, userId).catch(() => null);
  return invite?.status === "invited" && !invite.alreadyMember ? `/voice/join?invite=${encodeURIComponent(token)}` : null;
}
