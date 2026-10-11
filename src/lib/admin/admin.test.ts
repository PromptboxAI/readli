import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { adminPreviewOpen } from "./access";
import { adminEmails, DEFAULT_ADMIN_EMAILS, isAdmin, isAdminPath } from "./emails";
import { filterFamilies, livePlan } from "./overview";
import { AdminActionError, endTesterPlan, grantTesterPlan, parseTesterDays, testerPlanEnd } from "./tester-plans";

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

describe("admin overview", () => {
  const at = new Date("2026-10-11T00:00:00Z");
  const plan = (over: Record<string, unknown>) => ({ id: "e1", household_id: "h1", source: "gift", status: "active", starts_at: "2026-10-01T00:00:00Z", ends_at: null, ...over });

  it("finds the plan a family has right now", () => {
    expect(livePlan([plan({})], "h1", at)?.source).toBe("gift");
    expect(livePlan([plan({ ends_at: "2026-10-10T00:00:00Z" })], "h1", at)).toBeNull();
    expect(livePlan([plan({ starts_at: "2026-10-12T00:00:00Z" })], "h1", at)).toBeNull();
    expect(livePlan([plan({ status: "canceled" })], "h1", at)).toBeNull();
    expect(livePlan([plan({})], "h2", at)).toBeNull();
    expect(livePlan([plan({ id: "late", starts_at: "2026-10-05T00:00:00Z" }), plan({ id: "early" })], "h1", at)?.id).toBe("early");
  });

  it("finds families by name or owner email", () => {
    const f = (name: string, ownerEmail: string | null) => ({ id: name, name, ownerEmail, createdAt: "", members: 1, kids: 0, plan: null });
    const list = [f("The Parks", "sam@example.com"), f("Rivera family", null)];
    expect(filterFamilies(list, "  ").length).toBe(2);
    expect(filterFamilies(list, "SAM@").map((x) => x.name)).toEqual(["The Parks"]);
    expect(filterFamilies(list, "rivera").map((x) => x.name)).toEqual(["Rivera family"]);
  });
});

/** Just enough of the Supabase query builder for the tester plan actions. */
function fakeDb(tables: Record<string, Record<string, unknown>[]>) {
  const writes: { table: string; op: string; row: Record<string, unknown> }[] = [];
  const from = (table: string) => {
    const filters: [string, unknown][] = [];
    const matching = () => (tables[table] ?? []).filter((r) => filters.every(([k, v]) => r[k] === v));
    const builder = {
      select: () => builder,
      eq: (k: string, v: unknown) => {
        filters.push([k, v]);
        return builder;
      },
      maybeSingle: async () => ({ data: matching()[0] ?? null, error: null }),
      then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data: matching(), error: null }).then(resolve),
      insert: async (row: Record<string, unknown>) => {
        writes.push({ table, op: "insert", row });
        return { error: null };
      },
      update: (row: Record<string, unknown>) => ({
        eq: async (k: string, v: unknown) => {
          writes.push({ table, op: "update", row: { ...row, [k]: v } });
          return { error: null };
        },
      }),
    };
    return builder;
  };
  return { db: { from } as unknown as SupabaseClient, writes };
}

describe("tester plans", () => {
  const admin = { id: "admin-1", email: "admin@readli.ai", name: "Admin" };
  const at = new Date("2026-10-11T00:00:00Z");
  const home = { id: "h1", name: "The Parks" };

  it("only accepts the offered lengths", () => {
    expect(parseTesterDays("30")).toBe(30);
    expect(parseTesterDays("90")).toBe(90);
    expect(parseTesterDays("none")).toBeNull();
    expect(parseTesterDays("365")).toBeUndefined();
    expect(parseTesterDays("")).toBeUndefined();
    expect(testerPlanEnd(30, at)).toBe("2026-11-10T00:00:00.000Z");
    expect(testerPlanEnd(null, at)).toBeNull();
  });

  it("gives a family without a plan a tester plan, and logs who did it", async () => {
    const { db, writes } = fakeDb({ households: [home], household_entitlements: [] });
    await grantTesterPlan(db, admin, "h1", 30, at);
    expect(writes[0]).toMatchObject({
      table: "household_entitlements",
      op: "insert",
      row: { household_id: "h1", source: "tester", status: "active", ends_at: "2026-11-10T00:00:00.000Z", granted_by: "admin-1" },
    });
    expect(writes[1]).toMatchObject({ table: "admin_actions", row: { admin_id: "admin-1", action: "tester_plan_granted", household_id: "h1" } });
  });

  it("never stacks a tester plan on a live plan", async () => {
    const { db, writes } = fakeDb({
      households: [home],
      household_entitlements: [{ id: "e1", household_id: "h1", source: "subscription", status: "active", starts_at: "2026-10-01T00:00:00Z", ends_at: null }],
    });
    await expect(grantTesterPlan(db, admin, "h1", 30, at)).rejects.toThrow(AdminActionError);
    await expect(grantTesterPlan(db, admin, "missing", 30, at)).rejects.toThrow("no longer exists");
    expect(writes).toEqual([]);
  });

  it("ends tester plans only", async () => {
    const { db, writes } = fakeDb({
      household_entitlements: [
        { id: "paid", household_id: "h1", source: "subscription", status: "active" },
        { id: "test", household_id: "h2", source: "tester", status: "active" },
      ],
    });
    await expect(endTesterPlan(db, admin, "paid", at)).rejects.toThrow(AdminActionError);
    expect(writes).toEqual([]);
    await endTesterPlan(db, admin, "test", at);
    expect(writes[0]).toMatchObject({ table: "household_entitlements", op: "update", row: { status: "canceled", id: "test" } });
    expect(writes[1]).toMatchObject({ table: "admin_actions", row: { action: "tester_plan_ended", household_id: "h2" } });
  });
});
