import { describe, expect, it, vi } from "vitest";

const signInWithOtp = vi.fn();
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ auth: { signInWithOtp } }) }));

import { CONFIRM_SENT_FLAG, emailTaken, emailUnconfirmed, markEmailConfirmed, normalizeEmail, sendEmailConfirmation, UNCONFIRMED_FLAG } from "./quick-signup";

function adminDb(hashedToken: string | null = "hash123") {
  const updateUserById = vi.fn<(id: string, attrs: unknown) => Promise<{ error: null }>>(async () => ({ error: null }));
  const generateLink = vi.fn(async () =>
    hashedToken ? { data: { properties: { hashed_token: hashedToken } }, error: null } : { data: { properties: null }, error: { message: "link failed" } },
  );
  return { db: { auth: { admin: { updateUserById, generateLink } } } as never, updateUserById, generateLink };
}

function mailer(fail = false) {
  const send = vi.fn<(email: { to: string; subject: string; html: string; text: string; idempotencyKey?: string }) => Promise<{ id: string }>>(async () => {
    if (fail) throw new Error("resend down");
    return { id: "m1" };
  });
  return { mailer: { send } as never, send };
}

const env = { NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon" } as unknown as NodeJS.ProcessEnv;

describe("quick signup", () => {
  it("accepts real-looking emails only", () => {
    expect(normalizeEmail("  Kevin@Example.COM ")).toBe("kevin@example.com");
    expect(normalizeEmail("kevin@example")).toBeNull();
    expect(normalizeEmail("not an email")).toBeNull();
    expect(normalizeEmail(42)).toBeNull();
    expect(normalizeEmail(`${"a".repeat(250)}@example.com`)).toBeNull();
  });

  it("knows Supabase's 'already registered' answers", () => {
    expect(emailTaken({ code: "email_exists" })).toBe(true);
    expect(emailTaken({ message: "A user with this email address has already been registered" })).toBe(true);
    expect(emailTaken({ code: "unexpected_failure", message: "Database error" })).toBe(false);
    expect(emailTaken(null)).toBe(false);
  });

  it("clears the flag only on an unconfirmed account", async () => {
    const { db, updateUserById } = adminDb();
    await markEmailConfirmed(db, { id: "u1", app_metadata: {} });
    expect(updateUserById).not.toHaveBeenCalled();
    await markEmailConfirmed(db, { id: "u1", app_metadata: { [UNCONFIRMED_FLAG]: true } });
    expect(updateUserById).toHaveBeenCalledWith("u1", { app_metadata: { [UNCONFIRMED_FLAG]: null, [CONFIRM_SENT_FLAG]: null } });
    expect(emailUnconfirmed({ app_metadata: { [UNCONFIRMED_FLAG]: true } })).toBe(true);
  });

  it("emails a confirmation link once, with no code, linking back to this site", async () => {
    const { db, updateUserById, generateLink } = adminDb();
    const { mailer: m, send } = mailer();
    const user = { id: "u1", email: "new@example.com", app_metadata: { [UNCONFIRMED_FLAG]: true } };
    expect(await sendEmailConfirmation(db, user, "https://preview.example", env, m)).toBe(true);
    expect(generateLink).toHaveBeenCalledWith({ type: "magiclink", email: "new@example.com" });
    expect(signInWithOtp).not.toHaveBeenCalled();
    const email = send.mock.calls[0]![0];
    expect(email.to).toBe("new@example.com");
    expect(email.subject).toBe("Confirm your email for Readli");
    expect(email.idempotencyKey).toBe("confirm-email-u1");
    const link = "https://preview.example/auth/callback?next=%2Fhome&token_hash=hash123&type=magiclink";
    expect(email.text).toContain(`Confirm my email: ${link}`);
    expect(email.html).toContain(link.replace(/&/g, "&amp;"));
    expect(email.text).not.toMatch(/\bcode\b/i);
    expect(updateUserById.mock.calls[0]![1]).toMatchObject({ app_metadata: { [CONFIRM_SENT_FLAG]: expect.any(String) } });

    send.mockClear();
    expect(await sendEmailConfirmation(db, { ...user, app_metadata: { ...user.app_metadata, [CONFIRM_SENT_FLAG]: "2026-11-13T00:00:00Z" } }, "https://preview.example", env, m)).toBe(false);
    expect(await sendEmailConfirmation(db, { ...user, app_metadata: {} }, "https://preview.example", env, m)).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it("lets it be sent again later if sending failed", async () => {
    for (const [hash, fail] of [[null, false], ["hash123", true]] as const) {
      const { db, updateUserById } = adminDb(hash);
      await expect(sendEmailConfirmation(db, { id: "u1", email: "new@example.com", app_metadata: { [UNCONFIRMED_FLAG]: true } }, "https://x", env, mailer(fail).mailer)).rejects.toThrow(/send confirm email/);
      expect(updateUserById).toHaveBeenLastCalledWith("u1", { app_metadata: { [UNCONFIRMED_FLAG]: true, [CONFIRM_SENT_FLAG]: null } });
    }
  });

  it("falls back to Supabase's sign-in email where Readli email isn't set up", async () => {
    signInWithOtp.mockResolvedValue({ error: null });
    const { db } = adminDb();
    const user = { id: "u1", email: "new@example.com", app_metadata: { [UNCONFIRMED_FLAG]: true } };
    expect(await sendEmailConfirmation(db, user, "https://preview.example", env, null)).toBe(true);
    expect(signInWithOtp).toHaveBeenCalledWith({ email: "new@example.com", options: { shouldCreateUser: false, emailRedirectTo: "https://preview.example/auth/callback?next=%2Fhome" } });

    signInWithOtp.mockResolvedValue({ error: { message: "rate limited" } });
    await expect(sendEmailConfirmation(db, user, "https://x", env, null)).rejects.toThrow(/rate limited/);
  });
});
