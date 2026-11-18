import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { readliMailer } from "@/lib/email/send";
import { readliEmail } from "@/lib/email/templates";
import type { Mailer, OutgoingEmail } from "@/lib/invitations/email";

/**
 * Quick signup: someone buying Readli Family with an email that has no Readli account yet goes straight
 * to checkout, without the emailed code. The account is made for them on the spot and signed in on this
 * device, and it's marked unconfirmed until they open the confirmation email (sent once their plan is paid
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

/** The confirmation email: one button that signs them in and confirms the address. No code to type. */
export function confirmationEmail(to: string, url: string): OutgoingEmail {
  const message = readliEmail({
    subject: "Confirm your email for Readli",
    name: "",
    title: "Confirm your email",
    paragraphs: [
      "Thanks for starting Readli Family. Tap the button below to confirm this is your email address.",
      "It also signs you in, so open it on any phone, tablet or computer where you'd like to use Readli. The link works once and expires in an hour. After that, sign in at readli.ai with this email.",
    ],
    cta: { label: "Confirm my email", url },
    reason: "You're getting this because you started Readli Family with this email. If that wasn't you, you can ignore it.",
  });
  return { to, ...message, headers: message.headers ?? {} };
}

/**
 * After a quick-signup family has paid: emails the grown-up a confirmation link once, so they confirm
 * the address and can sign in on other devices. Returns whether it was sent now. Opening it signs them in
 * through /auth/callback, which clears the unconfirmed flag. It's Readli's own email with only a link
 * (not Supabase's sign-in email, which leads with a 6-digit code meant for returning grown-ups). Where
 * Readli email isn't set up, it falls back to Supabase's sign-in email.
 */
export async function sendEmailConfirmation(
  db: SupabaseClient,
  user: Pick<User, "id" | "email" | "app_metadata">,
  origin: string,
  env: NodeJS.ProcessEnv = process.env,
  mailer: Mailer | null = readliMailer(env),
): Promise<boolean> {
  if (!emailUnconfirmed(user) || !user.email || user.app_metadata?.[CONFIRM_SENT_FLAG]) return false;
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!mailer && (!url || !anon)) return false;
  // Marked first, so a reload while the email is sending doesn't send a second one.
  const { error: marked } = await db.auth.admin.updateUserById(user.id, { app_metadata: { [UNCONFIRMED_FLAG]: true, [CONFIRM_SENT_FLAG]: new Date().toISOString() } });
  if (marked) throw new Error(`mark confirm sent: ${marked.message}`);
  const callback = `${origin}/auth/callback?next=${encodeURIComponent("/home")}`;
  try {
    if (mailer) {
      // A one-time sign-in token, not emailed by Supabase: generateLink only makes it.
      const link = await db.auth.admin.generateLink({ type: "magiclink", email: user.email });
      const tokenHash = link.data?.properties?.hashed_token;
      if (!tokenHash) throw new Error(link.error?.message ?? "no sign-in token");
      await mailer.send({ ...confirmationEmail(user.email, `${callback}&token_hash=${encodeURIComponent(tokenHash)}&type=magiclink`), idempotencyKey: `confirm-email-${user.id}` });
    } else {
      const supabaseMailer = createClient(url!, anon!, { auth: { persistSession: false, autoRefreshToken: false, flowType: "implicit" } });
      const { error } = await supabaseMailer.auth.signInWithOtp({ email: user.email, options: { shouldCreateUser: false, emailRedirectTo: callback } });
      if (error) throw new Error(error.message);
    }
  } catch (err) {
    await db.auth.admin.updateUserById(user.id, { app_metadata: { [UNCONFIRMED_FLAG]: true, [CONFIRM_SENT_FLAG]: null } }).catch(() => undefined);
    throw new Error(`send confirm email: ${err instanceof Error ? err.message : String(err)}`);
  }
  return true;
}
