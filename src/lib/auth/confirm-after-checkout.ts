import { headers } from "next/headers";
import { emailUnconfirmed, sendEmailConfirmation } from "@/lib/auth/quick-signup";
import { supabaseServer } from "@/lib/auth/supabase";
import { accountDb } from "@/lib/family/account-store";
import { SITE_URL } from "@/lib/seo/site";

/**
 * Back from a paid checkout: when the signed-in grown-up came through quick signup and hasn't proven
 * their email yet, sends the confirming sign-in email (once) and returns the address it goes to, for the
 * page to mention. Otherwise null.
 */
export async function confirmAfterCheckout(): Promise<string | null> {
  const db = accountDb();
  if (!db) return null;
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user?.email || !emailUnconfirmed(user)) return null;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const origin = host ? `${h.get("x-forwarded-proto") ?? "https"}://${host}` : SITE_URL;
  await sendEmailConfirmation(db, user, origin).catch((err) => console.error("confirm email not sent", err));
  return user.email;
}
