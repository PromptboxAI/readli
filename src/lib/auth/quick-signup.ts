import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

/**
 * Quick signup: someone buying Readli Family with an email that has no Readli account yet goes straight
 * to checkout, without the emailed code. The account is made for them on the spot and signed in on this
 * device, and it's marked unconfirmed until they open a sign-in email (sent once their plan is paid
 * for), sign in with a code or link, or use Google. An email that already has an account always needs
 * the code, so nobody can get into someone else's account by typing their address.
 */

/** app_metadata flags. Only the service role can write app_metadata, so the browser can't clear them. */
export const UNCONFIRMED_FLAG = "email_unconfirmed";
export const CONFIRM_SENT_FLAG = "email_confirm_sent_at";

/** A trimmed, lowercased email that looks deliverable, or null. */
export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@.]{2,}$/.test(email)) return null;
  return email;
}

/** Whether this account came from quick signup and its email hasn't been proven yet. */
export function emailUnconfirmed(user: Pick<User, "app_metadata"> | null | undefined): boolean {
  return user?.app_metadata?.[UNCONFIRMED_FLAG] === true;
}

/** Whether Supabase refused to make the account because the email is already taken. */
export function emailTaken(error: { code?: string; message?: string; status?: number } | null | undefined): boolean {
  if (!error) return false;
  return error.code === "email_exists" || error.code === "user_already_exists" || /already (been )?registered|already exists/i.test(error.message ?? "");
}

/** Clears the unconfirmed flag once the grown-up has proven the email (code, link or Google). */
export async function markEmailConfirmed(db: SupabaseClient, user: Pick<User, "id" | "app_metadata">): Promise<void> {
  if (!emailUnconfirmed(user)) return;
  const { error } = await db.auth.admin.updateUserById(user.id, { app_metadata: { [UNCONFIRMED_FLAG]: null, [CONFIRM_SENT_FLAG]: null } });
  if (error) throw new Error(`clear email flag: ${error.message}`);
}

/**
 * After a quick-signup family has paid: emails the grown-up a sign-in link and code (Supabase's sign-in
 * email) once, so they confirm the address and can sign in on other devices. Returns whether it was
 * sent now. Opening it signs them in through /auth/callback, which clears the unconfirmed flag.
 */
export async function sendEmailConfirmation(
  db: SupabaseClient,
  user: Pick<User, "id" | "email" | "app_metadata">,
  origin: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<boolean> {
  if (!emailUnconfirmed(user) || !user.email || user.app_metadata?.[CONFIRM_SENT_FLAG]) return false;
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return false;
  // Marked first, so a reload while the email is sending doesn't send a second one.
  const { error: marked } = await db.auth.admin.updateUserById(user.id, { app_metadata: { [UNCONFIRMED_FLAG]: true, [CONFIRM_SENT_FLAG]: new Date().toISOString() } });
  if (marked) throw new Error(`mark confirm sent: ${marked.message}`);
  const mailer = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false, flowType: "implicit" } });
  const { error } = await mailer.auth.signInWithOtp({
    email: user.email,
    options: { shouldCreateUser: false, emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/home")}` },
  });
  if (error) {
    await db.auth.admin.updateUserById(user.id, { app_metadata: { [UNCONFIRMED_FLAG]: true, [CONFIRM_SENT_FLAG]: null } }).catch(() => undefined);
    throw new Error(`send confirm email: ${error.message}`);
  }
  return true;
}
