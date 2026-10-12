import { currentAdult } from "@/lib/auth/adult";
import { currentUser, type SignedInUser } from "@/lib/auth/supabase";
import { currentSession } from "@/lib/family/session";
import { fail } from "@/lib/server/http";

/**
 * The signed-in grown-up who owns a Readli voice, for the voice routes. A device with a kids profile
 * open, or in Kids Mode, is acting as that child, so recording, deleting or sampling a voice is refused
 * there, as on every other grown-up route.
 */
export async function voiceOwner(signIn: string): Promise<{ user: SignedInUser } | { error: Response }> {
  const user = await currentUser();
  if (!user) return { error: fail(401, "sign_in_required", signIn) };
  const adultsOnly = () => ({ error: fail(403, "adults_only", "Only a grown-up can manage their Readli voice.") });
  if (!(await currentAdult())) return adultsOnly();
  const session = await currentSession();
  if (session && session.actor.kind !== "adult") return adultsOnly();
  return { user };
}
