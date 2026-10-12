import { cookies } from "next/headers";
import { currentUser, type SignedInUser } from "@/lib/auth/supabase";
import { KIDS_COOKIE } from "@/lib/family/kids-mode";

/**
 * The signed-in grown-up, but only when this device isn't in Kids Mode. A parent stays signed in
 * while their child listens, so anything a child mustn't do (record or delete a voice, redeem a gift,
 * accept an invitation, admin) uses this rather than currentUser.
 */
export async function currentAdult(): Promise<SignedInUser | null> {
  const user = await currentUser();
  if (!user) return null;
  if ((await cookies()).get(KIDS_COOKIE)?.value) return null;
  return user;
}
