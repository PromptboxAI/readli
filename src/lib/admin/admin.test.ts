import { describe, expect, it } from "vitest";
import { adminPreviewOpen } from "./access";
import { adminEmails, DEFAULT_ADMIN_EMAILS, isAdmin, isAdminPath } from "./emails";

const confirmed = "2026-10-01T00:00:00Z";
const env = (vars: Record<string, string>) => ({ NODE_ENV: "production", ...vars }) as NodeJS.ProcessEnv;

describe("admin access", () => {
  it("defaults to the Readli admin addresses", () => {
    expect(adminEmails(env({}))).toEqual(DEFAULT_ADMIN_EMAILS);
    expect(adminEmails(env({ ADMIN_EMAILS: " " }))).toEqual(DEFAULT_ADMIN_EMAILS);
  });

  it("reads ADMIN_EMAILS, ignoring case and spaces", () => {
    expect(adminEmails(env({ ADMIN_EMAILS: " Ops@Readli.ai , ,qa@readli.ai" }))).toEqual(["ops@readli.ai", "qa@readli.ai"]);
  });

  it("lets in only confirmed emails on the list", () => {
    const e = env({});
    expect(isAdmin({ email: "Kevin@Promptbox.com", email_confirmed_at: confirmed }, e)).toBe(true);
    expect(isAdmin({ email: "kevin@promptbox.com", email_confirmed_at: null }, e)).toBe(false);
    expect(isAdmin({ email: "someone@example.com", email_confirmed_at: confirmed }, e)).toBe(false);
    expect(isAdmin({ email: null, email_confirmed_at: confirmed }, e)).toBe(false);
    expect(isAdmin(null, e)).toBe(false);
    expect(isAdmin({ email: "kevin@promptbox.com", email_confirmed_at: confirmed }, env({ ADMIN_EMAILS: "ops@readli.ai" }))).toBe(false);
  });

  it("covers every admin page and admin API route, and nothing else", () => {
    for (const p of ["/admin", "/admin/plans", "/admin/narration", "/api/admin/grants"]) expect(isAdminPath(p)).toBe(true);
    for (const p of ["/administrator", "/family", "/api/family/kids", "/"]) expect(isAdminPath(p)).toBe(false);
  });

  it("stays open only in the no-sign-in preview", () => {
    expect(adminPreviewOpen(env({ VOICE_PROVIDER: "stub" }))).toBe(true);
    expect(adminPreviewOpen(env({ VOICE_PROVIDER: "stub", NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "k" }))).toBe(false);
    expect(adminPreviewOpen(env({}))).toBe(false);
  });
});
