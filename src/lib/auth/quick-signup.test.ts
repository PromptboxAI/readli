import { describe, expect, it, vi } from "vitest";

const signInWithOtp = vi.fn();
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ auth: { signInWithOtp } }) }));

import { CONFIRM_SENT_FLAG, emailTaken, emailUnconfirmed, markEmailConfirmed, normalizeEmail, sendEmailConfirmation, UNCONFIRMED_FLAG } from "./quick-signup";

function adminDb() {
  const updateUserById = vi.fn<(id: string, attrs: unknown) => Promise<{ error: null }>>(async () => ({ error: null }));
  return { db: { auth: { admin: { updateUserById } } } as never, updateUserById };
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

  it("sends the confirming email once, linking back to this site", async () => {
    signInWithOtp.mockResolvedValue({ error: null });
    const { db, updateUserById } = adminDb();
    const user = { id: "u1", email: "new@example.com", app_metadata: { [UNCONFIRMED_FLAG]: true } };
    expect(await sendEmailConfirmation(db, user, "https://preview.example", env)).toBe(true);
    expect(signInWithOtp).toHaveBeenCalledWith({ email: "new@example.com", options: { shouldCreateUser: false, emailRedirectTo: "https://preview.example/auth/callback?next=%2Fhome" } });
    expect(updateUserById.mock.calls[0]![1]).toMatchObject({ app_metadata: { [CONFIRM_SENT_FLAG]: expect.any(String) } });

    signInWithOtp.mockClear();
    expect(await sendEmailConfirmation(db, { ...user, app_metadata: { ...user.app_metadata, [CONFIRM_SENT_FLAG]: "2026-11-13T00:00:00Z" } }, "https://preview.example", env)).toBe(false);
    expect(await sendEmailConfirmation(db, { ...user, app_metadata: {} }, "https://preview.example", env)).toBe(false);
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it("lets it be sent again later if sending failed", async () => {
    signInWithOtp.mockResolvedValue({ error: { message: "rate limited" } });
    const { db, updateUserById } = adminDb();
    await expect(sendEmailConfirmation(db, { id: "u1", email: "new@example.com", app_metadata: { [UNCONFIRMED_FLAG]: true } }, "https://x", env)).rejects.toThrow(/rate limited/);
    expect(updateUserById).toHaveBeenLastCalledWith("u1", { app_metadata: { [UNCONFIRMED_FLAG]: true, [CONFIRM_SENT_FLAG]: null } });
  });
});
